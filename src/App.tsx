import React, { useState, useEffect, useRef } from 'react';
import ProductCard, { Product } from './components/ProductCard';
import BeatDetailPage from './components/BeatDetailPage';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Audio Player State
  const [activeTrack, setActiveTrack] = useState<Product | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio Analyser Refs for actual live audio reactive effects
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedBassRef = useRef(0);
  const smoothedMidsRef = useRef(0);

  const initAudioAnalyser = () => {
    if (analyserRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      if (audioRef.current) {
        // Safe anonymous configuration to support cross-domain reading if server CORS policies are matched
        audioRef.current.crossOrigin = "anonymous";
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceNodeRef.current = source;
      }
    } catch (err) {
      console.warn("Live audio reactive analysis initialization was bypassed or restricted:", err);
    }
  };

  const updateAnalyserLoop = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Bass energy (bypassing bin 0 noise, measuring bins 1-6)
    let bassSum = 0;
    const bassBins = Math.min(6, bufferLength);
    for (let i = 1; i < bassBins; i++) {
      bassSum += dataArray[i];
    }
    const bassAverage = bassBins > 1 ? (bassSum / (bassBins - 1)) / 255 : 0;

    // Mid/high energy (bins 6-24)
    let midsSum = 0;
    const midBinsStart = Math.min(6, bufferLength);
    const midBinsEnd = Math.min(24, bufferLength);
    for (let i = midBinsStart; i < midBinsEnd; i++) {
      midsSum += dataArray[i];
    }
    const midsAverage = (midBinsEnd - midBinsStart) > 0 ? (midsSum / (midBinsEnd - midBinsStart)) / 255 : 0;

    // Linear interpolation for smooth, jitter-free visual changes
    smoothedBassRef.current = smoothedBassRef.current * 0.85 + bassAverage * 0.15;
    smoothedMidsRef.current = smoothedMidsRef.current * 0.82 + midsAverage * 0.18;

    const pulseValue = 1 + smoothedBassRef.current * 0.07; // Zoom up to 1.07 max
    const glowValue = smoothedMidsRef.current; // Opacity scale for purple/cyan radial glow

    // Set CSS properties on root document
    document.documentElement.style.setProperty('--audio-bass', smoothedBassRef.current.toString());
    document.documentElement.style.setProperty('--audio-mid', smoothedMidsRef.current.toString());
    document.documentElement.style.setProperty('--audio-pulse', pulseValue.toString());
    document.documentElement.style.setProperty('--audio-glow', glowValue.toString());

    animationFrameRef.current = requestAnimationFrame(updateAnalyserLoop);
  };

  const stopAnalyserLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Smooth decay to avoid rapid snapping or snapping back
    let decayFactor = 0.82;
    const decay = () => {
      smoothedBassRef.current *= decayFactor;
      smoothedMidsRef.current *= decayFactor;

      const pulseValue = 1 + smoothedBassRef.current * 0.07;
      const glowValue = smoothedMidsRef.current;

      document.documentElement.style.setProperty('--audio-bass', smoothedBassRef.current.toString());
      document.documentElement.style.setProperty('--audio-mid', smoothedMidsRef.current.toString());
      document.documentElement.style.setProperty('--audio-pulse', pulseValue.toString());
      document.documentElement.style.setProperty('--audio-glow', glowValue.toString());

      if (smoothedBassRef.current > 0.001 || smoothedMidsRef.current > 0.001) {
        requestAnimationFrame(decay);
      } else {
        document.documentElement.style.setProperty('--audio-bass', '0');
        document.documentElement.style.setProperty('--audio-mid', '0');
        document.documentElement.style.setProperty('--audio-pulse', '1');
        document.documentElement.style.setProperty('--audio-glow', '0');
      }
    };
    requestAnimationFrame(decay);
  };

  // Setup routing listener
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Intercept normal anchor tag clicks for native SPA navigation
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href && anchor.host === window.location.host) {
        const url = new URL(anchor.href);
        // If it points to an anchor on the same page, let standard scrolling handle it
        if (url.pathname === window.location.pathname && url.hash) {
          return;
        }
        // Avoid intercepting target="_blank"
        if (anchor.target === '_blank') {
          return;
        }
        e.preventDefault();
        window.history.pushState(null, '', url.pathname + url.search + url.hash);
        window.dispatchEvent(new Event('popstate'));
      }
    };
    document.addEventListener('click', handleLinkClick);
    return () => document.addEventListener('click', handleLinkClick);
  }, []);

  // Load beat catalog on start
  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to retrieve beat catalog', e);
    } finally {
      setLoading(false);
    }
  };

  // Synchronized global audio setup
  useEffect(() => {
    audioRef.current = new Audio();

    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      stopAnalyserLoop();
    };

    const onPause = () => {
      setIsPlaying(false);
      stopAnalyserLoop();
    };

    const onPlay = () => {
      setIsPlaying(true);
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      initAudioAnalyser();
      if (!animationFrameRef.current) {
        updateAnalyserLoop();
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle play/pause toggles from any child component
  const handlePlayToggle = (track: Product) => {
    if (!audioRef.current) return;

    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      }
    } else {
      // Load and play new track
      audioRef.current.pause();
      if (track.previewAudio) {
        audioRef.current.src = track.previewAudio;
        audioRef.current.load();
        setActiveTrack(track);
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.error("Audio play failed on load:", err);
            setIsPlaying(false);
          });
      } else {
        alert("This track has no preview audio configured.");
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '—:—';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const audioProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const audioDurationText = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  // Route matches
  const isAdminPath = currentPath === '/admin';
  const isBeatDetailMatch = currentPath.startsWith('/beat/');
  
  // Resolve beat ID from path if on details route
  const activeDetailBeatId = isBeatDetailMatch ? currentPath.split('/beat/')[1] : null;
  const activeDetailProduct = activeDetailBeatId 
    ? products.find(p => p.id === activeDetailBeatId) 
    : null;

  return (
    <div>
      {/* Background Watermark Decoupled Layer */}
      <div className="site-watermark" aria-hidden="true">CASHMERE KID$</div>

      {/* Primary Brand Top Bar Header */}
      <header className="site-header">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigateTo('/'); }}>
          <span className="brand-mark">CK$</span>
          <span className="brand-name">CASHMERE KID$</span>
        </a>

        {/* Desktop Navigation links */}
        <nav className="nav" aria-label="Primary navigation">
          <a href="/#beats" onClick={() => navigateTo('/#beats')}>BEATS</a>
          <a href="/#about" onClick={() => navigateTo('/#about')}>ABOUT</a>
          <a href="/#contact" onClick={() => navigateTo('/#contact')}>CONTACT</a>
          <a href="/admin" onClick={(e) => { e.preventDefault(); navigateTo('/admin'); }} className="opacity-40 hover:opacity-100 transition-opacity">PORTAL</a>
        </nav>

        {/* Mobile touch trigger button */}
        <button 
          className="menu-toggle cursor-pointer" 
          type="button" 
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span></span><span></span><span></span>
          <span className="sr-only">Open menu</span>
        </button>
      </header>

      {/* Mobile touch navigational panel */}
      {mobileMenuOpen && (
        <div className="mobile-nav block" id="mobile-nav">
          <a href="/#beats" onClick={() => { setMobileMenuOpen(false); navigateTo('/#beats'); }}>BEATS</a>
          <a href="/#about" onClick={() => { setMobileMenuOpen(false); navigateTo('/#about'); }}>ABOUT</a>
          <a href="/#contact" onClick={() => { setMobileMenuOpen(false); navigateTo('/#contact'); }}>CONTACT</a>
          <a href="/admin" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigateTo('/admin'); }}>ADMIN PANEL</a>
        </div>
      )}

      {/* Navigation Router Views mapping */}
      <main>
        {isAdminPath ? (
          <AdminPanel 
            onBackToStore={() => navigateTo('/')}
            onRefreshCatalog={fetchCatalog}
          />
        ) : isBeatDetailMatch ? (
          activeDetailProduct ? (
            <BeatDetailPage
              product={activeDetailProduct}
              isPlaying={isPlaying}
              activeTrackId={activeTrack?.id || null}
              onPlayToggle={handlePlayToggle}
              audioProgress={audioProgress}
              audioDurationText={audioDurationText}
              onBack={() => navigateTo('/')}
            />
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-32 text-center relative z-10 font-mono">
              <h2 className="text-xl font-bold uppercase tracking-widest text-white">TRACK NOT FOUND</h2>
              <p className="text-sm text-zinc-500 uppercase mt-2">The requested beat record was not found or has been removed.</p>
              <button 
                onClick={() => navigateTo('/')}
                className="mt-8 px-6 py-3 border border-white text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer"
              >
                RETURN TO STOREFRONT
              </button>
            </div>
          )
        ) : (
          /* Storefront Homepage view */
          <div>
            {/* Kampagne Hero Spotlight */}
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-kicker"><span></span> INDEPENDENT PRODUCER STORE</div>
              <h1 id="hero-title">CASHMERE<br /><em>KID$</em></h1>
              <p>Exclusive original production. Hand-crafted beat patterns built for artists who want records with absolute identity.</p>
              <a className="outline-button hero-button cursor-pointer" href="#beats">EXPLORE BEATS <span>↓</span></a>
            </section>

            {/* Beats Grid Storefront */}
            <section className="store-section" id="beats" aria-labelledby="store-title">
              <div className="section-heading">
                <div>
                  <span className="section-label">THE CATALOG</span>
                  <h2 id="store-title">BEATS</h2>
                </div>
                <div className="catalog-line" aria-hidden="true"></div>
              </div>

              {loading ? (
                <div className="py-24 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest">
                  Loading available productions...
                </div>
              ) : products.filter(p => p.visibility !== false).length === 0 ? (
                /* Purely unboxed clean catalog placeholder as specified */
                <div className="empty-catalog border border-dashed border-white/20 p-12 text-center bg-white/[0.01]">
                  <div>
                    <div style={{ color: "#aaa", marginBottom: ".55rem" }}>CASHMERE KID$ CATALOG</div>
                    <div>Beats will appear here automatically when added via the admin panel.</div>
                  </div>
                </div>
              ) : (
                <div className="product-grid" aria-live="polite">
                  {products
                    .filter(p => p.visibility !== false)
                    .map((product) => (
                      <ProductCard 
                        key={product.id}
                        product={product}
                        isPlaying={isPlaying}
                        activeTrackId={activeTrack?.id || null}
                        onPlayToggle={handlePlayToggle}
                        audioProgress={audioProgress}
                        audioDurationText={audioDurationText}
                      />
                    ))}
                </div>
              )}
            </section>

            {/* Story Spotlight */}
            <section className="about-section" id="about" aria-labelledby="about-title">
              <div className="about-index">01</div>
              <div>
                <span className="section-label font-mono">THE PRODUCER</span>
                <h2 id="about-title">CASHMERE KID$</h2>
                <p className="mt-4 leading-relaxed font-sans">
                  An independent storefront for premium, original CASHMERE KID$ production. 
                  This platform is designed specifically to showcase the audio itself—without 
                  crowded marketplace noise, rival vendor listings, or competitive recommendations.
                  Every production represents complete creative focus, backed by secure, frictionless
                  delivery from Payhip.
                </p>
              </div>
            </section>

            {/* Contact Portal */}
            <section className="contact-section" id="contact" aria-labelledby="contact-title">
              <span className="section-label font-mono">CONNECT</span>
              <h2 id="contact-title">MAKE SOMETHING<br /><em>REAL.</em></h2>
              <p className="font-sans">
                For custom inquiries, exclusive track stem request structures, or collaborative ventures, 
                reach out directly. Let's engineer sounds that shape culture.
              </p>
              <a 
                href="mailto:krypside@gmail.com" 
                className="outline-button mt-8 uppercase font-mono tracking-wider font-bold"
              >
                EMAIL PRODUCER ↗
              </a>
            </section>
          </div>
        )}
      </main>

      {/* Footer Meta Section */}
      <footer className="site-footer">
        <div className="footer-brand font-mono font-bold">CASHMERE KID$</div>
        <div className="footer-meta font-mono">© {new Date().getFullYear()} CASHMERE KID$ · POWERED BY PAYHIP</div>
      </footer>
    </div>
  );
}
