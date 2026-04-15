import { useState, useRef, useCallback, useEffect } from 'react';
import { addSong } from '../utils/db';
import {
  IoCloudUpload, IoMusicalNote, IoCheckmarkCircle,
  IoLogoYoutube, IoLink, IoAlertCircle, IoDownload, IoClose
} from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './Pages.css';

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function getAudioDuration(dataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio(dataUrl);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => resolve(0));
  });
}

const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|3gp)$/i;
const AUDIO_EXTS = /\.(mp3|wav|ogg|flac|m4a|aac)$/i;

function extractMetadata(file) {
  const name = file.name.replace(/\.(mp3|wav|ogg|flac|m4a|aac|mp4|mkv|avi|mov|webm|flv|wmv|m4v|3gp)$/i, '');
  const parts = name.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: '', title: name.trim() };
}

// Convert video file to audio data URL by extracting the audio track
async function videoToAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  // Render to WAV via OfflineAudioContext
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(
    decoded.numberOfChannels,
    Math.ceil(decoded.duration * sampleRate),
    sampleRate
  );
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();

  // Encode as WAV
  const numCh = rendered.numberOfChannels;
  const length = rendered.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeStr(off, str) { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, val, true);
      offset += 2;
    }
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, duration: decoded.duration });
    reader.readAsDataURL(blob);
  });
}

