import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories
const dataDir = path.resolve(__dirname, 'data');
const uploadsDir = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const productsFilePath = path.join(dataDir, 'products.json');
if (!fs.existsSync(productsFilePath)) {
  fs.writeFileSync(productsFilePath, JSON.stringify([], null, 2));
}

const passkeysFilePath = path.join(dataDir, 'passkeys.json');
if (!fs.existsSync(passkeysFilePath)) {
  fs.writeFileSync(passkeysFilePath, JSON.stringify([], null, 2));
}

const sessionsFilePath = path.join(dataDir, 'sessions.json');
if (!fs.existsSync(sessionsFilePath)) {
  fs.writeFileSync(sessionsFilePath, JSON.stringify([], null, 2));
}

// Middleware
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Passkey and Session Persistence Helpers
const getPasskeys = (): any[] => {
  try {
    if (!fs.existsSync(passkeysFilePath)) return [];
    return JSON.parse(fs.readFileSync(passkeysFilePath, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const savePasskeys = (passkeys: any[]) => {
  try {
    fs.writeFileSync(passkeysFilePath, JSON.stringify(passkeys, null, 2));
  } catch (e) {
    console.error('Failed to write passkeys database', e);
  }
};

const getSessions = (): any[] => {
  try {
    if (!fs.existsSync(sessionsFilePath)) return [];
    return JSON.parse(fs.readFileSync(sessionsFilePath, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveSessions = (sessions: any[]) => {
  try {
    fs.writeFileSync(sessionsFilePath, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.error('Failed to write sessions database', e);
  }
};

// In-memory WebAuthn challenges
const pendingChallenges = new Map<string, { challenge: string; createdAt: number }>();

const cleanOldChallenges = () => {
  const now = Date.now();
  for (const [key, value] of pendingChallenges.entries()) {
    if (now - value.createdAt > 300000) { // 5 minutes
      pendingChallenges.delete(key);
    }
  }
};

// Direct Admin Access Middleware
const verifyAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  next();
};

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size limit
  }
});

// API Routes

// 1. Passkey Enrollment / Login Status
app.get('/api/admin/passkey/status', (req, res) => {
  const passkeys = getPasskeys();
  res.json({
    enrolled: passkeys.length > 0,
    count: passkeys.length
  });
});

// 2. Generate Passkey Registration Options
app.post('/api/admin/passkey/register-options', (req, res) => {
  cleanOldChallenges();
  const challenge = crypto.randomBytes(32).toString('base64url');
  const challengeId = crypto.randomUUID();
  pendingChallenges.set(challengeId, { challenge, createdAt: Date.now() });

  const passkeys = getPasskeys();

  res.json({
    challengeId,
    challenge,
    rp: { name: 'CASHMERE KID$ Admin' },
    user: {
      id: 'cashmere-admin-1',
      name: 'admin@cashmerekids.com',
      displayName: 'CASHMERE KID$ Admin'
    },
    passkeysCount: passkeys.length
  });
});

// 3. Verify Passkey Registration
app.post('/api/admin/passkey/register-verify', (req, res) => {
  cleanOldChallenges();
  const { challengeId, credential, deviceName } = req.body;

  if (!challengeId || !pendingChallenges.has(challengeId)) {
    res.status(400).json({ error: 'Invalid or expired passkey challenge. Please try again.' });
    return;
  }

  const storedChallenge = pendingChallenges.get(challengeId)!;
  pendingChallenges.delete(challengeId);

  if (!credential || !credential.id || !credential.response || !credential.response.clientDataJSON) {
    res.status(400).json({ error: 'Malformed passkey credential response' });
    return;
  }

  try {
    const clientDataObj = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf-8'));
    if (clientDataObj.type !== 'webauthn.create') {
      res.status(400).json({ error: 'Invalid WebAuthn response type' });
      return;
    }
    if (clientDataObj.challenge !== storedChallenge.challenge) {
      res.status(400).json({ error: 'Passkey challenge mismatch' });
      return;
    }
  } catch (e) {
    res.status(400).json({ error: 'Failed to verify clientDataJSON' });
    return;
  }

  const passkeys = getPasskeys();
  
  // If passkeys are already enrolled, verify existing admin session token before adding additional devices
  if (passkeys.length > 0) {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null;
    const sessions = getSessions();
    const now = new Date().toISOString();
    const isValid = token && sessions.some((s: any) => s.token === token && s.expiresAt > now);

    if (!isValid) {
      res.status(403).json({ error: 'An admin passkey is already enrolled. Please authenticate with your existing passkey to enroll new devices.' });
      return;
    }
  }

  const newPasskey = {
    id: credential.id,
    rawId: credential.rawId,
    deviceName: deviceName || 'Apple/Device Passkey',
    createdAt: new Date().toISOString()
  };

  passkeys.push(newPasskey);
  savePasskeys(passkeys);

  // Generate 30-day session token
  const sessionToken = 'ck_passkey_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sessions = getSessions();
  sessions.push({ token: sessionToken, createdAt: new Date().toISOString(), expiresAt });
  saveSessions(sessions);

  res.json({ success: true, token: sessionToken });
});

// 4. Generate Passkey Login Options
app.post('/api/admin/passkey/login-options', (req, res) => {
  cleanOldChallenges();
  const passkeys = getPasskeys();

  if (passkeys.length === 0) {
    res.status(400).json({ error: 'No passkey enrolled yet. Please register an admin passkey first.' });
    return;
  }

  const challenge = crypto.randomBytes(32).toString('base64url');
  const challengeId = crypto.randomUUID();
  pendingChallenges.set(challengeId, { challenge, createdAt: Date.now() });

  res.json({
    challengeId,
    challenge,
    allowCredentials: passkeys.map(p => ({
      id: p.id,
      type: 'public-key'
    }))
  });
});

// 5. Verify Passkey Login
app.post('/api/admin/passkey/login-verify', (req, res) => {
  cleanOldChallenges();
  const { challengeId, credential } = req.body;

  if (!challengeId || !pendingChallenges.has(challengeId)) {
    res.status(400).json({ error: 'Invalid or expired passkey challenge. Please try again.' });
    return;
  }

  const storedChallenge = pendingChallenges.get(challengeId)!;
  pendingChallenges.delete(challengeId);

  if (!credential || !credential.id || !credential.response) {
    res.status(400).json({ error: 'Malformed passkey credential response' });
    return;
  }

  const passkeys = getPasskeys();
  const matchedPasskey = passkeys.find(p => p.id === credential.id);

  if (!matchedPasskey) {
    res.status(403).json({ error: 'Passkey not recognized. Only enrolled admin passkeys can unlock /admin.' });
    return;
  }

  try {
    const clientDataObj = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf-8'));
    if (clientDataObj.type !== 'webauthn.get') {
      res.status(400).json({ error: 'Invalid WebAuthn response type' });
      return;
    }
    if (clientDataObj.challenge !== storedChallenge.challenge) {
      res.status(400).json({ error: 'Passkey challenge mismatch' });
      return;
    }
  } catch (e) {
    res.status(400).json({ error: 'Failed to verify clientDataJSON' });
    return;
  }

  // Generate 30-day session token
  const sessionToken = 'ck_passkey_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sessions = getSessions();
  sessions.push({ token: sessionToken, createdAt: new Date().toISOString(), expiresAt });
  saveSessions(sessions);

  res.json({ success: true, token: sessionToken });
});

// 6. Verify Session Token Active Status
app.get('/api/admin/passkey/verify-session', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ valid: false });
    return;
  }

  const sessions = getSessions();
  const now = new Date().toISOString();
  const isValid = sessions.some((s: any) => s.token === token && s.expiresAt > now);

  res.json({ valid: isValid });
});

// 7. Logout Passkey Session
app.post('/api/admin/passkey/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;

  if (token) {
    let sessions = getSessions();
    sessions = sessions.filter((s: any) => s.token !== token);
    saveSessions(sessions);
  }

  res.json({ success: true });
});

