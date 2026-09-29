import React, { useState, useEffect } from 'react';
import { PayhipService } from '../services/payhip';

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

export default function ProductCard({
  product,
  isPlaying,
  activeTrackId,
  onPlayToggle,
  audioProgress,
  audioDurationText
}: ProductCardProps) {
  const [shareText, setShareText] = useState('SHARE');

  const hasVariants = product.variants && product.variants.length > 0;
  const mainCheckoutUrl = PayhipService.getCheckoutUrl(product.payhipId || '');

  useEffect(() => {
    PayhipService.refreshOverlay();
  }, [product]);

  const isCurrentTrack = activeTrackId === product.id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

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
    } catch (_) {
      // Ignore share errors
    }
  };

  return (
    <article className="product-card">
      <div className="card-frame">
        {/* Artwork Section */}
        <div className="artwork-wrap relative">
          {product.artwork ? (
            <img 
              className={`artwork animate-fade-in ${isCurrentlyPlaying ? 'reactive-artwork' : ''}`} 
              src={product.artwork} 
              alt={`${product.title} artwork`} 
              loading="lazy" 
            />
          ) : (
            <div className="artwork flex items-center justify-center bg-zinc-900 text-zinc-700">
              <span className="text-sm font-semibold tracking-wider">NO ARTWORK</span>
            </div>
          )}
          <div className="artwork-overlay"></div>
          <div className="track-badge">CK$</div>
          
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

        {/* Custom Audio Player Shell */}
        <div className="player-shell" aria-label="Audio player">
          <div className="player-top">
            <button 
              className="play-button" 
              type="button" 
              onClick={() => onPlayToggle(product)}
              aria-label={isCurrentlyPlaying ? "Pause beat" : "Play beat"}
              disabled={!product.previewAudio}
            >
              <span className="play-icon">
                {isCurrentlyPlaying ? 'Ⅱ' : '▶'}
              </span>
            </button>
            <div className="track-meta">
              <span className="track-title">{product.title || 'Untitled'}</span>
              <span className="track-producer">CASHMERE KID$</span>
            </div>
            <span className="track-time">
              {isCurrentTrack ? audioDurationText : '—:—'}
            </span>
          </div>

          {/* Interactive Waveform / Progress bar */}
          <div className="relative mt-2">
            <div className="waveform" aria-hidden="true"></div>
            {isCurrentTrack && (
              <div className="absolute inset-0 bg-white/10 origin-left" style={{ transform: `scaleX(${audioProgress / 100})` }}></div>
            )}
          </div>
        </div>

        {/* Beat Details and Checkout Options */}
        <div className="card-info">
          <div className="title-row">
            <h3 className="product-title truncate pr-2 text-white">{product.title || 'Untitled'}</h3>
            <button 
              className="share-button" 
              type="button" 
              onClick={handleShare}
              aria-label="Share beat link"
            >
              {shareText}
            </button>
          </div>

          {/* General License Terms Box */}
          <div className="license-area">
            <div className="license-heading">
              <span>LICENSE TERMS</span>
            </div>
            
            <div className="mt-2 text-xs text-zinc-400 font-mono line-clamp-3 overflow-y-auto bg-zinc-950 p-3 border border-white/5 max-h-24 space-y-1">
              {Array.isArray(product.licenseTerms) ? (
                product.licenseTerms.filter(Boolean).length > 0 ? (
                  product.licenseTerms.filter(Boolean).map((term, index) => (
                    <div key={index} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className="truncate">{term}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600">Standard licensing terms apply.</div>
                )
              ) : (
                <div className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{product.licenseTerms || 'Standard licensing terms apply.'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Product Variants (Dynamic Purchase Slots) */}
          {hasVariants ? (
            <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
              <span className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-1">
                CHOOSE LICENSE
              </span>
              <div className="space-y-2.5">
                {product.variants!.map((variant, idx) => {
                  const variantUrl = PayhipService.getCheckoutUrl(variant.payhipId);
                  return (
                    <div 
                      key={idx}
                      className="flex flex-col border border-white/10 p-3 bg-zinc-950/60 font-mono"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-white text-xs uppercase tracking-tight block">{variant.name}</span>
                          {variant.description && (
                            <span className="text-[10px] text-zinc-500 block leading-relaxed mt-0.5 whitespace-pre-wrap">{variant.description}</span>
                          )}
                        </div>
                        <a 
                          className="buy-button payhip-buy-button text-[11px] px-3.5 py-2 flex items-center gap-1 cursor-pointer bg-white text-black font-bold uppercase transition-all whitespace-nowrap" 
                          href={variantUrl}
                          data-product={variant.payhipId}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (variantUrl === '#') {
                              e.preventDefault();
                              alert("Payhip variant key is missing.");
                            }
                          }}
                        >
                          BUY ${variant.price} ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Buy Row for Single Option products */
            <div className="buy-row mt-4">
              <span className="price-display uppercase font-mono tracking-wider">
                SINGLE LICENSE
              </span>
              <a 
                className="buy-button payhip-buy-button" 
                href={mainCheckoutUrl}
                data-product={product.payhipId}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Purchase beat"
                onClick={(e) => {
                  if (mainCheckoutUrl === '#') {
                    e.preventDefault();
                    alert("Payhip link not configured yet.");
                  }
                }}
              >
                BUY ${product.price || '0.00'} <span>↗</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
