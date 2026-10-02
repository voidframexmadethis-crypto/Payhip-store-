import React, { useState, useEffect, useRef } from 'react';
import ProductCard, { Product, getMusicMetadata } from './components/ProductCard';
import BeatDetailPage from './components/BeatDetailPage';
import AdminPanel from './components/AdminPanel';
import LicenseModal from './components/LicenseModal';
import { 
  Play, Pause, Search, Grid, List, Volume2, VolumeX, RotateCcw, 
  ChevronRight, ChevronLeft, ShoppingCart, Music, Tag, Filter, X,
  Paperclip, Send, Check
} from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminEnabled, setAdminEnabled] = useState(false);

  // Home Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedKey, setSelectedKey] = useState('All');
  const [selectedBpmRange, setSelectedBpmRange] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list'); // List is BeatStars default

  // Selected License Modal (Mainly for row clicks)
  const [licenseModalProduct, setLicenseModalProduct] = useState<Product | null>(null);

  // Public Contact Portal States
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('General Collaboration');
  const [contactMessage, setContactMessage] = useState('');
  const [contactAudioUrl, setContactAudioUrl] = useState('');
  const [uploadingContactAudio, setUploadingContactAudio] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  const handleContactAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingContactAudio(true);
    setContactError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/public/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.fileUrl) {
        setContactAudioUrl(data.fileUrl);
      } else {
        setContactError(data.error || 'Failed to upload audio file.');
      }
    } catch (err) {
      setContactError('Network failure uploading audio file.');
    } finally {
      setUploadingContactAudio(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError('Please fill out all required fields.');
      return;
    }

    setContactError('');
    setContactSuccess(false);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          subject: contactSubject,
          message: contactMessage,
          audioUrl: contactAudioUrl
        })
      });

      if (res.ok) {
        setContactSuccess(true);
        // Clear form
        setContactName('');
        setContactEmail('');
        setContactMessage('');
        setContactAudioUrl('');
      } else {
        const data = await res.json();
        setContactError(data.error || 'Failed to dispatch message.');
      }
    } catch (err) {
      setContactError('Network error. Launching email client fallback...');
      window.location.href = `mailto:cashmerekid7@gmail.com?subject=${encodeURIComponent(contactSubject)}&body=${encodeURIComponent(`Hi CASHMERE KID$,\n\nName: ${contactName}\nEmail: ${contactEmail}\nMessage: ${contactMessage}\n\nReference Audio: ${contactAudioUrl ? window.location.origin + contactAudioUrl : 'None'}`)}`;
    }
  };

  useEffect(() => {
    fetch('/api/admin/status')
      .then(res => res.json())
      .then(data => setAdminEnabled(!!data.enabled))
      .catch(() => setAdminEnabled(false));
  }, []);

  // Global Audio Player State
  const [activeTrack, setActiveTrack] = useState<Product | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

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

    let bassSum = 0;
    const bassBins = Math.min(6, bufferLength);
    for (let i = 1; i < bassBins; i++) {
      bassSum += dataArray[i];
    }
    const bassAverage = bassBins > 1 ? (bassSum / (bassBins - 1)) / 255 : 0;

    let midsSum = 0;
    const midBinsStart = Math.min(6, bufferLength);
    const midBinsEnd = Math.min(24, bufferLength);
    for (let i = midBinsStart; i < midBinsEnd; i++) {
      midsSum += dataArray[i];
    }
    const midsAverage = (midBinsEnd - midBinsStart) > 0 ? (midsSum / (midBinsEnd - midBinsStart)) / 255 : 0;

    smoothedBassRef.current = smoothedBassRef.current * 0.85 + bassAverage * 0.15;
    smoothedMidsRef.current = smoothedMidsRef.current * 0.82 + midsAverage * 0.18;

    const pulseValue = 1 + smoothedBassRef.current * 0.07;
    const glowValue = smoothedMidsRef.current;

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
        try {
          const url = new URL(anchor.href, window.location.origin);
          if (url.pathname === window.location.pathname && url.hash) {
            return;
          }
          if (anchor.target === '_blank') {
            return;
          }
          e.preventDefault();
          try {
            window.history.pushState(null, '', url.pathname + url.search + url.hash);
            window.dispatchEvent(new Event('popstate'));
          } catch (_) {}
        } catch (_) {}
      }
    };
    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
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
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        handleNextTrack();
      }
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
  }, [isLooping, products]); // Re-bind end event when loops or catalog updates

  // Volume synchronization
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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

  const handleTimelineScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    audioRef.current.currentTime = percentage * duration;
  };

  const handleNextTrack = () => {
    if (products.length === 0) return;
    const visibleTracks = products.filter(p => p.visibility !== false);
    if (visibleTracks.length === 0) return;

    const currentIndex = activeTrack ? visibleTracks.findIndex(p => p.id === activeTrack.id) : -1;
    let nextIndex = currentIndex + 1;
    if (nextIndex >= visibleTracks.length) {
      nextIndex = 0; // wrap around
    }
    handlePlayToggle(visibleTracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (products.length === 0) return;
    const visibleTracks = products.filter(p => p.visibility !== false);
    if (visibleTracks.length === 0) return;

    const currentIndex = activeTrack ? visibleTracks.findIndex(p => p.id === activeTrack.id) : -1;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = visibleTracks.length - 1; // wrap around
    }
    handlePlayToggle(visibleTracks[prevIndex]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const navigateTo = (path: string) => {
    try {
      window.history.pushState(null, '', path);
    } catch (_) {}
    window.dispatchEvent(new Event('popstate'));
  };

  // Real-time catalog filters
  const filteredProducts = products.filter(product => {
    if (product.visibility === false) return false;
    const meta = getMusicMetadata(product.title || '');

    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meta.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre = selectedGenre === 'All' || meta.genre === selectedGenre;
    const matchesKey = selectedKey === 'All' || meta.key === selectedKey;

    let matchesBpm = true;
    if (selectedBpmRange !== 'All') {
      const [min, max] = selectedBpmRange.split('-').map(Number);
      matchesBpm = meta.bpm >= min && meta.bpm <= max;
    }

    return matchesSearch && matchesGenre && matchesKey && matchesBpm;
  });

  // Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'bpm-asc') {
      return getMusicMetadata(a.title).bpm - getMusicMetadata(b.title).bpm;
    }
    if (sortBy === 'bpm-desc') {
      return getMusicMetadata(b.title).bpm - getMusicMetadata(a.title).bpm;
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    // Default latest
    return 0;
  });

  const uniqueKeys = ['All', 'C Minor', 'C# Minor', 'D Minor', 'D# Minor', 'E Minor', 'F Minor', 'F# Minor', 'G Minor', 'G# Minor', 'A Minor', 'A# Minor', 'B Minor'];
  const genres = ['All', 'Trap', 'Hip Hop', 'R&B', 'Pop', 'Drill'];

  // Route matches
  const isAdminPath = currentPath === '/admin';
  const isBeatDetailMatch = currentPath.startsWith('/beat/');
  
  const activeDetailBeatId = isBeatDetailMatch ? currentPath.split('/beat/')[1] : null;
  const activeDetailProduct = activeDetailBeatId 
    ? products.find(p => p.id === activeDetailBeatId) 
    : null;

  const audioProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const audioDurationText = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  return (
    <div className={`min-h-screen flex flex-col ${activeTrack ? 'pb-24' : ''}`}>
      {/* Background Watermark Decoupled Layer */}
      <div className="site-watermark" aria-hidden="true">CASHMERE</div>

      {/* Primary 3-Zone Top Bar Navigation Header */}
      <header className="site-header border-b border-white/5">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); navigateTo('/'); }}>
          <span className="brand-mark">CK$</span>
          <span className="brand-name font-black tracking-tight text-white">CASHMERE KID$</span>
        </a>

        {/* Desktop links */}
        <nav className="nav" aria-label="Primary navigation">
          <a href="/#beats" onClick={() => navigateTo('/#beats')}>BEATS</a>
          <a href="/#about" onClick={() => navigateTo('/#about')}>ABOUT</a>
          <a href="/#contact" onClick={() => navigateTo('/#contact')}>CONTACT</a>
          {adminEnabled && (
            <a href="/admin" onClick={(e) => { e.preventDefault(); navigateTo('/admin'); }} className="text-red-500 hover:text-red-400">ADMIN</a>
          )}
        </nav>

        {/* Action Button */}
        <div className="hidden md:flex items-center gap-3">
          <a 
            href="mailto:krypside@gmail.com?subject=Custom Beat Inquiry"
            className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
          >
            CUSTOM REQUEST
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button 
          className="menu-toggle" 
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className={`${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </header>

      {/* Mobile nav modal */}
      {mobileMenuOpen && (
        <div className="mobile-nav block">
          <a href="/#beats" onClick={() => { setMobileMenuOpen(false); navigateTo('/#beats'); }}>BEATS</a>
          <a href="/#about" onClick={() => { setMobileMenuOpen(false); navigateTo('/#about'); }}>ABOUT</a>
          <a href="/#contact" onClick={() => { setMobileMenuOpen(false); navigateTo('/#contact'); }}>CONTACT</a>
          {adminEnabled && (
            <a href="/admin" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigateTo('/admin'); }} className="text-red-500">ADMIN</a>
          )}
        </div>
      )}

      {/* Primary view router */}
      <main className="flex-grow">
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
              <button 
                onClick={() => navigateTo('/')}
                className="mt-8 btn-primary px-6 py-3 border border-white text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-colors rounded-none cursor-pointer"
              >
                RETURN TO STOREFRONT
              </button>
            </div>
          )
        ) : (
          /* Storefront Homepage View */
          <div>
            {/* Cinematic Campaign Hero Header */}
            <section className="hero relative" aria-labelledby="hero-title">
              <div className="hero-kicker"><span></span> CASHMERE KID$ PRODUCTION</div>
              <h1 id="hero-title">SOUNDS WITH<br /><em>IDENTITY.</em></h1>
              <p>Discover & license industry-grade original music directly from the producer storefront.</p>

              {/* Dynamic Instant Search box */}
              <div className="search-container flex items-center px-4 w-full">
                <Search className="w-5 h-5 text-zinc-500 mr-3 flex-shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What style of beat are you looking for? (Trap, Pop, 140 BPM...)"
                  className="w-full bg-transparent border-none outline-none text-white text-sm placeholder-zinc-500 font-sans py-3"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </section>

            {/* Beats Section */}
            <section className="max-w-6xl mx-auto px-4 py-12 md:py-16" id="beats">
              
              {/* Beats Header & Filtering Tools */}
              <div className="flex flex-col gap-6 mb-8 border-b border-white/5 pb-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">BEATMAKER DISCOGRAPHY</span>
                    <h2 className="text-2xl md:text-3.5xl font-black text-white mt-1 uppercase">TRACK CATALOGUE</h2>
                  </div>
                  
                  {/* Layout selector */}
                  <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-white/5">
                    <button 
                      onClick={() => setLayoutMode('list')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${layoutMode === 'list' ? 'bg-red-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                      title="List View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setLayoutMode('grid')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${layoutMode === 'grid' ? 'bg-red-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                      title="Grid View"
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Panels Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 font-mono text-[11px] font-bold">
                  {/* Genre Select */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">GENRE</span>
                    <select 
                      value={selectedGenre} 
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="bg-zinc-950 border border-white/10 text-white p-3 rounded outline-none focus:border-red-500 cursor-pointer"
                    >
                      {genres.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
                    </select>
                  </div>

                  {/* BPM range */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">TEMPO</span>
                    <select 
                      value={selectedBpmRange} 
                      onChange={(e) => setSelectedBpmRange(e.target.value)}
                      className="bg-zinc-950 border border-white/10 text-white p-3 rounded outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="All">ALL TEMPOS</option>
                      <option value="110-130">110 - 130 BPM</option>
                      <option value="130-145">130 - 145 BPM</option>
                      <option value="145-170">145 - 170 BPM</option>
                    </select>
                  </div>

                  {/* Key Filter */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">KEY</span>
                    <select 
                      value={selectedKey} 
                      onChange={(e) => setSelectedKey(e.target.value)}
                      className="bg-zinc-950 border border-white/10 text-white p-3 rounded outline-none focus:border-red-500 cursor-pointer"
                    >
                      {uniqueKeys.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
                    </select>
                  </div>

                  {/* Sort Filter */}
                  <div className="flex flex-col gap-1.5 col-span-2 md:col-span-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">SORT BY</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-zinc-950 border border-white/10 text-white p-3 rounded outline-none focus:border-red-500 cursor-pointer"
                    >
                      <option value="latest">LATEST ADDITIONS</option>
                      <option value="bpm-asc">TEMPO (LOW TO HIGH)</option>
                      <option value="bpm-desc">TEMPO (HIGH TO LOW)</option>
                      <option value="title">TRACK NAME (A-Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Render dynamic items */}
              {loading ? (
                <div className="py-24 text-center font-mono text-xs text-zinc-500 uppercase tracking-widest flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                  Retrieving Beat Storefront...
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="py-20 border border-dashed border-white/10 text-center rounded-lg bg-zinc-950/40">
                  <Music className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <span className="block font-mono text-xs text-zinc-500 uppercase tracking-widest">No matching beats found</span>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGenre('All');
                      setSelectedKey('All');
                      setSelectedBpmRange('All');
                    }}
                    className="mt-4 px-4 py-2 bg-white/5 border border-white/10 text-xs font-mono font-bold text-white uppercase rounded hover:bg-white/10 transition-colors"
                  >
                    RESET FILTERS
                  </button>
                </div>
              ) : layoutMode === 'list' ? (
                /* BeatStars Signature Row List view */
                <div className="space-y-3" aria-live="polite">
                  {/* Header labels */}
                  <div className="hidden lg:grid grid-cols-4 lg:grid-cols-6 items-center gap-1.5 px-5 py-2 font-mono text-[10px] text-zinc-500 uppercase font-bold tracking-widest border-b border-white/5 mb-2">
                    <div>#</div>
                    <div>ART</div>
                    <div>TRACK TITLE</div>
                    <div className="text-right">TEMPO</div>
                    <div className="text-right">KEY</div>
                    <div className="text-right">PRICE / BUY</div>
                  </div>

                  {sortedProducts.map((product, idx) => {
                    const isTrackActive = activeTrack?.id === product.id;
                    const isTrackPlaying = isTrackActive && isPlaying;
                    const meta = getMusicMetadata(product.title);

                    return (
                      <div 
                        key={product.id} 
                        className={`track-row ${isTrackActive ? 'is-active' : ''}`}
                      >
                        {/* Play Action column */}
                        <div className="flex items-center">
                          <button
                            onClick={() => handlePlayToggle(product)}
                            className="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white rounded border border-white/10 cursor-pointer"
                            title={isTrackPlaying ? "Pause" : "Play"}
                          >
                            {isTrackPlaying ? (
                              <Pause className="w-3.5 h-3.5 text-red-500 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                            )}
                          </button>
                        </div>

                        {/* Artwork column */}
                        <div 
                          className="track-row-art aspect-square w-10 h-10 bg-zinc-950 rounded overflow-hidden border border-white/5 cursor-pointer"
                          onClick={() => navigateTo(`/beat/${product.id}`)}
                        >
                          {product.artwork ? (
                            <img 
                              src={product.artwork} 
                              alt={product.title} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[8px] font-bold text-zinc-700">CK$</div>
                          )}
                        </div>

                        {/* Title column */}
                        <div className="min-w-0">
                          <h4 
                            onClick={() => navigateTo(`/beat/${product.id}`)}
                            className="text-sm font-extrabold text-white uppercase tracking-tight leading-none truncate hover:text-red-500 cursor-pointer"
                          >
                            {product.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono font-bold uppercase mt-1 leading-none">
                            <span>CASHMERE KID$</span>
                            <span>·</span>
                            <span className="text-zinc-600">{meta.genre}</span>
                          </div>
                        </div>

                        {/* BPM column */}
                        <div className="track-row-bpm text-right font-mono text-xs text-zinc-300">
                          {meta.bpm} BPM
                        </div>

                        {/* Key column */}
                        <div className="track-row-key text-right font-mono text-xs text-red-500 font-bold">
                          {meta.key}
                        </div>

                        {/* Buy column */}
                        <div className="text-right flex items-center justify-end gap-3.5">
                          {/* Animated playing bars */}
                          {isTrackPlaying && (
                            <div className="soundwave-indicator mr-1">
                              <span className="soundwave-bar playing-0" />
                              <span className="soundwave-bar playing-1" />
                              <span className="soundwave-bar playing-2" />
                              <span className="soundwave-bar playing-3" />
                            </div>
                          )}

                          <button
                            onClick={() => setLicenseModalProduct(product)}
                            className="btn-primary py-2 px-3.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer border-none"
                          >
                            <ShoppingCart className="w-3 h-3" /> ${product.price || '29.99'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Grid view */
                <div className="product-grid" aria-live="polite">
                  {sortedProducts.map((product) => (
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

            {/* About / Bio Spotlight Section */}
            <section className="bg-zinc-950 border-t border-b border-white/5 py-16 md:py-24" id="about">
              <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative border border-white/10 p-1.5 bg-zinc-900 rounded-xl overflow-hidden aspect-square max-w-sm w-full">
                    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-red-500 p-8 text-center rounded-lg">
                      <Music className="w-16 h-16 mb-4 animate-bounce" />
                      <h4 className="font-extrabold text-white text-xl uppercase tracking-tighter">CASHMERE KID$</h4>
                      <p className="font-mono text-xs text-zinc-500 mt-1 uppercase tracking-widest">ESTABLISHED PRODUCTIONS</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">ABOUT THE BRAND</span>
                  <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">CASHMERE MUSIC GROUP</h2>
                  <p className="text-sm text-zinc-400 font-sans leading-relaxed">
                    Exclusive boutique storefront powered by BeatStars standards. This site delivers a distraction-free environment for professional recording artists, film supervisors, and content creators looking to license premium instrumental arrangements.
                  </p>
                  <div className="grid grid-cols-2 gap-4 font-mono text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>INSTANT DIGITAL DOWNLOADS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>ROYALTY-FREE AGREEMENTS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>WAV / MP3 & STEM ACCESS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>SECURE PAYHIP ENCRYPTION</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Fully Operational Interactive Contact Portal (BeatStars Collaboration Style) */}
            <section className="max-w-4xl mx-auto px-4 py-16 md:py-24 text-left space-y-8" id="contact">
              <div className="text-center space-y-4">
                <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest block">WORK TOGETHER</span>
                <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Vocalist & Artist Collab Portal</h2>
                <p className="text-zinc-400 max-w-xl mx-auto text-sm leading-relaxed">
                  Send your project requirements, vocal reference demos, or beat inquiries directly to CASHMERE KID$ at <span className="text-white underline">cashmerekid7@gmail.com</span>. Attach an audio file (vocal guide/ref track) directly below!
                </p>
              </div>

              {contactSuccess ? (
                <div className="max-w-xl mx-auto p-8 border border-emerald-500/20 bg-emerald-950/10 rounded-xl text-center space-y-4 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white uppercase">Inquiry Dispatched!</h4>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Your message and audio reference have been saved securely and delivered to **cashmerekid7@gmail.com**. CASHMERE KID$ will review your reference demo and get back to you shortly!
                  </p>
                  <button 
                    onClick={() => setContactSuccess(false)}
                    className="btn-secondary px-6 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    SEND ANOTHER MESSAGE
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="max-w-2xl mx-auto bg-zinc-950 p-6 md:p-8 rounded-xl border border-white/5 space-y-5 shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Name *</label>
                      <input 
                        type="text" 
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Kid Cudi"
                        className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Your Email *</label>
                      <input 
                        type="email" 
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="e.g. artist@gmail.com"
                        className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Inquiry Subject</label>
                    <select 
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-mono cursor-pointer"
                    >
                      <option value="Custom Beat Production">Custom Beat Production</option>
                      <option value="Vocal Demo Collaboration">Vocal Demo Collaboration</option>
                      <option value="Exclusive Rights Purchase">Exclusive Rights Purchase</option>
                      <option value="Sync & Licensing Inquiry">Sync & Licensing Inquiry</option>
                      <option value="General Collaboration">General Collaboration</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Collaboration Message *</label>
                    <textarea 
                      required
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      rows={5}
                      placeholder="Describe your project, sync timeline, budget, license needs, or outline your track structure..."
                      className="w-full bg-zinc-900 border border-white/10 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none transition-colors rounded text-xs font-sans"
                    />
                  </div>

                  {/* Audio Vocal Reference upload field */}
                  <div className="space-y-2.5 bg-black/40 p-4 border border-white/5 rounded-lg">
                    <label className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                      Attach Reference Demo / Vocal Track (Optional)
                    </label>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <input 
                        type="file"
                        accept="audio/*"
                        id="contact-audio-upload"
                        className="hidden"
                        onChange={handleContactAudioUpload}
                      />
                      <label 
                        htmlFor="contact-audio-upload"
                        className="btn-secondary px-4 py-2.5 text-xs font-mono font-bold uppercase transition-colors tracking-widest cursor-pointer flex items-center gap-2 flex-shrink-0"
                      >
                        <Paperclip className="w-4 h-4 text-red-500" />
                        {uploadingContactAudio ? 'Uploading demo...' : 'Choose Audio File'}
                      </label>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {contactAudioUrl ? '✓ Attached reference guide successfully' : 'Accepts MP3, WAV, M4A or OGG vocal tracks.'}
                      </span>
                    </div>
                    {contactAudioUrl && (
                      <div className="text-[10px] font-mono text-emerald-400 mt-1 font-bold">
                        Uploaded File Link: <span className="underline">{contactAudioUrl}</span>
                      </div>
                    )}
                  </div>

                  {contactError && (
                    <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 font-mono text-[10px] uppercase font-bold rounded">
                      ⚠️ {contactError}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={uploadingContactAudio}
                      className="btn-primary px-8 py-3.5 text-xs font-black font-mono tracking-widest uppercase cursor-pointer border-none flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> SEND MESSAGE
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="site-footer bg-zinc-950/40 border-t border-white/5 py-8 px-6 text-center md:text-left">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="font-extrabold text-white tracking-widest uppercase">CASHMERE KID$</div>
          <div className="text-zinc-500">
            © {new Date().getFullYear()} CMG RECORDS · ALL RIGHTS RESERVED · POWERED BY PAYHIP
          </div>
        </div>
      </footer>

      {/* Persistent Bottom Audio Player Dock (Exactly like BeatStars) */}
      {activeTrack && (
        <div className="bottom-player fixed left-0 right-0 bottom-0 bg-zinc-950 border-t border-white/10 z-50">
          
          {/* Custom scrub timeline */}
          <div 
            className="player-scrub absolute top-0 left-0 right-0 bg-white/10 h-1 cursor-pointer hover:h-1.5 transition-all"
            onClick={handleTimelineScrub}
          >
            <div 
              className="player-progress bg-red-600 h-full relative" 
              style={{ width: `${audioProgress}%` }}
            />
          </div>

          {/* Left: Artwork & Name */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="aspect-square w-12 h-12 bg-zinc-900 border border-white/10 rounded overflow-hidden flex-shrink-0">
              {activeTrack.artwork ? (
                <img 
                  src={activeTrack.artwork} 
                  alt={activeTrack.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-700">CK$</div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-white truncate leading-snug uppercase">
                {activeTrack.title}
              </h4>
              <span className="text-[10px] font-semibold text-zinc-500 block leading-none mt-1">
                CASHMERE KID$
              </span>
            </div>
          </div>

          {/* Center: Playback & Timeline Controls */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-5">
              {/* Prev */}
              <button 
                onClick={handlePrevTrack}
                className="p-1.5 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none"
                title="Previous Track"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Play / Pause */}
              <button 
                onClick={() => handlePlayToggle(activeTrack)}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current text-black" />
                ) : (
                  <Play className="w-4 h-4 fill-current text-black ml-0.5" />
                )}
              </button>

              {/* Next */}
              <button 
                onClick={handleNextTrack}
                className="p-1.5 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none"
                title="Next Track"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Loop */}
              <button 
                onClick={() => setIsLooping(!isLooping)}
                className={`p-1.5 rounded-full hover:bg-white/5 cursor-pointer bg-transparent border-none ${isLooping ? 'text-red-500' : 'text-zinc-500'}`}
                title={isLooping ? "Loop On" : "Loop Off"}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Time Indicator */}
            <div className="font-mono text-[10px] text-zinc-500">
              {audioDurationText}
            </div>
          </div>

          {/* Right: Volume & Purchase Actions */}
          <div className="flex items-center justify-end gap-5">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-16 accent-red-600 h-1 bg-white/10 rounded-lg cursor-pointer"
                title="Volume Slider"
              />
            </div>

            {/* Buy from Bottom player */}
            <button
              onClick={() => setLicenseModalProduct(activeTrack)}
              className="btn-primary py-2 px-5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-none cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" /> LICENSE BEAT
            </button>
          </div>

        </div>
      )}

      {/* Global License Modal open state */}
      {licenseModalProduct && (
        <LicenseModal 
          product={licenseModalProduct} 
          onClose={() => setLicenseModalProduct(null)} 
        />
      )}

    </div>
  );
}
