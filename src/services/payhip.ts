/**
 * CASHMERE KID$ — Payhip Commerce Service
 * 
 * Encapsulates all interactions and integrations with Payhip.
 * Avoids scattering Payhip-specific logic throughout visual components.
 */

export interface PayhipLicenseOption {
  name: string;      // e.g. "Basic", "Premium", "Exclusive"
  price: string;     // e.g. "29.99"
  payhipId: string;  // The specific Payhip product code or checkout ID for this license
}

export interface PayhipProduct {
  id: string;
  title: string;
  payhipId: string; // Default or fallback Payhip product ID
  licenses: PayhipLicenseOption[];
}

export const PayhipService = {
  /**
   * Validates whether a Payhip ID or link is valid and non-empty.
   */
  isValidPayhipId: (payhipId?: string): boolean => {
    if (!payhipId) return false;
    const clean = payhipId.trim();
    return clean.length > 0 && clean !== '#';
  },

  /**
   * Formulates the official direct checkout link.
   * NEVER returns '#' or invalid URL patterns.
   */
  getCheckoutUrl: (payhipId: string): string => {
    if (!payhipId) return '';
    const cleanId = payhipId.trim();
    if (!cleanId || cleanId === '#') return '';
    return `https://payhip.com/b/${cleanId}`;
  },

  /**
   * Automatically extracts the unique Payhip product key from standard sharing URLs.
   */
  extractProductCode: (input: string): string => {
    if (!input) return '';
    const trimmed = input.trim();
    if (trimmed === '#') return '';
    
    // Check for /b/XXXX or /co/XXXX patterns
    const bMatch = trimmed.match(/\/b\/([a-zA-Z0-9_-]+)/i);
    if (bMatch && bMatch[1]) return bMatch[1];

    const coMatch = trimmed.match(/\/co\/([a-zA-Z0-9_-]+)/i);
    if (coMatch && coMatch[1]) return coMatch[1];

    // Get the last segment of the path if it contains slashes
    if (trimmed.includes('/')) {
      try {
        const parts = trimmed.split('/');
        const lastPart = parts.filter(Boolean).pop();
        if (lastPart) {
          // Strip query params if any
          const cleanPart = lastPart.split('?')[0].split('#')[0];
          return cleanPart;
        }
      } catch (_) {}
    }

    return trimmed;
  },

  /**
   * Forces Payhip JS lightbox overlay to re-scan the DOM ONLY when valid Payhip buttons exist.
   * Prevents Payhip.init() from throwing DOMException on unconfigured buttons.
   */
  refreshOverlay: () => {
    if (typeof window !== 'undefined') {
      const validButton = document.querySelector('.payhip-buy-button[data-product]:not([data-product=""]):not([data-product="#"])');
      if (!validButton) return;

      const win = window as any;
      if (win.Payhip && typeof win.Payhip.init === 'function') {
        try {
          win.Payhip.init();
        } catch (error) {
          console.error('[Payhip Service] Failed to refresh Payhip lightbox overlay:', error);
        }
      }
    }
  }
};
