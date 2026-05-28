import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Globe,
  Download,
  Music,
  Film,
  Copy,
  Check,
  Share2,
  Search,
  History,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
  Link2,
  X,
  RefreshCw,
  QrCode
} from 'lucide-react';

const Youtube = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" />
    <polygon points="10 15 15 12 10 9" fill="currentColor" />
  </svg>
);

const Facebook = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const Instagram = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

// API base URL - set VITE_API_URL env var for production (e.g. https://your-backend.onrender.com)
const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  
  // Active download tracking
  const [preparingDownload, setPreparingDownload] = useState(null); // { id, progress, speed, eta, status, title }
  const [downloadHistory, setDownloadHistory] = useState([]);
  
  // Modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [dragging, setDragging] = useState(false);

  const steps = [
    'Connecting to video platform...',
    'Bypassing security controls...',
    'Analyzing video streams and metadata...',
    'Calculating file sizes and resolutions...',
    'Generating download streams...'
  ];

  // Load download history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('download_history');
    if (history) {
      try {
        setDownloadHistory(JSON.parse(history));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save download history
  const saveToHistory = (info, quality, ext) => {
    const newItem = {
      id: Date.now().toString(),
      title: info.title,
      thumbnail: info.thumbnail,
      platform: info.platform,
      uploader: info.uploader,
      quality: quality,
      ext: ext,
      date: new Date().toLocaleDateString(),
      originalUrl: info.originalUrl
    };
    
    const updatedHistory = [newItem, ...downloadHistory.slice(0, 19)]; // Keep last 20
    setDownloadHistory(updatedHistory);
    localStorage.setItem('download_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setDownloadHistory([]);
    localStorage.removeItem('download_history');
  };

  // Drag and paste event listeners
  useEffect(() => {
    const handlePaste = (e) => {
      // Don't auto-fetch if user is already typing in an input
      if (document.activeElement.tagName === 'INPUT') return;
      
      const pastedText = e.clipboardData.getData('text');
      if (pastedText && isValidUrl(pastedText)) {
        setUrl(pastedText);
        analyzeVideo(pastedText);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      setDragging(true);
    };

    const handleDragLeave = () => {
      setDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setDragging(false);
      const droppedUrl = e.dataTransfer.getData('text');
      if (droppedUrl && isValidUrl(droppedUrl)) {
        setUrl(droppedUrl);
        analyzeVideo(droppedUrl);
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [downloadHistory]);

  // Loading steps animation
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 1500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const detectPlatform = (videoUrl) => {
    if (!videoUrl) return 'globe';
    const lowUrl = videoUrl.toLowerCase();
    if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) return 'youtube';
    if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.watch')) return 'facebook';
    if (lowUrl.includes('tiktok.com')) return 'tiktok';
    if (lowUrl.includes('instagram.com')) return 'instagram';
    return 'globe';
  };

  const getPlatformBrandColor = (platform) => {
    switch (platform) {
      case 'youtube': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'facebook': return 'bg-blue-600/20 text-blue-400 border-blue-600/30';
      case 'tiktok': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'instagram': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getPlatformIcon = (platform, size = 18) => {
    switch (platform) {
      case 'youtube': return <Youtube size={size} className="text-red-500" />;
      case 'facebook': return <Facebook size={size} className="text-blue-500" />;
      case 'tiktok': return <Video size={size} className="text-teal-400" />;
      case 'instagram': return <Instagram size={size} className="text-pink-500" />;
      default: return <Globe size={size} className="text-purple-400" />;
    }
  };

  const analyzeVideo = async (targetUrl = url) => {
    if (!targetUrl) return;
    if (!isValidUrl(targetUrl)) {
      setError('Please enter a valid URL.');
      return;
    }

    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE}/api/info?url=${encodeURIComponent(targetUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      setVideoInfo(data);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching video info.');
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = async (formatStr, quality, ext) => {
    if (!videoInfo) return;
    
    const downloadId = Math.random().toString(36).substring(2, 9);
    
    setPreparingDownload({
      id: downloadId,
      progress: 0,
      speed: '0 KB/s',
      eta: 'Initializing...',
      status: 'downloading',
      title: videoInfo.title
    });

    try {
      // Step 1: Tell backend to start preparing the download in the background
      const prepareRes = await fetch(`${API_BASE}/api/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.originalUrl,
          format_str: formatStr,
          ext: ext,
          title: videoInfo.title,
          id: downloadId
        })
      });

      const prepareData = await prepareRes.json();
      if (!prepareRes.ok) {
        throw new Error(prepareData.error || 'Failed to start download');
      }

      // Step 2: Poll progress until completed or error
      const pollInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`${API_BASE}/api/progress?id=${downloadId}`);
          const progressData = await progressRes.json();

          if (!progressRes.ok) {
            clearInterval(pollInterval);
            setPreparingDownload(null);
            setError(progressData.error || 'Error checking download status');
            return;
          }

          setPreparingDownload(prev => ({
            ...prev,
            progress: progressData.progress,
            speed: progressData.speed,
            eta: progressData.eta,
            status: progressData.status
          }));

          if (progressData.status === 'completed') {
            clearInterval(pollInterval);
            
            // Add to local history
            saveToHistory(videoInfo, quality, ext);
            
            // Trigger actual browser download
            window.location.href = `${API_BASE}/api/download-ready?id=${downloadId}`;
            
            // Clear preparing state after brief success delay
            setTimeout(() => {
              setPreparingDownload(null);
            }, 1000);
          } else if (progressData.status === 'error') {
            clearInterval(pollInterval);
            setError(progressData.error || 'Download failed');
            setPreparingDownload(null);
          }
        } catch (pollErr) {
          console.error('Error polling progress:', pollErr);
          clearInterval(pollInterval);
          setPreparingDownload(null);
        }
      }, 600);

    } catch (err) {
      setError(err.message || 'Failed to start video download.');
      setPreparingDownload(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openQrModal = (urlToShare) => {
    const encoded = encodeURIComponent(urlToShare);
    // Use stable public qr server
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encoded}`);
    setShowQrModal(true);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown Size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
  };

  const platform = detectPlatform(url);

  return (
    <div className="relative min-h-screen pb-20 selection:bg-purple-600/30">
      {/* Background elements */}
      <div className="mesh-bg" />
      
      {/* Top Banner glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-40 bg-gradient-to-r from-purple-600/10 via-pink-500/10 to-indigo-600/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Download className="text-white" size={20} />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              SnapFlow
            </span>
            <span className="text-[10px] block font-medium uppercase tracking-wider text-purple-400">
              Media Downloader
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <a
            href="#history"
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <History size={16} />
            History
          </a>
          <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700/50 px-2.5 py-1 rounded-full font-medium shadow-sm">
            v2.1
          </span>
        </div>
      </header>

      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-purple-500 m-4 rounded-3xl transition-all duration-300">
          <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 animate-bounce mb-4">
            <Link2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Drop Link to Instant Analyze</h2>
          <p className="text-slate-400">Supports YouTube, TikTok, Instagram & Facebook</p>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 mt-12 md:mt-20">
        
        {/* Intro */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-6 shadow-sm">
            <Sparkles size={12} className="animate-pulse" />
            Paste a link, drag it in, or just hit paste anywhere!
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-white leading-none">
            Download Anything,<br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              In Pure High-Quality.
            </span>
          </h1>
          
          <p className="text-slate-400 max-w-xl mx-auto text-base md:text-lg">
            Download high-quality MP4 video streams or MP3 files from YouTube, Instagram, Facebook, and TikTok. 
          </p>
        </div>

        {/* Input Form */}
        <div className="glass-panel rounded-2xl p-2.5 shadow-xl max-w-2xl mx-auto mb-10 transition-all">
          <form
            onSubmit={(e) => { e.preventDefault(); analyzeVideo(); }}
            className="flex flex-col sm:flex-row items-center gap-2"
          >
            <div className="relative w-full flex-1">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors duration-300">
                {getPlatformIcon(platform, 20)}
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video URL here (e.g. YouTube, Instagram...)"
                className="w-full pl-12 pr-10 py-3.5 bg-transparent border-0 outline-none text-white placeholder-slate-500 text-sm md:text-base font-medium rounded-xl transition-all"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !url}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Search size={18} className="group-hover:scale-110 transition-transform" />
                  Analyze Video
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3.5 rounded-xl flex items-start gap-3 animate-shake">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Shimmer loading state */}
        {loading && (
          <div className="max-w-3xl mx-auto glass-panel rounded-2xl p-6 shadow-xl animate-pulse-slow">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-5/12 aspect-video rounded-xl bg-slate-800/40 relative overflow-hidden">
                <div className="absolute inset-0 shimmer-bg animate-shimmer" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="h-6 w-3/4 bg-slate-800/40 rounded-md relative overflow-hidden">
                  <div className="absolute inset-0 shimmer-bg animate-shimmer" />
                </div>
                <div className="h-4 w-1/3 bg-slate-800/40 rounded-md relative overflow-hidden">
                  <div className="absolute inset-0 shimmer-bg animate-shimmer" />
                </div>
                <div className="space-y-2 pt-4">
                  <div className="h-4 w-full bg-slate-800/40 rounded-md relative overflow-hidden" />
                  <div className="h-4 w-5/6 bg-slate-800/40 rounded-md relative overflow-hidden" />
                </div>
              </div>
            </div>
            <div className="mt-8 border-t border-slate-800/60 pt-6 flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-purple-400" size={24} />
              <p className="text-sm font-semibold text-slate-300 transition-all duration-500">
                {steps[loadingStep]}
              </p>
              <div className="w-full max-w-xs bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 transition-all duration-1000 ease-out"
                  style={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Video Download Dashboard Card */}
        {videoInfo && !loading && (
          <div className="max-w-3xl mx-auto glass-panel rounded-2xl p-5 md:p-6 shadow-2xl border-purple-500/10 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6">
              
              {/* Thumbnail side */}
              <div className="w-full md:w-5/12 shrink-0">
                <div className="relative aspect-video rounded-xl overflow-hidden shadow-inner group bg-slate-900 border border-slate-800/50">
                  <img
                    src={videoInfo.thumbnail}
                    alt={videoInfo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  {videoInfo.duration > 0 && (
                    <span className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded text-xs font-semibold text-white tracking-wider border border-white/5">
                      {formatDuration(videoInfo.duration)}
                    </span>
                  )}
                  <span className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded text-[11px] font-bold border flex items-center gap-1.5 backdrop-blur-md shadow-md capitalize ${getPlatformBrandColor(videoInfo.platform)}`}>
                    {getPlatformIcon(videoInfo.platform, 12)}
                    {videoInfo.platform}
                  </span>
                </div>
                
                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => copyToClipboard(videoInfo.originalUrl, 'link')}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all"
                  >
                    {copiedId === 'link' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copiedId === 'link' ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => openQrModal(videoInfo.originalUrl)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900/80 transition-all"
                  >
                    <QrCode size={14} />
                    Share QR
                  </button>
                </div>
              </div>

              {/* Download Option side */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-white line-clamp-2 leading-snug mb-1">
                    {videoInfo.title}
                  </h3>
                  <p className="text-xs font-medium text-slate-400">
                    By <span className="text-slate-300">{videoInfo.uploader}</span>
                  </p>
                </div>

                {/* Qualities tabs */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-2.5 flex items-center gap-1.5">
                      <Film size={12} />
                      Available Video Quality
                    </h4>
                    
                    {videoInfo.videoQualities && videoInfo.videoQualities.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {videoInfo.videoQualities.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-900/40 border border-slate-800/80 hover:border-purple-500/30 rounded-xl p-3 flex items-center justify-between transition-all group"
                          >
                            <div>
                              <div className="font-semibold text-sm text-slate-200 group-hover:text-purple-300 transition-colors">
                                {item.quality}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                MP4 • {formatSize(item.filesize)}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => triggerDownload(item.format_str, item.quality, 'mp4')}
                              className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-purple-600 text-slate-300 group-hover:text-white flex items-center justify-center shadow-md shadow-black/10 active:scale-90 transition-all"
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-slate-500 py-2">
                        No separate video qualities found. Downloading auto best format recommended.
                      </div>
                    )}
                  </div>

                  {/* Audio quality */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-pink-400 mb-2.5 flex items-center gap-1.5">
                      <Music size={12} />
                      Extract Audio Only
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {videoInfo.audioQualities.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/40 border border-slate-800/80 hover:border-pink-500/30 rounded-xl p-3 flex items-center justify-between transition-all group"
                        >
                          <div>
                            <div className="font-semibold text-sm text-slate-200 group-hover:text-pink-300 transition-colors">
                              {item.quality}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {item.ext.toUpperCase()} • {formatSize(item.filesize)}
                            </div>
                          </div>
                          <button
                            onClick={() => triggerDownload(item.format_str, 'Audio', item.ext)}
                            className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-pink-600 text-slate-300 group-hover:text-white flex items-center justify-center shadow-md shadow-black/10 active:scale-90 transition-all"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Download History Section */}
        <div id="history" className="mt-20 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <History size={18} className="text-purple-400" />
              Download History
            </h3>
            {downloadHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs font-semibold text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 size={12} />
                Clear All
              </button>
            )}
          </div>

          {downloadHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {downloadHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 flex gap-3 items-center hover:border-slate-850 hover:bg-slate-900/10 transition-all"
                >
                  <div className="relative w-20 aspect-video rounded-lg overflow-hidden shrink-0 border border-slate-900">
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <span className="absolute top-1 left-1 p-0.5 rounded-full bg-slate-950/70 border border-white/5">
                      {getPlatformIcon(item.platform, 8)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-xs text-slate-200 truncate mb-0.5">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium mb-1">
                      {item.uploader}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.5 rounded text-purple-300 font-bold uppercase">
                        {item.quality}
                      </span>
                      <span className="text-[9px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-bold uppercase">
                        {item.ext}
                      </span>
                      <span className="text-[9px] text-slate-650 ml-auto">
                        {item.date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-8 text-center text-slate-500 border-dashed border-slate-800/80">
              <p className="text-sm font-medium">No downloads yet. Paste a URL and get streaming!</p>
            </div>
          )}
        </div>
      </main>

      {/* Progress Floating Modal */}
      {preparingDownload && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border-purple-500/25 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base truncate pr-4">
                {preparingDownload.status === 'processing' ? 'Processing file...' : 'Downloading Streams...'}
              </h3>
              <Loader2 className="animate-spin text-purple-400 shrink-0" size={18} />
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-300 font-semibold truncate">
                {preparingDownload.title}
              </p>
            </div>

            <div className="space-y-4">
              {/* Progress percentage bar */}
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-850">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${preparingDownload.progress}%` }}
                />
              </div>

              {/* Progress details */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-400">
                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-900">
                  <div className="text-[10px] uppercase text-purple-400 font-bold mb-0.5">Progress</div>
                  <div className="text-white text-sm">{preparingDownload.progress.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-900">
                  <div className="text-[10px] uppercase text-purple-400 font-bold mb-0.5">Speed</div>
                  <div className="text-white text-xs truncate mt-0.5">{preparingDownload.speed}</div>
                </div>
                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-900">
                  <div className="text-[10px] uppercase text-purple-400 font-bold mb-0.5">ETA</div>
                  <div className="text-white text-xs truncate mt-0.5">{preparingDownload.eta}</div>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center">
              <p className="text-[10px] text-slate-500 font-medium">
                {preparingDownload.status === 'processing' 
                  ? 'Merging audio & video channels. This might take a moment...' 
                  : 'Downloading high-quality video and audio channels separately.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Share Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-45 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-6 shadow-2xl border-white/10 relative animate-fade-in">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <h3 className="font-bold text-lg text-white mb-2 flex items-center justify-center gap-1.5">
                <QrCode size={18} className="text-purple-400" />
                Scan to Share
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Scan this QR code with your mobile device to open the download link instantly.
              </p>
              
              <div className="w-48 h-48 mx-auto bg-white rounded-xl p-3 border border-slate-800 shadow-md flex items-center justify-center">
                <img src={qrUrl} alt="QR Code" className="w-full h-full" />
              </div>

              <button
                onClick={() => {
                  copyToClipboard(url, 'modal-copy');
                }}
                className="mt-6 w-full py-2.5 rounded-xl font-semibold bg-slate-900 border border-slate-850 hover:bg-slate-800 text-xs text-slate-200 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                {copiedId === 'modal-copy' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copiedId === 'modal-copy' ? 'Copied Link!' : 'Copy Original URL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
