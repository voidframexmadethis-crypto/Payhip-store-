import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dotenv from 'dotenv';
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

// Middleware
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Admin authentication middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';

const verifyAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Admin access is not configured. Please set the ADMIN_PASSWORD environment variable.' });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header is missing' });
    return;
  }
  const token = authHeader.split(' ')[1];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid admin credentials' });
  }
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

// Verify admin credentials
app.post('/api/admin/verify', (req, res) => {
  if (!ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Admin access is not configured. Please set the ADMIN_PASSWORD environment variable.' });
    return;
  }
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
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
