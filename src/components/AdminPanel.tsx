import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, getMusicMetadata } from './ProductCard';
import { PayhipService } from '../services/payhip';
import { 
  Plus, ArrowLeft, Image as ImageIcon, Music, HelpCircle, 
  Trash2, Edit, Eye, EyeOff, Star, ShieldCheck, Check, 
  Save, X, UploadCloud, FileAudio, Info, Disc, DollarSign, Lock, LogOut
} from 'lucide-react';

interface AdminPanelProps {
  onBackToStore: () => void;
  onRefreshCatalog: () => void;
}

export default function AdminPanel({ onBackToStore, onRefreshCatalog }: AdminPanelProps) {
  const [authToken, setAuthToken] = useState<string | null>('bypass_admin_token');
  
  // Dashboard & form states
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([]);

  // Navigation tab and received collaboration messages
  const [activeTab, setActiveTab] = useState<'catalog' | 'messages'>('catalog');
  const [messages, setMessages] = useState<any[]>([]);

  // Auth/Login states
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Upload progress states
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  useEffect(() => {
    verifyExistingSession();
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchProducts();
      fetchMessages();
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      if (activeTab === 'catalog') {
        fetchProducts();
      } else {
        fetchMessages();
      }
    }
  }, [activeTab]);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/admin/messages', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('Are you sure you want to permanently delete this artist collaboration message?')) return;
    try {
      const res = await fetch(`/api/admin/messages/${msgId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        fetchMessages();
      } else {
        alert('Failed to delete message.');
      }
    } catch (e) {
      alert('Error connecting to delete message.');
    }
  };

  const verifyExistingSession = async () => {
    setAuthToken('bypass_admin_token');
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleLogout = async () => {
    onBackToStore();
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to load products', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'artwork' | 'audio') => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Product title is required.');
      return;
    }

    let extractedMainKey = '';
    if (formPayhipLink.trim()) {
      extractedMainKey = PayhipService.extractProductCode(formPayhipLink);
    }

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

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ product: {
          title: formTitle,
          price: formPrice,
          payhipId: extractedMainKey || (finalVariants.length > 0 ? finalVariants[0].payhipId : ''),
          artwork: formArtwork,
          previewAudio: formPreviewAudio,
          licenseTerms: cleanedTerms,
          variants: finalVariants,
          visibility: formVisibility,
          featured: formFeatured
        }})
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
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track? This action is irreversible.')) return;

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
    setFormPayhipLink(prod.payhipId ? `https://payhip.com/b/${prod.payhipId}` : '');
    setFormArtwork(prod.artwork || '');
    setFormPreviewAudio(prod.previewAudio || '');
    
    let parsedTerms: string[] = [''];
    if (prod.licenseTerms) {
      if (Array.isArray(prod.licenseTerms)) {
        parsedTerms = prod.licenseTerms;
      } else {
        parsedTerms = [prod.licenseTerms];
      }
    }
    setFormLicenseTerms(parsedTerms);
    setFormVariants(prod.variants || []);
    setFormVisibility(prod.visibility !== false);
    setFormFeatured(!!prod.featured);
    setIsFormOpen(true);
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

  // 1. Render Lock screen if not authorized
  if (!authToken) {
    return (
      <div className="max-w-md mx-auto my-16 md:my-28 px-6 py-8 border border-white/10 bg-zinc-950/80 rounded-xl shadow-2xl relative z-10 text-center font-sans">
        <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/5">
          <Lock className="w-7 h-7" />
        </div>
        
        <span className="text-[10px] font-bold font-mono text-red-500 uppercase tracking-widest block">CREATOR CONSOLE</span>
        <h2 className="text-2xl font-black text-white uppercase mt-2">DASHBOARD LOCKED</h2>
        <p className="text-xs text-zinc-500 font-mono mt-1.5 uppercase tracking-wide">Enter the password to access admin tools</p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password..."
              className="w-full bg-zinc-900 border border-white/10 px-4 py-3.5 pr-12 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-sm font-sans"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer bg-transparent border-none"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {authError && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 font-mono text-[10px] uppercase font-bold rounded">
              ⚠️ {authError}
            </div>
          )}

          {authSuccess && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 font-mono text-[10px] uppercase font-bold rounded">
              {authSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={authenticating}
            className="btn-primary w-full py-4 text-xs font-black font-mono tracking-widest uppercase cursor-pointer border-none flex items-center justify-center gap-2"
          >
            {authenticating ? (
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
            ) : 'VERIFY PASSWORD'}
          </button>
        </form>

        <button
          onClick={onBackToStore}
          className="mt-6 text-[10px] font-bold font-mono text-zinc-500 hover:text-white uppercase tracking-widest bg-transparent border-none cursor-pointer"
        >
          ← CANCEL & RETURN TO STOREFRONT
        </button>
      </div>
    );
  }

  // 2. Render Full Dashboard once unlocked
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 relative z-10 animate-fade-in font-sans">
      
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8 mb-8">
        <div>
          <span className="text-[10px] font-bold font-mono text-red-500 uppercase tracking-widest">
            PRODUCER HUB
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white uppercase mt-1">
            CREATOR DASHBOARD
          </h1>
          <p className="text-[10px] font-mono text-zinc-500 uppercase mt-1.5">
            CASHMERE MUSIC GROUP · CONTROL CENTER
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={openAddForm}
            className="btn-primary px-6 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border-none"
          >
            <Plus className="w-4 h-4" /> ADD NEW TRACK
          </button>
          <button
            onClick={onBackToStore}
            className="btn-secondary px-6 py-3.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> STOREFRONT
          </button>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-zinc-950/60 p-5 border border-white/10 rounded-lg font-mono">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Total Beats</span>
          <span className="text-2xl font-black text-white mt-1.5 block">{products.length} Tracks</span>
        </div>
        <div className="bg-zinc-950/60 p-5 border border-white/10 rounded-lg font-mono">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Storefront Visibility</span>
          <span className="text-2xl font-black text-emerald-500 mt-1.5 block">
            {products.filter(p => p.visibility !== false).length} Online
          </span>
        </div>
        <div className="bg-zinc-950/60 p-5 border border-white/10 rounded-lg font-mono">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Featured Spotlight</span>
          <span className="text-2xl font-black text-yellow-500 mt-1.5 block">
            {products.filter(p => p.featured).length} Highlighted
          </span>
        </div>
        <div className="bg-zinc-950/60 p-5 border border-white/10 rounded-lg font-mono">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Platform Status</span>
          <span className="text-2xl font-black text-red-500 mt-1.5 block">SECURE</span>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-8">
        <button 
          onClick={() => setActiveTab('catalog')}
          className={`px-5 py-3 font-mono text-xs font-bold uppercase transition-all cursor-pointer relative ${activeTab === 'catalog' ? 'border-b-2 border-red-500 text-white' : 'text-zinc-500 hover:text-white bg-transparent border-none'}`}
        >
          Catalog Management
        </button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={`px-5 py-3 font-mono text-xs font-bold uppercase transition-all cursor-pointer relative flex items-center gap-2 ${activeTab === 'messages' ? 'border-b-2 border-red-500 text-white' : 'text-zinc-500 hover:text-white bg-transparent border-none'}`}
        >
          Collaboration Inbox
          {messages.length > 0 && (
            <span className="bg-red-600 text-white text-[9px] font-black font-mono px-1.5 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'catalog' ? (
        /* Manage Catalog Table */
        <div className="space-y-4">
          <h2 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider mb-2">
            MANAGE CATALOG ({products.length} TOTAL RELEASED)
          </h2>

          {loading ? (
            <div className="py-16 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              Loading catalog data...
            </div>
          ) : products.length === 0 ? (
            <div className="border border-dashed border-white/10 p-16 text-center rounded-lg bg-zinc-950/20 text-zinc-500 font-mono text-xs uppercase tracking-widest">
              <Music className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
              The catalog is currently empty. Add some tracks above!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {products.map((prod) => {
                const meta = getMusicMetadata(prod.title || '');
                return (
                  <div 
                    key={prod.id} 
                    className="border border-white/5 bg-zinc-950 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-200 hover:border-white/10 hover:bg-zinc-900/40 rounded-lg"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 bg-zinc-900 border border-white/10 rounded overflow-hidden flex-shrink-0 relative">
                        {prod.artwork ? (
                          <img src={prod.artwork} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-zinc-700 absolute inset-0 m-auto" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-white uppercase tracking-tight truncate leading-snug">
                          {prod.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 font-mono text-[10px] text-zinc-500 font-bold uppercase">
                          <span>{meta.bpm} BPM</span>
                          <span>·</span>
                          <span className="text-red-500">{meta.key}</span>
                          <span>·</span>
                          {prod.variants && prod.variants.length > 0 ? (
                            <span className="text-zinc-400 font-sans">( {prod.variants.length} Licenses )</span>
                          ) : (
                            <span className="text-zinc-400 font-sans">( ${prod.price || '0.00'} )</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 flex-wrap md:flex-nowrap justify-between md:justify-end">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleQuickToggle(prod, 'visibility')}
                          className={`px-3 py-2 border font-mono text-[10px] font-bold uppercase transition-all rounded cursor-pointer flex items-center gap-1.5 ${
                            prod.visibility !== false 
                              ? 'border-emerald-600/30 bg-emerald-950/10 text-emerald-400 hover:bg-emerald-950/20' 
                              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
                          }`}
                          title={prod.visibility !== false ? 'Visible on storefront' : 'Hidden'}
                        >
                          {prod.visibility !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {prod.visibility !== false ? 'VISIBLE' : 'HIDDEN'}
                        </button>

                        <button
                          onClick={() => handleQuickToggle(prod, 'featured')}
                          className={`px-3 py-2 border font-mono text-[10px] font-bold uppercase transition-all rounded cursor-pointer flex items-center gap-1.5 ${
                            prod.featured 
                              ? 'border-yellow-600/30 bg-yellow-950/10 text-yellow-400 hover:bg-yellow-950/20 shadow-lg' 
                              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700'
                          }`}
                          title={prod.featured ? 'Featured inside spotlight banner' : 'Standard catalog'}
                        >
                          <Star className={`w-3.5 h-3.5 ${prod.featured ? 'fill-current text-yellow-400' : ''}`} />
                          {prod.featured ? 'FEATURED' : 'STANDARD'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditForm(prod)}
                          className="p-2 border border-white/10 hover:border-white rounded text-zinc-400 hover:text-white transition-colors cursor-pointer bg-transparent"
                          title="Edit track specifications"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-2 border border-red-950/30 bg-red-950/10 text-red-400 hover:bg-red-950/30 hover:border-red-700 rounded transition-colors cursor-pointer"
                          title="Delete track"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Collaboration Inbox view */
        <div className="space-y-4">
          <h2 className="text-xs font-bold font-mono text-zinc-400 uppercase tracking-wider mb-2">
            RECEIVED COLLABORATIONS & DEMOS ({messages.length} INCOMING)
          </h2>

          {messages.length === 0 ? (
            <div className="border border-dashed border-white/10 p-16 text-center rounded-lg bg-zinc-950/20 text-zinc-500 font-mono text-xs uppercase tracking-widest">
              <UploadCloud className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
              The inbox is currently empty. Artist inquiries will appear here!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className="border border-white/5 bg-zinc-950 p-5 rounded-lg flex flex-col justify-between gap-4 hover:border-white/15 hover:bg-zinc-900/20 transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-3">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-red-500 uppercase tracking-widest">
                        {msg.subject}
                      </span>
                      <h3 className="text-base font-extrabold text-white mt-0.5 leading-snug">
                        {msg.name}
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        Email: <a href={`mailto:${msg.email}`} className="underline text-red-400 hover:text-red-300">{msg.email}</a>
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(msg.createdAt).toLocaleDateString()} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1.5 border border-red-950/30 bg-red-950/5 text-red-400 hover:bg-red-950/35 hover:border-red-700 rounded transition-colors cursor-pointer"
                        title="Delete inquiry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap bg-black/40 p-4 border border-white/5 rounded">
                    {msg.message}
                  </p>

                  {/* Audio player if vocal demo is attached */}
                  {msg.audioUrl ? (
                    <div className="bg-zinc-900/60 p-4 border border-white/5 rounded-lg">
                      <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                        <FileAudio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        VOCAL REFERENCE DEMO ATTACHED
                      </span>
                      <audio 
                        src={msg.audioUrl} 
                        controls 
                        className="w-full h-8 accent-red-600 font-mono" 
                        title="Vocal Demo Preview"
                      />
                    </div>
                  ) : (
                    <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest block text-right mt-1">
                      No vocal reference attached
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Uploader modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-filter backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-zinc-900 p-5 md:p-6 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold font-mono text-red-500 uppercase tracking-widest">PUBLISH SOUNDS</span>
                <h3 className="text-lg md:text-xl font-black text-white mt-1 uppercase">
                  {editingProduct ? 'EDIT TRACK METADATA' : 'UPLOADER WIZARD'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-white/10 text-zinc-400 hover:text-white rounded-full transition-colors cursor-pointer border-none bg-transparent"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form scrollable body */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
              
              {/* Media assets */}
              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-white/5">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <UploadCloud className="w-4 h-4 text-red-500" /> 1. MEDIA ASSETS
                </h4>
                
                {/* Audio Upload */}
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    Audio Preview File (MP3, M4A, ZIP)
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-black/35 p-4 border border-white/5 rounded">
                    <input
                      type="file"
                      accept=".mp3,.m4a,.zip"
                      onChange={(e) => handleFileUpload(e, 'audio')}
                      className="hidden"
                      id="audio-file-input"
                    />
                    <label
                      htmlFor="audio-file-input"
                      className="btn-secondary px-4 py-2.5 text-xs font-mono font-bold uppercase transition-colors tracking-widest cursor-pointer flex items-center gap-2 flex-shrink-0"
                    >
                      <FileAudio className="w-4 h-4 text-red-500" />
                      {uploadingAudio ? 'UPLOADING...' : 'BROWSE PREVIEW FILE'}
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formPreviewAudio ? '✓ Loaded' : 'Accepts MP3, M4A or ZIP archives.'}
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formPreviewAudio}
                    onChange={(e) => setFormPreviewAudio(e.target.value)}
                    placeholder="Or paste preview file URL directly..."
                    className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-sans"
                  />
                </div>

                {/* Artwork Upload */}
                <div className="space-y-2.5 mt-4">
                  <label className="block text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    Artwork Cover Image
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-black/35 p-4 border border-white/5 rounded">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'artwork')}
                      className="hidden"
                      id="artwork-file-input"
                    />
                    <label
                      htmlFor="artwork-file-input"
                      className="btn-secondary px-4 py-2.5 text-xs font-mono font-bold uppercase transition-colors tracking-widest cursor-pointer flex items-center gap-2 flex-shrink-0"
                    >
                      <ImageIcon className="w-4 h-4 text-red-500" />
                      {uploadingArtwork ? 'UPLOADING...' : 'BROWSE COVER ART'}
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formArtwork ? '✓ Loaded' : 'Accepts JPG or PNG files.'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formArtwork}
                    onChange={(e) => setFormArtwork(e.target.value)}
                    placeholder="Or paste artwork cover image URL..."
                    className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-sans"
                  />
                </div>
              </div>

              {/* Title & Pricing */}
              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-white/5">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Info className="w-4 h-4 text-red-500" /> 2. TRACK INFORMATION
                </h4>
                
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    Track Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Vintage Heartbeat"
                    className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                      Default License Price ($)
                    </label>
                    <input
                      type="text"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="e.g. 29.99"
                      className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                      Default Payhip Link
                    </label>
                    <input
                      type="text"
                      value={formPayhipLink}
                      onChange={(e) => setFormPayhipLink(e.target.value)}
                      placeholder="e.g. https://payhip.com/b/XXXX"
                      className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-sans"
                    />
                  </div>
                </div>

                {formPayhipLink && (
                  <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 mt-1 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded">
                    <Check className="w-3.5 h-3.5" /> Extracted Product Key: <span className="font-bold underline">{PayhipService.extractProductCode(formPayhipLink) || 'None found'}</span>
                  </div>
                )}
              </div>

              {/* License Terms */}
              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-white/5">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-red-500" /> 3. MAIN LICENSE TERMS
                  </h4>
                  <button
                    type="button"
                    onClick={() => setFormLicenseTerms([...formLicenseTerms, ''])}
                    className="text-[9px] font-bold px-2.5 py-1.5 border border-white/20 hover:border-white rounded hover:bg-white/5 font-mono uppercase tracking-wider cursor-pointer text-white"
                  >
                    + ADD TERM
                  </button>
                </div>
                
                <div className="space-y-2">
                  {formLicenseTerms.map((term, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={term}
                        onChange={(e) => {
                          const updated = [...formLicenseTerms];
                          updated[index] = e.target.value;
                          setFormLicenseTerms(updated);
                        }}
                        placeholder={`License term (e.g. Commercial Spotify Streams up to 10k)`}
                        className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded placeholder-zinc-700 text-xs font-sans"
                      />
                      {formLicenseTerms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...formLicenseTerms];
                            updated.splice(index, 1);
                            setFormLicenseTerms(updated);
                          }}
                          className="text-red-400 hover:text-red-300 font-mono font-bold text-xs uppercase px-2.5 py-2 cursor-pointer border-none bg-transparent"
                          title="Remove"
                        >
                          [X]
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Product variants */}
              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-lg border border-white/5">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <div>
                    <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Disc className="w-4 h-4 text-red-500" /> 4. MULTI-LICENSE VARIANTS
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantBox}
                    className="text-[9px] font-bold px-2.5 py-1.5 border border-white/20 hover:border-white rounded hover:bg-white/5 font-mono uppercase tracking-wider cursor-pointer text-white"
                  >
                    + ADD VARIANT
                  </button>
                </div>

                {formVariants.length > 0 ? (
                  <div className="space-y-4">
                    {formVariants.map((variant, index) => (
                      <div key={index} className="border border-white/15 p-4 rounded-lg bg-black/40 relative space-y-3">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">
                            LICENSE VARIANT #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeVariantBox(index)}
                            className="text-red-400 hover:text-red-300 font-mono text-[10px] font-bold uppercase cursor-pointer border-none bg-transparent"
                          >
                            [REMOVE VARIANT]
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                              Variant License Name
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Premium WAV License"
                              value={variant.name}
                              onChange={(e) => handleVariantFieldChange(index, 'name', e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 px-3 py-2 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-sans"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                              Variant Price ($)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 49.99"
                              value={variant.price}
                              onChange={(e) => handleVariantFieldChange(index, 'price', e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 px-3 py-2 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                            Variant Payhip Product Link
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. https://payhip.com/b/YYYY"
                            value={variant.payhipLink}
                            onChange={(e) => handleVariantFieldChange(index, 'payhipLink', e.target.value)}
                            className="w-full bg-zinc-900 border border-white/10 px-3 py-2 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-sans"
                          />
                          {variant.payhipId && (
                            <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
                              ✓ Auto-Extracted Product Key: {variant.payhipId}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                            Variant Description / License Features
                          </label>
                          <textarea
                            placeholder="e.g. Included WAV and MP3 file. Unlimited Streams..."
                            value={variant.description || ''}
                            onChange={(e) => handleVariantFieldChange(index, 'description', e.target.value)}
                            rows={2}
                            className="w-full bg-zinc-900 border border-white/10 px-3 py-2 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-sans"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-white/10 p-5 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest rounded-lg">
                    No custom tiered licenses defined. Default BeatStars tiers will apply.
                  </div>
                )}
              </div>

              {/* Visibility and Featured settings */}
              <div className="flex flex-col sm:flex-row gap-6 p-4 bg-zinc-900/40 rounded-lg border border-white/5">
                <label className="flex items-center gap-3 font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formVisibility}
                    onChange={(e) => setFormVisibility(e.target.checked)}
                    className="w-5 h-5 bg-zinc-900 border border-white/10 text-white rounded cursor-pointer accent-red-600"
                  />
                  VISIBLE ON STOREFRONT
                </label>

                <label className="flex items-center gap-3 font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFeatured}
                    onChange={(e) => setFormFeatured(e.target.checked)}
                    className="w-5 h-5 bg-zinc-900 border border-white/10 text-white rounded cursor-pointer accent-red-600"
                  />
                  ★ SPOTLIGHT HIGHLIGHT (FEATURED)
                </label>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="btn-secondary px-6 py-3.5 text-xs font-bold font-mono tracking-widest uppercase cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-primary px-10 py-3.5 text-xs font-black font-mono tracking-widest uppercase cursor-pointer border-none"
                >
                  SAVE TRACK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
