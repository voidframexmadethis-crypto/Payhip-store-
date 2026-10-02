import React, { useState, useEffect } from 'react';
import { PayhipService } from '../services/payhip';
import LicenseModal from './LicenseModal';
import { Play, Pause, Share2, ShoppingCart, Activity, Music, Tag } from 'lucide-react';

export interface ProductVariant {
  name: string;
  description?: string;
  price: string;
  payhipLink: string;
  payhipId: string;
}

export interface Product {
  id: string;
  title: string;
  artwork?: string;
  previewAudio?: string;
  description?: string;
  price?: string;
  payhipId?: string;
  visibility?: boolean;
  featured?: boolean;
  licenseTerms?: string | string[];
  variants?: ProductVariant[];
}

interface ProductCardProps {
  product: Product;
  isPlaying: boolean;
  activeTrackId: string | null;
  onPlayToggle: (product: Product) => void;
  audioProgress: number; // 0 to 100
  audioDurationText: string;
}

// Deterministic helper to generate realistic music metadata for the storefront catalog
export function getMusicMetadata(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const bpms = [120, 128, 130, 135, 140, 142, 145, 150, 155, 160];
  const keys = ['C Minor', 'C# Minor', 'D Minor', 'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor', 'A Minor', 'A# Minor', 'B Minor'];
  const genres = ['Trap', 'Hip Hop', 'R&B', 'Pop', 'Drill'];

  const bpm = bpms[hash % bpms.length];
  const key = keys[hash % keys.length];
  const genre = genres[hash % genres.length];
  const tags = [genre, genre === 'Trap' ? '808' : genre === 'Hip Hop' ? 'BoomBap' : 'Melodic', 'CASHMERE'];

  return { bpm, key, genre, tags };
}

export default function ProductCard({
  product,
  isPlaying,
  activeTrackId,
  onPlayToggle,
  audioProgress,
  audioDurationText
}: ProductCardProps) {
  const [shareText, setShareText] = useState('SHARE');
  const [isLicenseOpen, setIsLicenseOpen] = useState(false);

  const metadata = getMusicMetadata(product.title || 'Untitled');
  const isCurrentTrack = activeTrackId === product.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  useEffect(() => {
    PayhipService.refreshOverlay();
  }, [product]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const beatUrl = `${window.location.origin}/beat/${product.id}`;
    const shareData = {
      title: product.title,
      text: `${product.title} — CASHMERE KID$ Original Production`,
      url: beatUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(beatUrl);
        setShareText('COPIED');
        setTimeout(() => setShareText('SHARE'), 1500);
      }
    } catch (_) {}
  };

  const navigateToDetail = () => {
    try {
      window.history.pushState(null, '', `/beat/${product.id}`);
      window.dispatchEvent(new Event('popstate'));
    } catch (_) {}
  };

  return (
    <>
      <article className="beat-card flex flex-col justify-between group h-full">
        {/* Artwork Layer */}
        <div 
          className="relative aspect-square w-full overflow-hidden bg-zinc-950 cursor-pointer"
          onClick={navigateToDetail}
        >
          {product.artwork ? (
            <img 
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isCurrentlyPlaying ? 'reactive-artwork' : ''}`} 
              src={product.artwork} 
              alt={`${product.title} artwork`} 
              loading="lazy" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border-b border-white/5 text-zinc-700">
              <Music className="w-12 h-12 text-zinc-800 mb-2" />
              <span className="text-xs font-bold font-mono tracking-wider">CASHMERE CATALOG</span>
            </div>
          )}
          
          {/* Black shadow scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 pointer-events-none" />

          {/* Key and BPM label overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2 font-mono text-[10px] tracking-wider font-bold">
            <span className="bg-black/85 text-white border border-white/10 px-2.5 py-1 rounded">
              {metadata.bpm} BPM
            </span>
            <span className="bg-black/85 text-red-500 border border-red-500/10 px-2.5 py-1 rounded">
              {metadata.key}
            </span>
          </div>

          {/* Quick Play Button Overlays */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayToggle(product);
              }}
              className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer border-none"
              aria-label={isCurrentlyPlaying ? "Pause beat" : "Play beat"}
            >
              {isCurrentlyPlaying ? (
                <Pause className="w-6 h-6 fill-white text-white" />
              ) : (
                <Play className="w-6 h-6 fill-white text-white ml-1" />
              )}
            </button>
          </div>

          {/* Fire / Featured badge */}
          {product.featured && (
            <div className="absolute top-3 right-3 z-10">
              <div className="bg-red-600/90 text-white border border-red-400/40 text-[10px] font-bold tracking-widest font-mono px-2 py-0.5 uppercase shadow-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                HOT
              </div>
            </div>
          )}
        </div>

        {/* Details and Actions area */}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            {/* Title & Artist */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 
                  onClick={navigateToDetail}
                  className="font-extrabold text-base text-white tracking-tight leading-snug truncate hover:text-red-500 transition-colors cursor-pointer"
                >
                  {product.title || 'Untitled'}
                </h3>
                <span className="text-xs font-semibold text-zinc-500 tracking-wide mt-0.5 block">
                  CASHMERE KID$
                </span>
              </div>
              <button 
                onClick={handleShare}
                className="p-1.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                title="Share link"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Dynamic unboxed Tags separator as required by visual guidelines */}
            <div className="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-zinc-400 font-bold tracking-wider uppercase leading-none">
              <Tag className="w-3 h-3 text-red-500 flex-shrink-0" />
              {metadata.tags.map((tag, i) => (
                <span key={tag} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-zinc-700">·</span>}
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Buy Action row */}
          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block leading-none">LICENSING FROM</span>
              <span className="text-lg font-black font-mono text-white mt-1 block">
                ${product.price || '29.99'}
              </span>
            </div>

            <button
              onClick={() => setIsLicenseOpen(true)}
              className="btn-primary flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer border-none"
            >
              <ShoppingCart className="w-4 h-4" />
              BUY
            </button>
          </div>
        </div>
      </article>

      {/* Embedded Licensing modal state */}
      {isLicenseOpen && (
        <LicenseModal 
          product={product} 
          onClose={() => setIsLicenseOpen(false)} 
        />
      )}
    </>
  );
}
