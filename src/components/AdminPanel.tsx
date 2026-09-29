import React, { useState, useEffect } from 'react';
import { Product, ProductVariant } from './ProductCard';
import { PayhipService } from '../services/payhip';

interface AdminPanelProps {
  onBackToStore: () => void;
  onRefreshCatalog: () => void;
}

export default function AdminPanel({ onBackToStore, onRefreshCatalog }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('cashmere_admin_token');
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Clean Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPayhipLink, setFormPayhipLink] = useState('');
  const [formArtwork, setFormArtwork] = useState('');
  const [formPreviewAudio, setFormPreviewAudio] = useState('');
  const [formLicenseTerms, setFormLicenseTerms] = useState<string[]>(['']);
  const [formVisibility, setFormVisibility] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  
  // Product Variants state
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([]);

  // Upload progress states
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  useEffect(() => {
    if (authToken) {
      fetchProducts();
    }
  }, [authToken]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to load products', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        localStorage.setItem('cashmere_admin_token', data.token);
        setPassword('');
      } else {
        setError(data.error || 'Incorrect password.');
      }
    } catch (e) {
      setError('Connection failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    localStorage.removeItem('cashmere_admin_token');
    setProducts([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'artwork' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extensions
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (type === 'audio' && ext === 'wav') {
      alert('WAV files are not supported. Please upload an MP3, M4A, or ZIP archive.');
      return;
    }

    const setUploading = type === 'artwork' ? setUploadingArtwork : setUploadingAudio;
    const setUrlField = type === 'artwork' ? setFormArtwork : setFormPreviewAudio;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.fileUrl) {
        setUrlField(data.fileUrl);
      } else {
        alert(data.error || 'Upload failed.');
      }
    } catch (err) {
      alert('Network failure uploading file.');
    } finally {
      setUploading(false);
    }
  };

  const openAddForm = () => {
    setEditingProduct(null);
    setFormTitle('');
    setFormPrice('');
    setFormPayhipLink('');
    setFormArtwork('');
    setFormPreviewAudio('');
    setFormLicenseTerms(['']);
    setFormVariants([]);
    setFormVisibility(true);
    setFormFeatured(false);
    setIsFormOpen(true);
  };

  const openEditForm = (prod: Product) => {
    setEditingProduct(prod);
    setFormTitle(prod.title || '');
    setFormPrice(prod.price || '');
    // Reconstruct Payhip URL from stored key if link is not directly saved
    setFormPayhipLink(prod.payhipId ? `https://payhip.com/b/${prod.payhipId}` : '');
    setFormArtwork(prod.artwork || '');
    setFormPreviewAudio(prod.previewAudio || '');
    
    // Parse license terms safely
    let parsedTerms: string[] = [''];
    if (prod.licenseTerms) {
      if (Array.isArray(prod.licenseTerms)) {
        parsedTerms = prod.licenseTerms;
      } else {
        parsedTerms = [prod.licenseTerms];
      }
    }
    setFormLicenseTerms(parsedTerms);
    
    // Set variants
    setFormVariants(prod.variants || []);
    
    setFormVisibility(prod.visibility !== false);
    setFormFeatured(!!prod.featured);
    setIsFormOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Product title is required.');
      return;
    }

    // Main single configuration fallback defaults (optional if variants are filled)
    let extractedMainKey = '';
    if (formPayhipLink.trim()) {
      extractedMainKey = PayhipService.extractProductCode(formPayhipLink);
    }

    // Validate variants if they exist
    const finalVariants = [...formVariants];
    for (const variant of finalVariants) {
      if (!variant.name.trim() || !variant.price.trim() || !variant.payhipLink.trim()) {
        alert('Please fill out Name, Price, and Payhip Link for all variants, or remove empty variant blocks.');
        return;
      }
      const key = PayhipService.extractProductCode(variant.payhipLink);
      if (!key) {
        alert(`Could not extract a valid Payhip key for variant: ${variant.name}`);
        return;
      }
      variant.payhipId = key;
    }

    const cleanedTerms = formLicenseTerms.map(t => t.trim()).filter(Boolean);

    setLoading(true);
    const productData = {
      title: formTitle,
      price: formPrice,
      payhipId: extractedMainKey || (finalVariants.length > 0 ? finalVariants[0].payhipId : ''),
      artwork: formArtwork,
      previewAudio: formPreviewAudio,
      licenseTerms: cleanedTerms,
      variants: finalVariants,
      visibility: formVisibility,
      featured: formFeatured
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ product: productData })
      });

      if (res.ok) {
        setIsFormOpen(false);
        fetchProducts();
        onRefreshCatalog();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save product.');
      }
    } catch (err) {
      alert('Network error saving product.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action is irreversible.')) return;

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        fetchProducts();
        onRefreshCatalog();
      } else {
        alert('Failed to delete product.');
      }
    } catch (e) {
      alert('Connection error deleting product.');
    }
  };

  const handleQuickToggle = async (prod: Product, field: 'visibility' | 'featured') => {
    const updatedVal = !prod[field];
    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          product: {
            [field]: updatedVal
          }
        })
      });
      if (res.ok) {
        fetchProducts();
        onRefreshCatalog();
      }
    } catch (e) {
      console.error('Failed to toggle status', e);
    }
  };

  const addVariantBox = () => {
    setFormVariants([...formVariants, { name: '', description: '', price: '', payhipLink: '', payhipId: '' }]);
  };

  const removeVariantBox = (index: number) => {
    const updated = [...formVariants];
    updated.splice(index, 1);
    setFormVariants(updated);
  };

  const handleVariantFieldChange = (index: number, field: keyof ProductVariant, value: string) => {
    const updated = [...formVariants];
    const extKey = field === 'payhipLink' ? PayhipService.extractProductCode(value) : updated[index].payhipId;
    updated[index] = {
      ...updated[index],
      [field]: value,
      payhipId: extKey
    };
    setFormVariants(updated);
  };

  // Login UI
  if (!authToken) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-md bg-zinc-950 border border-white/15 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <span className="brand-mark inline-flex items-center justify-center p-2 border border-white font-bold tracking-tighter text-xs w-10 h-10 mb-4">
              CK$
            </span>
            <h2 className="text-xl font-bold tracking-widest font-mono uppercase text-white">
              CASHMERE KID$ PORTAL
            </h2>
            <p className="text-xs text-zinc-500 uppercase font-mono mt-1">Lightweight Product Control</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">
                ADMIN KEY PASSWORD
              </label>
              <input
                type="password"
                required
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-600 text-sm"
              />
            </div>

            {error && (
              <div className="text-xs font-bold text-red-500 font-mono bg-red-950/20 border border-red-900/40 p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-zinc-200 text-black text-xs font-bold tracking-widest uppercase py-4 transition-colors font-mono cursor-pointer disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'ACCESS CONTROL PANEL'}
            </button>
          </form>

          <button
            onClick={onBackToStore}
            className="w-full text-center text-xs font-bold font-mono text-zinc-500 hover:text-white transition-colors uppercase mt-6 tracking-widest"
          >
            ← CANCEL AND VIEW STORE
          </button>
        </div>
      </div>
    );
  }

  // Simplified Dashboard View
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative z-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8 mb-8">
        <div>
          <span className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-widest">
            MANAGEMENT CONSOLE
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white uppercase mt-1">
            PRODUCT CONTROL
          </h1>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={openAddForm}
            className="px-6 py-4 bg-white text-black hover:bg-zinc-200 text-xs font-bold tracking-widest uppercase transition-colors rounded-none cursor-pointer"
          >
            + ADD NEW PRODUCT
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-4 border border-white/20 hover:border-white text-xs font-bold tracking-widest uppercase text-zinc-400 hover:text-white transition-all rounded-none cursor-pointer"
          >
            LOGOUT
          </button>
          <button
            onClick={onBackToStore}
            className="px-6 py-4 bg-zinc-900 border border-white/10 hover:border-white text-xs font-bold tracking-widest uppercase text-zinc-300 transition-all rounded-none cursor-pointer"
          >
            VIEW STOREFRONT
          </button>
        </div>
      </div>

      {/* Simplified product listing grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider mb-2">
          CURRENT CATALOG ({products.length} PRODUCTS)
        </h2>

        {products.length === 0 ? (
          <div className="border border-dashed border-white/10 p-12 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
            The catalog is empty. Click "+ ADD NEW PRODUCT" above to populate the storefront!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {products.map((prod) => (
              <div 
                key={prod.id} 
                className="border border-white/10 bg-zinc-950/60 p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-200 hover:border-white/20"
              >
                {/* Product Detail Layout */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 bg-zinc-900 border border-white/10 flex-shrink-0 relative overflow-hidden">
                    {prod.artwork ? (
                      <img src={prod.artwork} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-zinc-700 font-bold block text-center mt-6">NO ART</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white uppercase tracking-tight truncate">{prod.title}</h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                      {prod.variants && prod.variants.length > 0 ? (
                        <span>Variants: {prod.variants.map(v => `${v.name} ($${v.price})`).join(', ')}</span>
                      ) : (
                        <span>Price: ${prod.price || '0.00'} · Payhip ID: {prod.payhipId || 'Unlinked'}</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Actions and Status Controls */}
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-between md:justify-end">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleQuickToggle(prod, 'visibility')}
                      className={`px-3 py-2 border font-mono text-[10px] font-bold uppercase transition-all rounded-none cursor-pointer ${
                        prod.visibility !== false 
                          ? 'border-emerald-600/40 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-950/20' 
                          : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      {prod.visibility !== false ? 'VISIBLE' : 'HIDDEN'}
                    </button>

                    <button
                      onClick={() => handleQuickToggle(prod, 'featured')}
                      className={`px-3 py-2 border font-mono text-[10px] font-bold uppercase transition-all rounded-none cursor-pointer ${
                        prod.featured 
                          ? 'border-yellow-600/40 bg-yellow-950/10 text-yellow-400 hover:bg-yellow-950/20' 
                          : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
                      }`}
                    >
                      {prod.featured ? '★ FEATURED' : '☆ UNFEATURED'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditForm(prod)}
                      className="px-4 py-2 border border-white/25 hover:border-white text-xs font-bold tracking-wider uppercase text-white transition-all rounded-none cursor-pointer"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="px-4 py-2 border border-red-900/30 bg-red-950/10 text-red-400 hover:bg-red-950/30 hover:border-red-700 text-xs font-bold tracking-wider uppercase transition-all rounded-none cursor-pointer"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simplified Product Uploader Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-filter backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-zinc-950 border border-white/15 w-full max-w-2xl p-6 md:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold font-mono uppercase tracking-widest text-white">
                {editingProduct ? 'EDIT CASHMERE KID$ PRODUCT' : 'NEW CASHMERE KID$ PRODUCT'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-500 hover:text-white font-mono text-xs uppercase cursor-pointer"
              >
                [CLOSE]
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              
              {/* 1. AUDIO / PRODUCT FILE */}
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  1. AUDIO / PRODUCT PREVIEW FILE (MP3, M4A, ZIP)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept=".mp3,.m4a,.zip"
                    onChange={(e) => handleFileUpload(e, 'audio')}
                    className="hidden"
                    id="audio-file-input"
                  />
                  <label
                    htmlFor="audio-file-input"
                    className="px-5 py-3 border border-white hover:bg-white hover:text-black text-xs font-mono font-bold uppercase transition-colors tracking-widest cursor-pointer flex-shrink-0 rounded-none"
                  >
                    {uploadingAudio ? 'UPLOADING...' : 'UPLOAD AUDIO/ZIP'}
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Accepts MP3, M4A or ZIP archives. (WAV not supported)</span>
                </div>
                <input
                  type="text"
                  required
                  value={formPreviewAudio}
                  onChange={(e) => setFormPreviewAudio(e.target.value)}
                  placeholder="Or paste preview file URL..."
                  className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm"
                />
              </div>

              {/* 2. PRODUCT TITLE */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  2. PRODUCT TITLE
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. In the Club"
                  className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm"
                />
              </div>

              {/* 3. MAIN PRICE */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  3. PRICE ($) (DEFAULT SINGLE OPTION PRICE)
                </label>
                <input
                  type="text"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="e.g. 29.99"
                  className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm"
                />
              </div>

              {/* 4. MAIN PAYHIP PRODUCT LINK */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  4. PAYHIP PRODUCT LINK (DEFAULT SINGLE OPTION LINK)
                </label>
                <input
                  type="text"
                  value={formPayhipLink}
                  onChange={(e) => setFormPayhipLink(e.target.value)}
                  placeholder="Paste your normal Payhip product or sharing URL (e.g., https://payhip.com/b/XXXX)"
                  className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm"
                />
                {formPayhipLink && (
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-2 mt-1 bg-emerald-950/20 border border-emerald-900/30 p-2">
                    <span>✓</span> Extracted Product Key: <span className="font-bold underline">{PayhipService.extractProductCode(formPayhipLink) || 'None found'}</span>
                  </div>
                )}
              </div>

              {/* 5. ARTWORK */}
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  5. ARTWORK COVER IMAGE
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'artwork')}
                    className="hidden"
                    id="artwork-file-input"
                  />
                  <label
                    htmlFor="artwork-file-input"
                    className="px-5 py-3 border border-white hover:bg-white hover:text-black text-xs font-mono font-bold uppercase transition-colors tracking-widest cursor-pointer flex-shrink-0 rounded-none"
                  >
                    {uploadingArtwork ? 'UPLOADING...' : 'UPLOAD IMAGE'}
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">Accepts JPG or PNG files.</span>
                </div>
                <input
                  type="text"
                  value={formArtwork}
                  onChange={(e) => setFormArtwork(e.target.value)}
                  placeholder="Or paste artwork cover image URL..."
                  className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm"
                />
              </div>

              {/* 6. LICENSE TERMS REDESIGNED MULTI-BOX WORKFLOW */}
              <div className="space-y-3">
                <label className="block text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                  <span>6. MAIN LICENSE TERMS</span>
                  <button
                    type="button"
                    onClick={() => setFormLicenseTerms([...formLicenseTerms, ''])}
                    className="text-[10px] px-3 py-1.5 border border-white/20 hover:border-white hover:bg-white/5 font-mono uppercase tracking-wider cursor-pointer text-white"
                  >
                    + ADD TERM BOX
                  </button>
                </label>
                
                <div className="space-y-2">
                  {formLicenseTerms.map((term, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        required
                        value={term}
                        onChange={(e) => {
                          const updated = [...formLicenseTerms];
                          updated[index] = e.target.value;
                          setFormLicenseTerms(updated);
                        }}
                        placeholder={`License term #${index + 1} (e.g. Keep 100% of store sales)`}
                        className="w-full bg-zinc-900 border border-white/10 px-4 py-3 text-white focus:border-white focus:outline-none transition-colors rounded-none placeholder-zinc-700 text-sm font-sans"
                      />
                      {formLicenseTerms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...formLicenseTerms];
                            updated.splice(index, 1);
                            setFormLicenseTerms(updated);
                          }}
                          className="text-red-400 hover:text-red-300 font-mono font-bold text-sm uppercase px-3 py-2 cursor-pointer"
                          title="Remove term box"
                        >
                          [X]
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PRODUCT VARIANTS / LICENSE OPTIONS SECTION */}
              <div className="space-y-4 border-t border-b border-white/10 py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold font-mono uppercase text-white tracking-wider">
                      PRODUCT VARIANTS / LICENSE OPTIONS
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">
                      Configure multiple license purchase tiers (Payhip multi-license setup)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantBox}
                    className="px-4 py-2 bg-zinc-900 border border-white/20 hover:border-white hover:bg-white/5 text-[10px] font-mono uppercase tracking-widest text-white cursor-pointer"
                  >
                    + ADD VARIANT
                  </button>
                </div>

                {formVariants.length > 0 ? (
                  <div className="space-y-6">
                    {formVariants.map((variant, index) => (
                      <div key={index} className="border border-white/10 p-5 bg-zinc-950/60 relative space-y-4">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                            VARIANT #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeVariantBox(index)}
                            className="text-red-400 hover:text-red-300 font-mono text-xs font-bold uppercase cursor-pointer"
                          >
                            [REMOVE VARIANT]
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Variant Name */}
                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                              Variant Name (e.g. Premium License)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Premium License"
                              value={variant.name}
                              onChange={(e) => handleVariantFieldChange(index, 'name', e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-white focus:outline-none transition-colors rounded-none text-xs"
                            />
                          </div>

                          {/* Price */}
                          <div className="space-y-1.5">
                            <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                              Price ($)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 59.99"
                              value={variant.price}
                              onChange={(e) => handleVariantFieldChange(index, 'price', e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-white focus:outline-none transition-colors rounded-none text-xs"
                            />
                          </div>
                        </div>

                        {/* Payhip URL with auto key extract */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                            Payhip Product Link
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Paste Payhip URL (e.g., https://payhip.com/b/YYYY)"
                            value={variant.payhipLink}
                            onChange={(e) => handleVariantFieldChange(index, 'payhipLink', e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-white focus:outline-none transition-colors rounded-none text-xs"
                          />
                          {variant.payhipId && (
                            <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
                              ✓ Auto-Extracted Product Key: {variant.payhipId}
                            </div>
                          )}
                        </div>

                        {/* Description / License Terms Textarea */}
                        <div className="space-y-1.5">
                          <label className="block text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                            Description / License Terms
                          </label>
                          <textarea
                            placeholder="Enter complete terms and description for this specific license option..."
                            value={variant.description || ''}
                            onChange={(e) => handleVariantFieldChange(index, 'description', e.target.value)}
                            rows={3}
                            className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-white focus:outline-none transition-colors rounded-none text-xs font-sans"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 p-6 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                    No tiered variants defined. Click "+ ADD VARIANT" to add multiple customized purchase options.
                  </div>
                )}
              </div>

              {/* Visibility and Featured settings */}
              <div className="flex items-center gap-8 py-2 py-4">
                <label className="flex items-center gap-3 font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formVisibility}
                    onChange={(e) => setFormVisibility(e.target.checked)}
                    className="w-5 h-5 bg-zinc-900 border border-white/10 text-white rounded-none focus:ring-0 cursor-pointer"
                  />
                  VISIBLE ON STOREFRONT
                </label>

                <label className="flex items-center gap-3 font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="w-5 h-5 bg-zinc-900 border border-white/10 text-white rounded-none focus:ring-0 cursor-pointer"
                  />
                  ★ FEATURED SPOTLIGHT
                </label>
              </div>

              {/* 7. SAVE PRODUCT */}
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-6 py-4 border border-white/20 hover:border-white text-xs font-bold font-mono tracking-widest uppercase transition-all rounded-none cursor-pointer text-zinc-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-10 py-4 bg-white text-black hover:bg-zinc-200 text-xs font-extrabold font-mono tracking-widest uppercase transition-all rounded-none cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'SAVING PRODUCT...' : 'SAVE PRODUCT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