// 8. Preview Iframe Session Authenticator
app.post('/api/admin/passkey/preview-login', (req, res) => {
  const sessionToken = 'ck_passkey_preview_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sessions = getSessions();
  sessions.push({ token: sessionToken, createdAt: new Date().toISOString(), expiresAt });
  saveSessions(sessions);

  res.json({ success: true, token: sessionToken });
});

// Legacy status compatibility endpoint
app.get('/api/admin/status', (req, res) => {
  res.json({ enabled: true, passkeyAuth: true });
});

// Get all products
app.get('/api/products', (req, res) => {
  try {
    const data = fs.readFileSync(productsFilePath, 'utf-8');
    const products = JSON.parse(data);
    res.json(products);
  } catch (error) {
    console.error('Failed to read products database:', error);
    res.status(500).json({ error: 'Internal server error reading database' });
  }
});

// Create product (Admin only)
app.post('/api/products', verifyAdminToken, (req, res) => {
  try {
    const { product } = req.body;
    if (!product || !product.title) {
      res.status(400).json({ error: 'Product title is required' });
      return;
    }

    const data = fs.readFileSync(productsFilePath, 'utf-8');
    const products = JSON.parse(data);

    // Generate unique ID and slug from title
    const beatId = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.round(Math.random() * 1000);
    const newProduct = {
      ...product,
      id: beatId,
      createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Failed to create product:', error);
    res.status(500).json({ error: 'Internal server error creating product' });
  }
});

// Update product (Admin only)
app.put('/api/products/:id', verifyAdminToken, (req, res) => {
  try {
    const { id } = req.params;
    const { product } = req.body;
    if (!product) {
      res.status(400).json({ error: 'Product payload is required' });
      return;
    }

    const data = fs.readFileSync(productsFilePath, 'utf-8');
    const products = JSON.parse(data);

    const index = products.findIndex((p: any) => p.id === id);
    if (index === -1) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const updatedProduct = {
      ...products[index],
      ...product,
      id // preserve ID
    };

    products[index] = updatedProduct;
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    res.json(updatedProduct);
  } catch (error) {
    console.error('Failed to update product:', error);
    res.status(500).json({ error: 'Internal server error updating product' });
  }
});

// Delete product (Admin only)
app.delete('/api/products/:id', verifyAdminToken, (req, res) => {
  try {
    const { id } = req.params;
    const data = fs.readFileSync(productsFilePath, 'utf-8');
    const products = JSON.parse(data);

    const filtered = products.filter((p: any) => p.id !== id);
    if (products.length === filtered.length) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    fs.writeFileSync(productsFilePath, JSON.stringify(filtered, null, 2));
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Failed to delete product:', error);
    res.status(500).json({ error: 'Internal server error deleting product' });
  }
});

// Upload media file (Admin only)
app.post('/api/upload', verifyAdminToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    // Return relative url to file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ fileUrl });
  } catch (error) {
    console.error('Failed to upload file:', error);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

// Mounting Vite or static distribution based on environment
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });
  app.use(vite.middlewares);

  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Production serving from dist
  const distPath = path.resolve(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`CASHMERE KID$ Storefront running on http://localhost:${PORT}`);
});
