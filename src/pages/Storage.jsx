import { useState, useEffect, useCallback } from 'react';
import { getAllSongs, getAllFolders, deleteCompletely, updateSong } from '../utils/db';
import { IoTrash, IoServer, IoMusicalNotes, IoVolumeHigh, IoFolder, IoResize } from 'react-icons/io5';
import './Pages.css';
import './Storage.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSizeBig(bytes) {
  if (bytes < 1024 * 1024) return { value: (bytes / 1024).toFixed(1), unit: 'KB' };
  if (bytes < 1024 * 1024 * 1024) return { value: (bytes / (1024 * 1024)).toFixed(2), unit: 'MB' };
  return { value: (bytes / (1024 * 1024 * 1024)).toFixed(2), unit: 'GB' };
}

function getSongSize(song) {
  if (!song.audioUrl) return 0;
  return Math.floor(song.audioUrl.length * 0.75);
}

async function compressSong(song, quality = 0.5) {
  // Decode audio, re-encode at lower quality using OfflineAudioContext + MediaRecorder
  const resp = await fetch(song.audioUrl);
  const arrayBuf = await resp.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  audioCtx.close();

  // Render through offline context at lower sample rate for smaller size
  const sampleRate = quality < 0.4 ? 22050 : 44100;
  const offline = new OfflineAudioContext(decoded.numberOfChannels, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();

  // Encode to WAV (browser-native, no external libs needed)
  const wavBlob = audioBufferToWav(rendered);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(wavBlob);
  });
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const data = [];
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const val = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      data.push(val & 0xFF, (val >> 8) & 0xFF);
    }
  }
  const dataBytes = new Uint8Array(data);
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataBytes.length);
  const view = new DataView(wav);
  function writeStr(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes.length, true);
  new Uint8Array(wav, headerSize).set(dataBytes);
  return new Blob([wav], { type: 'audio/wav' });
}

