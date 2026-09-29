import React, { useState, useEffect } from 'react';
import { PayhipService } from '../services/payhip';
import { Product } from './ProductCard';

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

  const hasVariants = product.variants && product.variants.length > 0;
  const mainCheckoutUrl = PayhipService.getCheckoutUrl(product.payhipId || '');

  useEffect(() => {
    PayhipService.refreshOverlay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product]);

  const isCurrentTrack = activeTrackId === product.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

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
        setShareText('COPIED TO CLIPBOARD');
        setTimeout(() => setShareText('SHARE THIS BEAT'), 2000);
      }
    } catch (_) {}
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-16 animate-fade-in relative z-10">
      {/* Back button */}
      <button 
        onClick={onBack} 
        className="mb-8 md:mb-12 inline-flex items-center gap-2 text-xs font-bold tracking-widest text-zinc-400 hover:text-white transition-colors duration-200 uppercase cursor-pointer"
      >
        <span>←</span> BACK TO CATALOG
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        {/* Left Column: Artwork & Player */}
        <div className="lg:col-span-5 space-y-8">
          <div className="relative aspect-square w-full max-w-md mx-auto lg:max-w-none border border-white/10 p-1 bg-zinc-950">
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-900">
              {product.artwork ? (
                <img 
                  className={`w-full h-full object-cover ${isCurrentlyPlaying ? 'reactive-artwork' : ''}`} 
                  src={product.artwork} 
                  alt={`${product.title} Cover Art`} 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 font-semibold tracking-wider text-sm">
                  NO ARTWORK SUPPLIED
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
              <div className="absolute left-4 top-4 bg-black/60 border border-white/40 px-3 py-1.5 font-bold font-mono text-xs tracking-wider">
                CK$ ORIGINAL
              </div>
              
              {/* Animated Fire Badge */}
              <div className="absolute right-4 top-4 z-10">
                <div className="fire-badge">
                  <div className="fire-animation">
                    <div className="fire-flame"></div>
                    <div className="fire-flame-inner"></div>
                    <div className="fire-particle"></div>
                    <div className="fire-particle-2"></div>
                  </div>
                  <span>HEAT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Wide Audio Player Module */}
          <div className="border border-white/10 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onPlayToggle(product)}
                className="w-16 h-16 flex items-center justify-center border border-white/80 hover:border-white hover:bg-white hover:text-black transition-all duration-300 rounded-none cursor-pointer"
                disabled={!product.previewAudio}
              >
                <span className="text-xl pl-1">{isCurrentlyPlaying ? 'Ⅱ' : '▶'}</span>
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono text-zinc-500 uppercase tracking-widest">PREVIEW PLAYER</div>
                <h4 className="text-lg font-bold tracking-tight text-white truncate">{product.title}</h4>
              </div>
              
              <div className="text-right font-mono text-sm text-zinc-400">
                {isCurrentTrack ? audioDurationText : '—:—'}
              </div>
            </div>

            {/* Custom interactive track timeline bar */}
            <div className="relative">
              <div className="waveform h-8 opacity-60" aria-hidden="true"></div>
              {isCurrentTrack && (
                <div 
                  className="absolute inset-x-0 bottom-0 top-0 bg-white/10 origin-left transition-transform duration-100 ease-linear" 
                  style={{ transform: `scaleX(${audioProgress / 100})` }}
                ></div>
              )}
            </div>

            {!product.previewAudio && (
              <p className="text-xs text-zinc-500 text-center uppercase font-mono tracking-wider">
                No audio preview available for this track.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Title, Metadata, Licensing, Checkout */}
        <div className="lg:col-span-7 space-y-8 md:space-y-12">
          <div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
              PREMIUM ORIGINAL PRODUCTION
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-white mt-2 uppercase font-sans">
              {product.title}
            </h1>
          </div>

          {/* License Terms Box */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase font-mono">LICENSE TERMS</h3>
            <div className="bg-zinc-950 p-6 border border-white/10 font-mono text-xs text-zinc-300 leading-relaxed max-h-80 overflow-y-auto space-y-2">
              {Array.isArray(product.licenseTerms) ? (
                product.licenseTerms.filter(Boolean).length > 0 ? (
                  product.licenseTerms.filter(Boolean).map((term, index) => (
                    <div key={index} className="flex items-start gap-2 bg-white/[0.02] p-2.5 border border-white/5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{term}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-500">Standard licensing terms apply to this premium release.</div>
                )
              ) : (
                <div className="flex items-start gap-2 bg-white/[0.02] p-2.5 border border-white/5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{product.licenseTerms || 'Standard licensing terms apply to this premium release.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Product Variants (License List Selection with Inline Buy Buttons) */}
          {hasVariants ? (
            <div className="space-y-4">
              <h3 className="text-xs font-bold tracking-wider text-zinc-400 uppercase font-mono">
                CHOOSE LICENSE OPTIONS
              </h3>
              
              <div className="space-y-3.5">
                {product.variants!.map((variant, idx) => {
                  const variantUrl = PayhipService.getCheckoutUrl(variant.payhipId);
                  return (
                    <div 
                      key={idx}
                      className="border border-white/10 p-5 bg-zinc-950/60 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-200 hover:border-white/25"
                    >
                      <div className="space-y-1 md:max-w-xl">
                        <span className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">LICENSE TYPE</span>
                        <h4 className="text-base font-bold text-white uppercase tracking-tight">{variant.name}</h4>
                        {variant.description && (
                          <p className="text-xs text-zinc-400 font-mono leading-relaxed mt-1.5 whitespace-pre-wrap bg-black/35 p-3 border border-white/5">{variant.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 flex-shrink-0 justify-between md:justify-end">
                        <span className="text-xl font-black font-mono text-white">${variant.price}</span>
                        <a 
                          className="px-6 py-3.5 bg-white text-black hover:bg-zinc-200 text-xs font-extrabold tracking-widest uppercase transition-all font-mono inline-flex items-center gap-1.5 rounded-none payhip-buy-button cursor-pointer"
                          href={variantUrl}
                          data-product={variant.payhipId}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (variantUrl === '#') {
                              e.preventDefault();
                              alert("Payhip variant product code missing.");
                            }
                          }}
                        >
                          BUY LICENSE ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Primary Purchase Module for Single Option products */
            <div className="border border-white/10 p-6 bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="text-xs font-bold font-mono text-zinc-500 uppercase tracking-wider">SECURE PAYHIP CHECKOUT</div>
                <h4 className="text-lg font-bold text-white mt-1 uppercase">
                  {product.title} — ${product.price || '0.00'}
                </h4>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleShare}
                  className="px-6 py-4 border border-white/30 hover:border-white text-xs font-bold tracking-widest uppercase transition-colors rounded-none cursor-pointer text-white"
                >
                  {shareText}
                </button>

                <a 
                  className="px-8 py-4 bg-white text-black hover:bg-zinc-200 text-xs font-extrabold tracking-widest uppercase transition-colors inline-flex items-center justify-center gap-2 rounded-none payhip-buy-button" 
                  href={mainCheckoutUrl}
                  data-product={product.payhipId}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (mainCheckoutUrl === '#') {
                      e.preventDefault();
                      alert("Payhip link not configured yet.");
                    }
                  }}
                >
                  PROCEED TO PAYHIP ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