export default function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const [uploadType, setUploadType] = useState('music');
  const [uploadCategory, setUploadCategory] = useState('');
  const inputRef = useRef(null);

  // YouTube state
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [ytProgress, setYtProgress] = useState('');
  const [ytAvailable, setYtAvailable] = useState(null);

  const [ytVersion, setYtVersion] = useState('');

  // Check yt-dlp on mount + subscribe to progress
  useEffect(() => {
    if (window.electronAPI?.ytdlp) {
      window.electronAPI.ytdlp.check().then(res => {
        setYtAvailable(res.available);
        if (res.version) setYtVersion(res.version);
      });
      const unsub = window.electronAPI.ytdlp.onProgress?.((msg) => {
        setYtProgress(msg);
      });
      return () => { if (unsub) unsub(); };
    } else {
      setYtAvailable(false);
    }
  }, []);

  const [convertProgress, setConvertProgress] = useState('');

  const processFiles = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(f =>
      AUDIO_EXTS.test(f.name) || VIDEO_EXTS.test(f.name)
    );

    if (validFiles.length === 0) return;
    setUploading(true);

    for (const file of validFiles) {
      const { title, artist } = extractMetadata(file);
      const isVideo = VIDEO_EXTS.test(file.name);
      let audioUrl, duration;

      if (isVideo) {
        setConvertProgress(`Converting "${file.name}" to audio...`);
        try {
          const result = await videoToAudio(file);
          audioUrl = result.dataUrl;
          duration = result.duration;
        } catch (e) {
          console.error('Video conversion failed:', e);
          setConvertProgress(`Failed to convert "${file.name}" — ${e.message}`);
          await new Promise(r => setTimeout(r, 2000));
          setConvertProgress('');
          continue;
        }
        setConvertProgress('');
      } else {
        audioUrl = await readFileAsDataURL(file);
        duration = await getAudioDuration(audioUrl);
      }

      const song = {
        id: uuidv4(),
        title, artist, duration, audioUrl,
        artwork: null, addedAt: Date.now(), fileSize: file.size,
        type: uploadType, category: uploadCategory,
        tags: isVideo ? ['converted'] : [],
      };

      await addSong(song);
      setUploaded(prev => [...prev, song]);
    }

    setUploading(false);
  }, [uploadType, uploadCategory]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // Parse URLs from input (one per line, ignore blank lines and non-URLs)
  function parseUrls(text) {
    return text.split(/[\n,]+/).map(s => s.trim()).filter(s =>
      s.startsWith('http://') || s.startsWith('https://') || s.startsWith('youtu')
    );
  }

  const [ytBatchMode, setYtBatchMode] = useState(false);
  const [ytQueue, setYtQueue] = useState([]); // { url, status: 'pending'|'downloading'|'done'|'error', title?, error? }

  async function downloadOne(url) {
    const result = await window.electronAPI.ytdlp.download(url);
    const song = {
      id: uuidv4(),
      title: result.title, artist: result.artist, duration: result.duration,
      audioUrl: result.audioUrl, artwork: result.thumbnail,
      addedAt: Date.now(), fileSize: 0, type: uploadType, category: uploadCategory, tags: ['youtube'],
    };
    await addSong(song);
    setUploaded(prev => [...prev, song]);
    return result.title;
  }

  async function handleYtDownload() {
    const urls = parseUrls(ytUrl);
    if (urls.length === 0) return;
    if (!window.electronAPI?.ytdlp) {
      setYtError('YouTube download only works in the desktop app (Electron).');
      return;
    }

    setYtError('');

    if (urls.length === 1 && !ytBatchMode) {
      // Single download
      setYtLoading(true);
      setYtProgress('Starting...');
      try {
        const title = await downloadOne(urls[0]);
        setYtUrl('');
        setYtProgress(`Done: ${title}`);
        setTimeout(() => setYtProgress(''), 3000);
      } catch (err) {
        setYtError(err.message || 'Download failed.');
        setYtProgress('');
      } finally {
        setYtLoading(false);
      }
    } else {
      // Batch download
      const queue = urls.map(url => ({ url, status: 'pending', title: null, error: null }));
      setYtQueue(queue);
      setYtLoading(true);
      setYtUrl('');

      for (let i = 0; i < queue.length; i++) {
        setYtQueue(q => q.map((item, j) => j === i ? { ...item, status: 'downloading' } : item));
        setYtProgress(`Downloading ${i + 1} of ${queue.length}...`);
        try {
          const title = await downloadOne(queue[i].url);
          setYtQueue(q => q.map((item, j) => j === i ? { ...item, status: 'done', title } : item));
        } catch (err) {
          setYtQueue(q => q.map((item, j) => j === i ? { ...item, status: 'error', error: err.message } : item));
        }
      }

      setYtLoading(false);
      setYtProgress('Batch complete!');
      setTimeout(() => setYtProgress(''), 5000);
    }
  }

  function handleYtCancel() {
    if (window.electronAPI?.ytdlp?.cancel) window.electronAPI.ytdlp.cancel();
    setYtLoading(false);
    setYtProgress('');
    setYtQueue([]);
    setYtError('Download cancelled.');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Upload & Import</h1>
        <p className="subtitle">Add files from your computer or import from YouTube</p>
      </div>

      {/* Upload options */}
      <div className="upload-options">
        <div className="upload-option-group">
          <label className="upload-label">Save as</label>
          <div className="upload-type-toggle">
            <button className={`type-btn ${uploadType === 'music' ? 'active' : ''}`} onClick={() => setUploadType('music')}>
              <IoMusicalNote /> Music
            </button>
            <button className={`type-btn ${uploadType === 'sfx' ? 'active' : ''}`} onClick={() => setUploadType('sfx')}>
              <IoMusicalNote /> SFX
            </button>
          </div>
        </div>
        <div className="upload-option-group">
          <label className="upload-label">Category (optional)</label>
          <select className="upload-select" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
            <option value="">None</option>
            <option value="Music">Music</option>
            <option value="SFX">SFX</option>
            <option value="Ambient">Ambient</option>
            <option value="Vocal">Vocal</option>
            <option value="Beat">Beat</option>
            <option value="Loop">Loop</option>
            <option value="Sample">Sample</option>
            <option value="Notification">Notification</option>
            <option value="UI Sound">UI Sound</option>
            <option value="Foley">Foley</option>
            <option value="Transition">Transition</option>
          </select>
        </div>
      </div>

      {/* File upload */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="audio/*,video/mp4,video/webm,video/x-matroska,video/quicktime,video/avi,video/*" multiple style={{ display: 'none' }}
          onChange={(e) => processFiles(e.target.files)} />
        <div className="upload-icon"><IoCloudUpload /></div>
        <h3>{uploading ? (convertProgress || 'Processing...') : 'Drag & drop your files here'}</h3>
        <p>Audio: MP3, WAV, OGG, FLAC, M4A, AAC</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Video: MP4, MKV, AVI, MOV, WEBM — auto-converts to audio</p>
      </div>

      {/* YouTube import */}
      <div className="yt-section">
        <div className="yt-header">
          <IoLogoYoutube className="yt-icon" />
          <div>
            <h3>Import from YouTube</h3>
            <p>Paste one URL or multiple (one per line) for batch import</p>
          </div>
          {ytAvailable === true && ytVersion && (
            <span className="yt-ready">v{ytVersion}</span>
          )}
        </div>

        {ytAvailable === false && (
          <div className="yt-notice">
            <IoAlertCircle />
            <div>
              <strong>yt-dlp not found</strong>
              <p>Install <code>yt-dlp</code> and <code>ffmpeg</code> to enable YouTube imports.
              This feature only works in the desktop app.</p>
            </div>
          </div>
        )}

        {/* Toggle single/batch */}
        <div className="yt-mode-toggle">
          <button className={`type-btn ${!ytBatchMode ? 'active' : ''}`} onClick={() => setYtBatchMode(false)}>Single</button>
          <button className={`type-btn ${ytBatchMode ? 'active' : ''}`} onClick={() => setYtBatchMode(true)}>Batch Import</button>
        </div>

        {ytBatchMode ? (
          <textarea
            className="yt-textarea"
            placeholder={"Paste multiple YouTube URLs, one per line:\nhttps://youtube.com/watch?v=abc123\nhttps://youtube.com/watch?v=xyz789\nhttps://youtu.be/short"}
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            disabled={ytLoading}
            rows={5}
          />
        ) : (
          <div className="yt-input-row">
            <IoLink className="yt-link-icon" />
            <input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={ytUrl}
              onChange={e => setYtUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !ytLoading && handleYtDownload()}
              className="yt-input"
              disabled={ytLoading}
            />
          </div>
        )}

        <div className="yt-actions">
          {ytLoading ? (
            <button className="yt-cancel-btn" onClick={handleYtCancel}><IoClose /> Cancel</button>
          ) : (
            <button className="yt-download-btn" onClick={handleYtDownload} disabled={!ytUrl.trim()}>
              <IoDownload /> {ytBatchMode ? `Download ${parseUrls(ytUrl).length} videos` : 'Download'}
            </button>
          )}
        </div>

        {/* Live progress */}
        {ytProgress && (
          <div className="yt-progress">
            <span className="yt-spinner" />
            <span>{ytProgress}</span>
          </div>
        )}

        {/* Batch queue status */}
        {ytQueue.length > 0 && (
          <div className="yt-batch-queue">
            {ytQueue.map((item, i) => (
              <div key={i} className={`yt-batch-item ${item.status}`}>
                <span className="yt-batch-status">
                  {item.status === 'pending' && '...'}
                  {item.status === 'downloading' && <span className="yt-spinner" />}
                  {item.status === 'done' && <IoCheckmarkCircle />}
                  {item.status === 'error' && <IoAlertCircle />}
                </span>
                <span className="yt-batch-title">{item.title || item.url}</span>
                {item.error && <span className="yt-batch-error">{item.error.slice(0, 60)}</span>}
              </div>
            ))}
          </div>
        )}

        {ytError && <div className="yt-error"><IoAlertCircle /> {ytError}</div>}
      </div>

      {/* Results */}
      {uploaded.length > 0 && (
        <div className="upload-results">
          <h3>Added ({uploaded.length})</h3>
          <div className="uploaded-list">
            {uploaded.map(song => (
              <div key={song.id} className="uploaded-item">
                <IoCheckmarkCircle className="uploaded-check" />
                <IoMusicalNote className="uploaded-note" />
                <div className="uploaded-info">
                  <span className="uploaded-title">{song.title}</span>
                  <span className="uploaded-artist">{song.artist || 'Unknown Artist'}</span>
                </div>
                <span className="uploaded-type-badge">{song.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
