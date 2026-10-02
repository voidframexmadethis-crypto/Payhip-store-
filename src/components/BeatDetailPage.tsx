import React, { useState, useEffect } from 'react';
import { PayhipService } from '../services/payhip';
import { Product, getMusicMetadata } from './ProductCard';
import LicenseModal from './LicenseModal';
import { Play, Pause, Share2, ShoppingCart, Music, ArrowLeft, Disc, Calendar, Award, CheckCircle } from 'lucide-react';

interface BeatDetailPageProps {
  product: Product;
  isPlaying: boolean;
  activeTrackId: string | null;
  onPlayToggle: (product: Product) => void;
  audioProgress: number;
  audioDurationText: string;
  onBack: () => void;
}

export default function BeatDetailPage({
  product,
  isPlaying,
  activeTrackId,
  onPlayToggle,
  audioProgress,
  audioDurationText,
  onBack
}: BeatDetailPageProps) {
  const [shareText, setShareText] = useState('SHARE THIS BEAT');
  const [isLicenseOpen, setIsLicenseOpen] = useState(false);

  const metadata = getMusicMetadata(product.title || 'Untitled');
  const isCurrentTrack = activeTrackId === product.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  useEffect(() => {
    PayhipService.refreshOverlay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  const handleShare = async () => {
    const beatUrl = `${window.location.origin}/beat/${product.id}`;
    const shareData = {
      title: product.title,
      text: `${product.title} — Premium Production by CASHMERE KID$`,
      url: beatUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(beatUrl);
        setShareText('COPIED LINK!');
        setTimeout(() => setShareText('SHARE THIS BEAT'), 2000);
      }
    } catch (_) {}
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-16 animate-fade-in relative z-10">
      {/* Back button */}
      <button 
        onClick={onBack} 
        className="mb-8 md:mb-12 inline-flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 hover:text-white transition-colors duration-200 uppercase cursor-pointer border-none bg-transparent"
      >
        <ArrowLeft className="w-4 h-4" /> BACK TO STOREFRONT
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        
        {/* Left Column: Artwork Showcase & Quick Player */}
        <div className="lg:col-span-5 space-y-8">
          <div className="relative aspect-square w-full max-w-md mx-auto lg:max-w-none border border-white/10 p-1 bg-zinc-950 rounded-lg overflow-hidden group shadow-2xl">
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-900 rounded">
              {product.artwork ? (
                <img 
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-102 ${isCurrentlyPlaying ? 'reactive-artwork' : ''}`} 
                  src={product.artwork} 
                  alt={`${product.title} Cover Art`} 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-700">
                  <Music className="w-16 h-16 text-zinc-800 mb-2" />
                  <span className="text-sm font-bold font-mono tracking-wider">CASHMERE ORIGINAL</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
              
              {/* Hot badge overlay */}
              {product.featured && (
                <div className="absolute left-4 top-4 bg-red-600 border border-red-400/30 px-3 py-1.5 font-bold font-mono text-xs tracking-wider uppercase text-white shadow-lg">
                  POPULAR BEAT
                </div>
              )}
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => onPlayToggle(product)}
                  className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl border-none cursor-pointer"
                  disabled={!product.previewAudio}
                >
                  {isCurrentlyPlaying ? (
                    <Pause className="w-8 h-8 fill-white text-white" />
                  ) : (
                    <Play className="w-8 h-8 fill-white text-white ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Core Player Info card */}
          <div className="border border-white/10 bg-zinc-950 p-6 rounded-lg space-y-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onPlayToggle(product)}
                className="w-14 h-14 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 hover:border-white hover:bg-white hover:text-black transition-all duration-300 cursor-pointer"
                disabled={!product.previewAudio}
              >
                {isCurrentlyPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">PREVIEW DURATION</div>
                <h4 className="text-base font-bold tracking-tight text-white truncate uppercase">{product.title}</h4>
              </div>
              
              <div className="text-right font-mono text-sm text-zinc-400">
                {isCurrentTrack ? audioDurationText : '0:00 / 0:00'}
              </div>
            </div>

            {/* Simulated Progress waveform */}
            <div className="relative">
              <div className="waveform h-10 opacity-70" aria-hidden="true"></div>
              {isCurrentTrack && (
                <div 
                  className="absolute inset-x-0 bottom-0 top-0 bg-red-600/10 origin-left transition-transform duration-100 ease-linear" 
                  style={{ transform: `scaleX(${audioProgress / 100})` }}
                ></div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Title, Metadata Grid, Terms, CTA */}
        <div className="lg:col-span-7 space-y-8 md:space-y-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-widest font-mono">
              <Award className="w-4 h-4" /> ORIGINAL MUSIC CATALOGUE
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mt-3 uppercase font-sans">
              {product.title}
            </h1>
            <p className="text-sm font-semibold text-zinc-400 mt-2">
              Produced by <span className="text-white hover:text-red-500 transition-colors cursor-pointer">CASHMERE KID$</span>
            </p>
          </div>

          {/* Beat Metadata Table Row (BPM, Key, Release, Style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-zinc-950 border border-white/10 rounded-lg font-mono text-xs">
            <div className="bg-white/[0.02] p-4 border border-white/5 rounded">
              <span className="text-zinc-500 uppercase font-bold tracking-wider block">TEMPO</span>
              <span className="text-base font-black text-white mt-1.5 block">{metadata.bpm} BPM</span>
            </div>
            <div className="bg-white/[0.02] p-4 border border-white/5 rounded">
              <span className="text-zinc-500 uppercase font-bold tracking-wider block">KEY</span>
              <span className="text-base font-black text-red-500 mt-1.5 block">{metadata.key}</span>
            </div>
            <div className="bg-white/[0.02] p-4 border border-white/5 rounded">
              <span className="text-zinc-500 uppercase font-bold tracking-wider block">GENRE</span>
              <span className="text-base font-black text-white mt-1.5 block">{metadata.genre}</span>
            </div>
            <div className="bg-white/[0.02] p-4 border border-white/5 rounded">
              <span className="text-zinc-500 uppercase font-bold tracking-wider block">FORMAT</span>
              <span className="text-base font-black text-white mt-1.5 block">WAV/MP3</span>
            </div>
          </div>

          {/* Description Section if available */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-zinc-500 uppercase font-mono">PRODUCER NOTES</h3>
              <p className="text-sm text-zinc-300 font-sans leading-relaxed bg-zinc-950/40 p-5 border border-white/10 rounded-lg">
                {product.description}
              </p>
            </div>
          )}

          {/* Interactive licensing checkout block */}
          <div className="bg-zinc-950 border border-white/10 p-6 md:p-8 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block leading-none">STARTING LICENSE PRICE</span>
              <span className="text-3xl font-black font-mono text-white mt-2 block">
                ${product.price || '29.99'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5">
              <button 
                onClick={handleShare}
                className="btn-secondary px-6 py-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> {shareText}
              </button>

              <button
                onClick={() => setIsLicenseOpen(true)}
                className="btn-primary px-8 py-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
              >
                <ShoppingCart className="w-4 h-4" /> CHOOSE LICENSE OPTIONS
              </button>
            </div>
          </div>

          {/* License Terms Box */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-zinc-500 uppercase font-mono">STANDARD LICENSING TERMS</h3>
            <div className="bg-zinc-950/60 p-6 border border-white/10 rounded-lg font-mono text-xs text-zinc-400 leading-relaxed max-h-64 overflow-y-auto space-y-3">
              {Array.isArray(product.licenseTerms) ? (
                product.licenseTerms.filter(Boolean).length > 0 ? (
                  product.licenseTerms.filter(Boolean).map((term, index) => (
                    <div key={index} className="flex items-start gap-2.5 bg-black/30 p-2.5 border border-white/5 rounded">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{term}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600">Standard licensing agreements apply to this track. Contact producer for custom arrangements.</div>
                )
              ) : (
                <div className="flex items-start gap-2.5 bg-black/30 p-2.5 border border-white/5 rounded">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{product.licenseTerms || 'Standard licensing agreements apply to this track. Contact producer for custom arrangements.'}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Embedded Licensing modal state */}
      {isLicenseOpen && (
        <LicenseModal 
          product={product} 
          onClose={() => setIsLicenseOpen(false)} 
        />
      )}
    </div>
  );
}
