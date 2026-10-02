import React, { useEffect } from 'react';
import { Product, ProductVariant } from './ProductCard';
import { PayhipService } from '../services/payhip';
import { X, ShieldCheck, Check, Music, Disc, Layers, Crown } from 'lucide-react';

interface LicenseModalProps {
  product: Product;
  onClose: () => void;
}

export default function LicenseModal({ product, onClose }: LicenseModalProps) {
  useEffect(() => {
    // Refresh Payhip overlay to make sure buttons in modal are intercepted by Payhip JS lightbox
    if ((window as any).Payhip) {
      (window as any).Payhip.refreshOverlay();
    } else {
      PayhipService.refreshOverlay();
    }
  }, [product]);

  const hasVariants = product.variants && product.variants.length > 0;

  // Standard licensing packages if no custom variants are supplied
  const defaultLicenses = [
    {
      id: 'basic',
      name: 'Basic MP3 License',
      price: product.price || '29.99',
      payhipId: product.payhipId || '',
      icon: <Music className="w-5 h-5 text-red-500" />,
      features: [
        'High-quality MP3 audio file',
        'Distribute up to 5,000 copies',
        'Up to 10,000 commercial streams',
        '100% royalty-free for minor releases',
        'Non-exclusive rights'
      ],
      description: 'Perfect for upcoming artists, demo tracks, and independent music videos.'
    },
    {
      id: 'premium',
      name: 'Premium WAV License',
      price: (parseFloat(product.price || '29.99') * 1.66).toFixed(2),
      payhipId: '', // Custom inquiry or main checkout
      icon: <Disc className="w-5 h-5 text-red-500" />,
      features: [
        'Lossless WAV audio file + MP3',
        'Distribute up to 25,000 copies',
        'Up to 100,000 commercial streams',
        'Ideal for Spotify, Apple Music & radio play',
        'Non-exclusive rights'
      ],
      description: 'Best value for active independent artists releasing on major platforms.'
    },
    {
      id: 'unlimited',
      name: 'Unlimited Trackout License',
      price: (parseFloat(product.price || '29.99') * 3.3).toFixed(2),
      payhipId: '',
      icon: <Layers className="w-5 h-5 text-red-500" />,
      features: [
        'Full Audio STEMS / Trackouts (Separated tracks)',
        'Lossless WAV + MP3',
        'Unlimited distribution copies',
        'Unlimited commercial streams',
        'Maximum mixing and mastering flexibility'
      ],
      description: 'Required for professional studio sessions, precise mixing, and unlimited publishing.'
    },
    {
      id: 'exclusive',
      name: 'Exclusive Rights',
      price: (parseFloat(product.price || '29.99') * 15.0).toFixed(2),
      payhipId: '',
      icon: <Crown className="w-5 h-5 text-red-500" />,
      features: [
        'Complete exclusive ownership of the beat',
        'Beat is immediately removed from storefront',
        'Lossless WAV + MP3 + STEMS included',
        'Unlimited commercial usage & performance rights',
        'Contractual transfer of rights'
      ],
      description: 'For artists/labels seeking complete sole ownership and major promotional campaigns.'
    }
  ];

  return (
    <div className="license-modal-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div 
        className="license-modal flex flex-col max-h-[90svh] w-full max-w-4xl relative" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 bg-zinc-950">
          <div>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest font-mono">CHOOSE LICENSE TYPE</span>
            <h3 className="text-xl md:text-2xl font-black text-white mt-1 uppercase truncate max-w-lg md:max-w-2xl">
              {product.title}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white cursor-pointer"
            aria-label="Close licensing modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 bg-zinc-900/40">
          {hasVariants ? (
            /* Admin defined custom variants list */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.variants!.map((variant, index) => {
                const isValidVariant = PayhipService.isValidPayhipId(variant.payhipId);
                const checkoutUrl = isValidVariant ? PayhipService.getCheckoutUrl(variant.payhipId) : '';
                
                return (
                  <div key={index} className="license-card flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-red-500 flex-shrink-0" />
                          <h4 className="text-base font-extrabold text-white uppercase tracking-tight leading-tight">
                            {variant.name}
                          </h4>
                        </div>
                        <span className="text-xl font-black font-mono text-white whitespace-nowrap">
                          ${variant.price}
                        </span>
                      </div>
                      
                      {variant.description && (
                        <p className="text-xs text-zinc-400 font-mono leading-relaxed mt-3 whitespace-pre-wrap bg-black/40 p-3 border border-white/5 rounded">
                          {variant.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/5">
                      {isValidVariant ? (
                        <a 
                          className="btn-primary payhip-buy-button w-full py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                          href={checkoutUrl}
                          data-product={variant.payhipId.trim()}
                          onClick={() => {
                            // Don't close modal immediately so Payhip can mount lightbox cleanly
                          }}
                        >
                          BUY LICENSE ↗
                        </a>
                      ) : (
                        <span className="block text-center text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-950 p-3 border border-white/5 font-mono">
                          CHECKOUT PENDING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Standard licensing tiers */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {defaultLicenses.map((lic) => {
                const isMainActive = lic.id === 'basic' && PayhipService.isValidPayhipId(lic.payhipId);
                const checkoutUrl = isMainActive ? PayhipService.getCheckoutUrl(lic.payhipId) : '';

                return (
                  <div key={lic.id} className={`license-card flex flex-col justify-between ${lic.id === 'premium' ? 'featured' : ''}`}>
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          {lic.icon}
                          <h4 className="text-base font-extrabold text-white uppercase tracking-tight leading-tight">
                            {lic.name}
                          </h4>
                        </div>
                        <span className="text-xl font-black font-mono text-white whitespace-nowrap">
                          ${lic.price}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 mt-2 font-sans leading-relaxed">
                        {lic.description}
                      </p>

                      <ul className="mt-4 space-y-2">
                        {lic.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2 text-[11px] text-zinc-300 font-mono">
                            <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5">
                      {isMainActive ? (
                        <a 
                          className="btn-primary payhip-buy-button w-full py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                          href={checkoutUrl}
                          data-product={lic.payhipId.trim()}
                        >
                          BUY LICENSE ↗
                        </a>
                      ) : lic.id === 'basic' ? (
                        <span className="block text-center text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-950 p-3 border border-white/5 font-mono">
                          CHECKOUT PENDING
                        </span>
                      ) : (
                        <a 
                          href={`mailto:krypside@gmail.com?subject=License Inquiry for ${encodeURIComponent(product.title)} - ${lic.name}&body=Hi CASHMERE KID$, I am interested in purchasing the ${lic.name} for your track '${product.title}'.`}
                          className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                          INQUIRE VIA EMAIL ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-white/10 text-center text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
          🛡️ SECURE LIGHTBOX CHECKOUT POWRED BY PAYHIP · INSTANT SECURE FILE DOWNLOADS
        </div>
      </div>
    </div>
  );
}
