import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import ffprobe from '@ffprobe-installer/ffprobe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://fadywael111.github.io'
  ],
  credentials: true
}));
app.use(express.json());

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const ffmpegPath = ffmpeg.path;
const ffprobePath = ffprobe.path;
const pythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');

// In-memory store for active downloads progress
const activeDownloads = new Map();

// Clean up old files in temp directory on startup
try {
  fs.readdirSync(tempDir).forEach(file => {
    fs.unlinkSync(path.join(tempDir, file));
  });
} catch (err) {
  console.error('Failed to clean temp directory:', err);
}

// Utility to parse size string to bytes or human readable format
function getPlatformIcon(extractor) {
  if (!extractor) return 'globe';
  const name = extractor.toLowerCase();
  if (name.includes('youtube')) return 'youtube';
  if (name.includes('facebook')) return 'facebook';
  if (name.includes('tiktok')) return 'tiktok';
  if (name.includes('instagram')) return 'instagram';
  return 'video';
}

// Endpoint 1: Fetch Video Metadata
app.get('/api/info', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  console.log(`Fetching metadata for: ${videoUrl}`);

  // Run yt-dlp dump-json
  const args = [
    '-m', 'yt_dlp',
    '--dump-json',
    '--no-warnings',
    '--no-playlist',
    videoUrl
  ];

  const child = spawn(pythonPath, args);
  let stdoutData = '';
  let stderrData = '';

  child.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`yt-dlp failed with code ${code}. Stderr: ${stderrData}`);
      let errorMessage = 'Failed to retrieve video information.';
      if (stderrData.includes('Unsupported URL')) {
        errorMessage = 'Unsupported video URL. Please check the link.';
      } else if (stderrData.includes('Sign in')) {
        errorMessage = 'This video is private or age-restricted and requires login.';
      }
      return res.status(400).json({ error: errorMessage });
    }

    try {
      const info = JSON.parse(stdoutData);
      
      // Extract formats and sort/filter them
      const formats = info.formats || [];
      const videoQualities = [];
      const audioQualities = [];

      // Find best audio format size for YouTube/separated platforms to estimate merged size
      const bestAudioFormat = formats
        .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
        .sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0))[0];
      const audioSize = bestAudioFormat ? (bestAudioFormat.filesize || bestAudioFormat.filesize_approx || 0) : 0;

      // Group and filter video formats
      const uniqueHeights = new Set();
      
      // Some platforms have combined formats, some have split formats
      formats.forEach(f => {
        if (f.vcodec !== 'none' && f.height) {
          const height = f.height;
          if (height >= 144 && !uniqueHeights.has(height)) {
            uniqueHeights.add(height);

            // Estimate total size
            let size = f.filesize || f.filesize_approx || 0;
            // If it's a video-only format (like YouTube 1080p), add the audio format size
            if (f.acodec === 'none' && audioSize) {
              size += audioSize;
            }

            let qualityLabel = `${height}p`;
            if (height >= 2160) qualityLabel += ' (4K)';
            else if (height >= 1440) qualityLabel += ' (2K)';
            else if (height >= 1080) qualityLabel += ' (Full HD)';
            else if (height >= 720) qualityLabel += ' (HD)';

            videoQualities.push({
              quality: qualityLabel,
              height: height,
              ext: 'mp4', // we will merge to mp4
              filesize: size,
              format_str: `bestvideo[height=${height}]+bestaudio/best`
            });
          }
        }
      });

      // Sort qualities descending by height
      videoQualities.sort((a, b) => b.height - a.height);

      // Add audio-only options
      audioQualities.push({
        quality: 'MP3 High Quality',
        ext: 'mp3',
        filesize: audioSize || 10 * 1024 * 1024, // fallback 10MB
        format_str: 'bestaudio'
      });
      audioQualities.push({
        quality: 'M4A Standard',
        ext: 'm4a',
        filesize: audioSize || 8 * 1024 * 1024,
        format_str: 'bestaudio'
      });

      const responseData = {
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : ''),
        duration: info.duration || 0,
        uploader: info.uploader || info.channel || 'Unknown Uploader',
        platform: getPlatformIcon(info.extractor),
        videoQualities,
        audioQualities,
        originalUrl: videoUrl
      };

      res.json(responseData);
    } catch (e) {
      console.error('Failed to parse yt-dlp output:', e);
      res.status(500).json({ error: 'Failed to process video metadata' });
    }
  });
});