export default function Storage() {
  const [songs, setSongs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compressing, setCompressing] = useState(null);
  const [compressResult, setCompressResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [s, f] = await Promise.all([getAllSongs(), getAllFolders()]);
    setSongs(s);
    setFolders(f);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this file permanently? This cannot be undone.')) return;
    await deleteCompletely(id);
    setSongs(prev => prev.filter(s => s.id !== id));
  }

  async function handleCompress(song) {
    setCompressing(song.id);
    setCompressResult(null);
    try {
      const oldSize = getSongSize(song);
      const newAudioUrl = await compressSong(song, 0.5);
      const newSize = Math.floor(newAudioUrl.length * 0.75);
      const saved = oldSize - newSize;
      if (saved > 0) {
        const updated = { ...song, audioUrl: newAudioUrl };
        await updateSong(updated);
        setSongs(prev => prev.map(s => s.id === song.id ? updated : s));
        setCompressResult({ id: song.id, saved, newSize, oldSize });
      } else {
        setCompressResult({ id: song.id, saved: 0, msg: 'Already optimized' });
      }
    } catch (e) {
      setCompressResult({ id: song.id, error: e.message });
    }
    setCompressing(null);
  }

  async function handleCompressAll() {
    const largeSongs = [...songs]
      .filter(s => getSongSize(s) > 1024 * 1024) // Only compress files > 1MB
      .sort((a, b) => getSongSize(b) - getSongSize(a));
    if (largeSongs.length === 0) { setCompressResult({ msg: 'No large files to compress' }); return; }
    if (!window.confirm(`Compress ${largeSongs.length} files over 1MB? This re-encodes audio at lower quality to save space. This cannot be undone.`)) return;
    setCompressing('all');
    let totalSaved = 0;
    for (const song of largeSongs) {
      try {
        const oldSize = getSongSize(song);
        const newAudioUrl = await compressSong(song, 0.5);
        const newSize = Math.floor(newAudioUrl.length * 0.75);
        const saved = oldSize - newSize;
        if (saved > 0) {
          const updated = { ...song, audioUrl: newAudioUrl };
          await updateSong(updated);
          setSongs(prev => prev.map(s => s.id === song.id ? updated : s));
          totalSaved += saved;
        }
      } catch {}
    }
    setCompressResult({ msg: `Compressed! Saved ${formatSize(totalSaved)} total.` });
    setCompressing(null);
  }

  const totalBytes = songs.reduce((sum, s) => sum + getSongSize(s), 0);
  const totalFormatted = formatSizeBig(totalBytes);

  // Breakdown by type
  const musicSongs = songs.filter(s => s.type !== 'sfx');
  const sfxSongs = songs.filter(s => s.type === 'sfx');
  const musicBytes = musicSongs.reduce((sum, s) => sum + getSongSize(s), 0);
  const sfxBytes = sfxSongs.reduce((sum, s) => sum + getSongSize(s), 0);

  // Breakdown by folder
  const folderMap = {};
  for (const f of folders) {
    folderMap[f.id] = { ...f, bytes: 0, count: 0 };
  }
  folderMap['_none'] = { id: '_none', name: 'Unfiled', color: '#6b7280', bytes: 0, count: 0 };
  for (const s of songs) {
    const key = s.folderId && folderMap[s.folderId] ? s.folderId : '_none';
    folderMap[key].bytes += getSongSize(s);
    folderMap[key].count += 1;
  }
  const folderBreakdown = Object.values(folderMap)
    .filter(f => f.count > 0)
    .sort((a, b) => b.bytes - a.bytes);

  // Top 10 largest
  const sortedSongs = [...songs]
    .map(s => ({ ...s, size: getSongSize(s) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const maxTypeBytes = Math.max(musicBytes, sfxBytes, 1);

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Storage</h1>
          <p className="subtitle">Loading storage data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Storage</h1>
        <p className="subtitle">Manage your local storage usage</p>
      </div>

      {/* Total storage */}
      <div className="storage-total-card">
        <IoServer className="storage-total-icon" />
        <div className="storage-total-info">
          <span className="storage-total-value">{totalFormatted.value}</span>
          <span className="storage-total-unit">{totalFormatted.unit}</span>
          <span className="storage-total-label">Total storage used across {songs.length} files</span>
        </div>
      </div>

      {/* Breakdown by type */}
      <div className="section">
        <h3 className="section-title">
          <IoMusicalNotes /> By Type
        </h3>
        <div className="storage-bar-chart">
          <div className="storage-bar-row">
            <span className="storage-bar-label">Music ({musicSongs.length})</span>
            <div className="storage-bar-track">
              <div
                className="storage-bar-fill music"
                style={{ width: `${(musicBytes / maxTypeBytes) * 100}%` }}
              />
            </div>
            <span className="storage-bar-value">{formatSize(musicBytes)}</span>
          </div>
          <div className="storage-bar-row">
            <span className="storage-bar-label">SFX ({sfxSongs.length})</span>
            <div className="storage-bar-track">
              <div
                className="storage-bar-fill sfx"
                style={{ width: `${(sfxBytes / maxTypeBytes) * 100}%` }}
              />
            </div>
            <span className="storage-bar-value">{formatSize(sfxBytes)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown by folder */}
      {folderBreakdown.length > 0 && (
        <div className="section">
          <h3 className="section-title">
            <IoFolder /> By Folder
          </h3>
          <div className="storage-bar-chart">
            {folderBreakdown.map(f => {
              const maxFolderBytes = folderBreakdown[0]?.bytes || 1;
              return (
                <div className="storage-bar-row" key={f.id}>
                  <span className="storage-bar-label">
                    <span className="storage-folder-dot" style={{ background: f.color || '#8b5cf6' }} />
                    {f.name} ({f.count})
                  </span>
                  <div className="storage-bar-track">
                    <div
                      className="storage-bar-fill folder"
                      style={{
                        width: `${(f.bytes / maxFolderBytes) * 100}%`,
                        background: f.color || '#8b5cf6',
                      }}
                    />
                  </div>
                  <span className="storage-bar-value">{formatSize(f.bytes)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compress files */}
      <div className="section">
        <h3 className="section-title">
          <IoResize /> Compress Files
        </h3>
        <p className="section-desc">Re-encode audio at lower quality to save storage. This is irreversible.</p>
        <div className="storage-compress-row">
          <button
            className="storage-compress-btn"
            onClick={handleCompressAll}
            disabled={!!compressing}
          >
            {compressing === 'all' ? 'Compressing...' : 'Compress All Large Files (>1MB)'}
          </button>
        </div>
        {compressResult?.msg && (
          <p className="storage-compress-msg">{compressResult.msg}</p>
        )}
        {compressResult?.saved > 0 && (
          <p className="storage-compress-msg success">
            Saved {formatSize(compressResult.saved)} ({formatSize(compressResult.oldSize)} → {formatSize(compressResult.newSize)})
          </p>
        )}
        {compressResult?.error && (
          <p className="storage-compress-msg error">Error: {compressResult.error}</p>
        )}
      </div>

      {/* Top 10 largest files */}
      {sortedSongs.length > 0 && (
        <div className="section">
          <h3 className="section-title">
            <IoVolumeHigh /> Largest Files
          </h3>
          <div className="storage-file-list">
            {sortedSongs.map((s, i) => (
              <div className="storage-file-row" key={s.id}>
                <span className="storage-file-rank">{i + 1}</span>
                <div className="storage-file-info">
                  <span className="storage-file-title">{s.title}</span>
                  <span className="storage-file-artist">{s.artist || 'Unknown Artist'}</span>
                </div>
                <span className="storage-file-size">{formatSize(s.size)}</span>
                <button
                  className="storage-compress-sm"
                  onClick={() => handleCompress(s)}
                  disabled={!!compressing}
                  title="Compress this file"
                >
                  {compressing === s.id ? '...' : <IoResize />}
                </button>
                <button
                  className="storage-delete-btn"
                  onClick={() => handleDelete(s.id)}
                  title="Delete permanently"
                >
                  <IoTrash />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {songs.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><IoServer /></div>
          <p>No files stored yet. Upload some music to see storage usage.</p>
        </div>
      )}
    </div>
  );
}