// Endpoint 2: Prepare Download (Start background process and track progress)
app.post('/api/prepare', (req, res) => {
  const { url, format_str, ext, title, id } = req.body;

  if (!url || !format_str || !ext || !title || !id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  console.log(`Starting preparation for download: ${title} (${format_str})`);

  // Safe filename
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${id}_${safeTitle}.${ext}`;
  const outputPath = path.join(tempDir, filename);

  // Initialize status
  activeDownloads.set(id, {
    progress: 0,
    speed: '0 KB/s',
    eta: 'Calculating...',
    status: 'downloading',
    filePath: outputPath,
    filename: `${safeTitle}.${ext}`,
    error: null
  });

  // Prepare arguments
  const args = [
    '-m', 'yt_dlp',
    '-f', format_str,
    '--ffmpeg-location', ffmpegPath,
    '--no-playlist',
    '--newline',
    '-o', outputPath,
    url
  ];

  // If audio-only conversion is requested
  if (ext === 'mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (ext === 'm4a') {
    args.push('-x', '--audio-format', 'm4a');
  } else {
    // For video, force MP4 merge and transcode audio to AAC for maximum compatibility
    args.push('--merge-output-format', 'mp4');
    args.push('--postprocessor-args', 'merger:-c:a aac');
  }

  const child = spawn(pythonPath, args);

  child.stdout.on('data', (data) => {
    const line = data.toString().trim();
    console.log(`[yt-dlp][${id}] ${line}`);

    // Parse progress. Example output:
    // [download]  12.5% of 20.00MiB at 5.00MiB/s ETA 00:03
    if (line.includes('[download]') && line.includes('%')) {
      const percentMatch = line.match(/(\d+\.\d+)%/);
      const speedMatch = line.match(/at\s+([^\s]+)/);
      const etaMatch = line.match(/ETA\s+([^\s]+)/);

      const downloadState = activeDownloads.get(id);
      if (downloadState) {
        if (percentMatch) downloadState.progress = parseFloat(percentMatch[1]);
        if (speedMatch) downloadState.speed = speedMatch[1];
        if (etaMatch) downloadState.eta = etaMatch[1];
        activeDownloads.set(id, downloadState);
      }
    } else if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
      const downloadState = activeDownloads.get(id);
      if (downloadState) {
        downloadState.status = 'processing'; // merging or converting
        downloadState.progress = 99; // almost done
        activeDownloads.set(id, downloadState);
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`[yt-dlp-err][${id}] ${data.toString()}`);
  });

  child.on('close', (code) => {
    const downloadState = activeDownloads.get(id);
    if (!downloadState) return;

    if (code === 0) {
      console.log(`Download preparation completed for: ${id}`);
      downloadState.status = 'completed';
      downloadState.progress = 100;
      // Handle actual file extension if ffmpeg changed it (e.g. merging to mp4 or converting to mp3)
      // Check if file exists. If it merged to .mp4 or changed, check it
      let finalPath = outputPath;
      if (!fs.existsSync(finalPath)) {
        // sometimes yt-dlp adds the ext automatically
        const baseWithoutExt = outputPath.substring(0, outputPath.lastIndexOf('.'));
        const files = fs.readdirSync(tempDir);
        const matchedFile = files.find(f => f.startsWith(id + '_'));
        if (matchedFile) {
          finalPath = path.join(tempDir, matchedFile);
          downloadState.filePath = finalPath;
          downloadState.filename = matchedFile.substring((id + '_').length);
        }
      }
      activeDownloads.set(id, downloadState);
    } else {
      console.error(`Download preparation failed for: ${id} with code ${code}`);
      downloadState.status = 'error';
      downloadState.error = 'Failed during download or merging. Stream may be protected.';
      activeDownloads.set(id, downloadState);
    }
  });

  // Acknowledge request started
  res.json({ success: true, message: 'Download preparation started' });
});

// Endpoint 3: Check Download Progress
app.get('/api/progress', (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  const downloadState = activeDownloads.get(id);
  if (!downloadState) {
    return res.status(404).json({ error: 'Download not found' });
  }

  res.json({
    progress: downloadState.progress,
    speed: downloadState.speed,
    eta: downloadState.eta,
    status: downloadState.status,
    error: downloadState.error
  });
});

// Endpoint 4: Get File (Triggers browser download)
app.get('/api/download-ready', (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('ID is required');
  }

  const downloadState = activeDownloads.get(id);
  if (!downloadState || downloadState.status !== 'completed') {
    return res.status(404).send('Download is not ready or has expired');
  }

  const filePath = downloadState.filePath;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found on server');
  }

  console.log(`Streaming file to client: ${downloadState.filename}`);

  res.download(filePath, downloadState.filename, (err) => {
    // Delete file after download finishes or fails
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted temp file: ${filePath}`);
      }
      activeDownloads.delete(id);
    } catch (unlinkErr) {
      console.error('Failed to delete temp file:', unlinkErr);
    }
  });
});

// Serve static assets in production if build exists
const frontendDistPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Ffmpeg path: ${ffmpegPath}`);
});
