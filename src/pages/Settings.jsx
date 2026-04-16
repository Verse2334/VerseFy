import { useEffect, useState } from 'react';
import { IoKeypad, IoRefresh, IoRadioButtonOn, IoColorPalette, IoCode, IoCopy, IoCloudDownload, IoCloudUpload, IoTrash, IoEye, IoPerson, IoText, IoContrast, IoHardwareChip, IoTv, IoVideocam, IoLogoYoutube, IoMusicalNotes } from 'react-icons/io5';
import { useTheme } from '../context/ThemeContext';
import { usePlayer } from '../context/PlayerContext';
import { findDuplicates, exportLibrary, importLibrary, deleteCompletely } from '../utils/db';
import { getConfig as getVideoBgConfig, saveConfig as saveVideoBgConfig, addVideo, getAllVideos, deleteVideo, setActiveVideo, extractYouTubeId, formatBytes, onConfigChange as onVideoBgChange } from '../utils/videoBg';
import './Pages.css';
import './Settings.css';

const ACTION_LABELS = {
  playPause: 'Play / Pause',
  next: 'Next Track',
  prev: 'Previous Track',
  volumeUp: 'Volume Up',
  volumeDown: 'Volume Down',
};

export default function Settings() {
  const [hotkeys, setHotkeys] = useState({});
  const [defaults, setDefaults] = useState({});
  const [recording, setRecording] = useState(null);
  const [available, setAvailable] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const { showWallpaperViz, toggleWallpaperViz, audioRef } = usePlayer();
  const [customCSS, setCustomCSS] = useState(() => localStorage.getItem('versefy-custom-css') || '');
  const [duplicates, setDuplicates] = useState(null);
  const [dupScanning, setDupScanning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('versefy-username') || '');
  const [nameSaved, setNameSaved] = useState(false);
  const [customFont, setCustomFont] = useState(() => localStorage.getItem('versefy-font') || '');
  const [theaterMode, setTheaterMode] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(() => localStorage.getItem('versefy-audio-device') || 'default');
  const [obsRunning, setObsRunning] = useState(false);
  const [obsUrl, setObsUrl] = useState('');
  const [djModeEnabled, setDjModeEnabled] = useState(() => localStorage.getItem('versefy-dj-mode') === '1');
  const [videoBg, setVideoBg] = useState(getVideoBgConfig);
  const [videoLibrary, setVideoLibrary] = useState([]);
  const [videoBgMsg, setVideoBgMsg] = useState('');
  const [ytVideoUrl, setYtVideoUrl] = useState('');
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytProgress, setYtProgress] = useState('');

  // Check OBS overlay status
  useEffect(() => {
    if (window.electronAPI?.obs) {
      window.electronAPI.obs.status().then(s => { setObsRunning(s.running); if (s.url) setObsUrl(s.url); });
    }
  }, []);

  // Load audio output devices
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(() => {});
  }, []);

  // Apply custom font on mount
  useEffect(() => {
    if (customFont) {
      document.documentElement.style.setProperty('font-family', `'${customFont}', Inter, system-ui, sans-serif`);
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.hotkeys) {
      setAvailable(true);
      window.electronAPI.hotkeys.get().then(setHotkeys);
      window.electronAPI.hotkeys.getDefaults().then(setDefaults);
    }
  }, []);

  useEffect(() => {
    applyCustomCSS(customCSS);
  }, []);

  function updateVideoBg(partial) {
    const next = { ...videoBg, ...partial };
    setVideoBg(next);
    saveVideoBgConfig(next);
  }

  async function refreshVideoLibrary() {
    try { setVideoLibrary(await getAllVideos()); } catch {}
  }

  useEffect(() => {
    refreshVideoLibrary();
    return onVideoBgChange(() => {
      setVideoBg(getVideoBgConfig());
      refreshVideoLibrary();
    });
  }, []);

  async function handleVideoBgFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { setVideoBgMsg('Please choose a video file'); return; }
    const MAX = 4 * 1024 * 1024 * 1024; // 4 GB
    if (file.size > MAX) {
      setVideoBgMsg(`File too large (${formatBytes(file.size)}). Max is 4 GB.`);
      setTimeout(() => setVideoBgMsg(''), 4000);
      return;
    }
    try {
      const id = await addVideo({ blob: file, name: file.name, mime: file.type, source: 'file' });
      setActiveVideo(id);
      setVideoBgMsg(`Added "${file.name}" to library`);
      setTimeout(() => setVideoBgMsg(''), 2500);
    } catch (err) {
      setVideoBgMsg('Could not save video: ' + err.message);
    }
  }

  async function handleYoutubeDownload() {
    const url = ytVideoUrl.trim();
    const id = extractYouTubeId(url);
    if (!id) { setVideoBgMsg('Please paste a valid YouTube URL'); return; }
    if (!window.electronAPI?.ytdlp?.downloadVideo) {
      setVideoBgMsg('YouTube download only works in the desktop app.');
      return;
    }
    setYtDownloading(true);
    setYtProgress('Preparing...');
    const unsub = window.electronAPI.ytdlp.onProgress(msg => setYtProgress(msg));
    try {
      const result = await window.electronAPI.ytdlp.downloadVideo(url);
      const blob = new Blob([result.bytes], { type: result.mime || 'video/mp4' });
      const MAX = 4 * 1024 * 1024 * 1024;
      if (blob.size > MAX) {
        setVideoBgMsg(`Downloaded video too large (${formatBytes(blob.size)}). Max is 4 GB.`);
        setTimeout(() => setVideoBgMsg(''), 4000);
        return;
      }
      const newId = await addVideo({
        blob,
        name: result.title || 'YouTube video',
        mime: result.mime,
        source: 'youtube',
        ytUrl: url,
      });
      setActiveVideo(newId);
      setYtVideoUrl('');
      setVideoBgMsg(`Downloaded "${result.title}" (${formatBytes(blob.size)})`);
      setTimeout(() => setVideoBgMsg(''), 3000);
    } catch (err) {
      setVideoBgMsg('Download failed: ' + (err.message || err));
    } finally {
      setYtDownloading(false);
      setYtProgress('');
      try { unsub && unsub(); } catch {}
    }
  }

  async function handleSelectVideo(id) {
    setActiveVideo(id);
    updateVideoBg({ enabled: true, activeVideoId: id });
  }

  async function handleDeleteVideo(id, name) {
    if (!window.confirm(`Remove "${name}" from the video library?`)) return;
    await deleteVideo(id);
    setVideoBgMsg(`Removed "${name}"`);
    setTimeout(() => setVideoBgMsg(''), 2000);
  }

  function applyCustomCSS(css) {
    let el = document.getElementById('versefy-custom-css');
    if (!el) { el = document.createElement('style'); el.id = 'versefy-custom-css'; document.head.appendChild(el); }
    el.textContent = css;
  }

  function handleApplyCSS() {
    applyCustomCSS(customCSS);
    localStorage.setItem('versefy-custom-css', customCSS);
  }

  function handleResetCSS() {
    setCustomCSS('');
    applyCustomCSS('');
    localStorage.removeItem('versefy-custom-css');
  }

  async function handleRecord(action) {
    if (!window.electronAPI?.hotkeys) return;
    setRecording(action);
    const combo = await window.electronAPI.hotkeys.record();
    if (combo) {
      const updated = { ...hotkeys, [action]: combo };
      setHotkeys(updated);
      await window.electronAPI.hotkeys.set(updated);
    }
    setRecording(null);
  }

  async function handleReset() {
    if (!window.electronAPI?.hotkeys) return;
    setHotkeys({ ...defaults });
    await window.electronAPI.hotkeys.set({ ...defaults });
  }

  async function handleClear(action) {
    const updated = { ...hotkeys, [action]: '' };
    setHotkeys(updated);
    await window.electronAPI.hotkeys.set(updated);
  }

  function handleFontChange(font) {
    setCustomFont(font);
    localStorage.setItem('versefy-font', font);
    if (font) {
      // Load from Google Fonts
      let link = document.getElementById('versefy-google-font');
      if (!link) { link = document.createElement('link'); link.id = 'versefy-google-font'; link.rel = 'stylesheet'; document.head.appendChild(link); }
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700;800&display=swap`;
      document.documentElement.style.setProperty('font-family', `'${font}', Inter, system-ui, sans-serif`);
    } else {
      document.documentElement.style.removeProperty('font-family');
      const link = document.getElementById('versefy-google-font');
      if (link) link.remove();
    }
  }

  function handleToggleTheater() {
    const next = !theaterMode;
    setTheaterMode(next);
    document.body.classList.toggle('theater-mode', next);
  }

  async function handleAudioDevice(deviceId) {
    setSelectedDevice(deviceId);
    localStorage.setItem('versefy-audio-device', deviceId);
    try {
      const audio = audioRef?.current;
      if (audio && audio.setSinkId) {
        await audio.setSinkId(deviceId);
      }
    } catch (e) {
      console.warn('Could not set audio device:', e);
    }
  }

  async function toggleObs() {
    if (!window.electronAPI?.obs) return;
    if (obsRunning) {
      await window.electronAPI.obs.stop();
      setObsRunning(false); setObsUrl('');
    } else {
      const { url } = await window.electronAPI.obs.start();
      setObsRunning(true); setObsUrl(url);
    }
  }

  function formatAccelerator(acc) {
    if (!acc) return 'Not set';
    return acc.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ');
  }

  async function handleScanDuplicates() {
    setDupScanning(true);
    const dupes = await findDuplicates();
    setDuplicates(dupes);
    setDupScanning(false);
  }

  async function handleDeleteDuplicate(id) {
    await deleteCompletely(id);
    // Re-scan
    const dupes = await findDuplicates();
    setDuplicates(dupes);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportLibrary();
      const json = JSON.stringify(data);
      // Use JSZip-like approach: just compress as a blob
      const blob = new Blob([json], { type: 'application/json' });
      // Create zip using compression stream if available, otherwise plain JSON
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `versefy-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
    setExporting(false);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);
      setImportMsg('');
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.songs || !data.exportedAt) throw new Error('Invalid backup file');
        const merge = confirm('Merge with existing library?\n\nOK = Merge (keep existing + add new)\nCancel = Replace (wipe and restore)');
        await importLibrary(data, { merge });
        setImportMsg(`Imported ${data.songs.length} songs, ${(data.playlists || []).length} playlists successfully!`);
      } catch (e) {
        setImportMsg('Import failed: ' + e.message);
      }
      setImporting(false);
    };
    input.click();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Personalize your experience</p>
      </div>

      {/* Display Name */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoPerson className="settings-icon" />
          <div>
            <h2>Profile</h2>
            <p>Set your display name for greetings</p>
          </div>
        </div>
        <div className="settings-actions-row">
          <input
            type="text"
            className="welcome-input-settings"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setNameSaved(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                localStorage.setItem('versefy-username', displayName.trim() || 'User');
                setNameSaved(true);
              }
            }}
            placeholder="Your name..."
            maxLength={30}
          />
          <button className="keybind-btn" onClick={() => {
            localStorage.setItem('versefy-username', displayName.trim() || 'User');
            setNameSaved(true);
          }}>
            {nameSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </section>

      {/* Theme Picker */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoColorPalette className="settings-icon" />
          <div>
            <h2>Theme</h2>
            <p>Choose a color scheme for the app</p>
          </div>
        </div>

        <div className="theme-grid">
          {Object.entries(themes).map(([key, t]) => (
            <button
              key={key}
              className={`theme-card ${theme === key ? 'active' : ''}`}
              onClick={() => setTheme(key)}
              style={{ '--tc-accent': t.accent, '--tc-secondary': t.secondary, '--tc-bg': t.bgPrimary }}
            >
              <div className="theme-preview">
                <div className="theme-dot" style={{ background: t.accent }} />
                <div className="theme-dot" style={{ background: t.secondary }} />
              </div>
              <span className="theme-name">{t.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* DJ Mode */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoMusicalNotes className="settings-icon" />
          <div>
            <h2>DJ Mode</h2>
            <p>Unlock a 2-deck mixer with a crossfader — blend into your next track while the current one plays.</p>
          </div>
        </div>
        <label className="videobg-enable">
          <input
            type="checkbox"
            checked={djModeEnabled}
            onChange={e => {
              const on = e.target.checked;
              setDjModeEnabled(on);
              localStorage.setItem('versefy-dj-mode', on ? '1' : '0');
              window.dispatchEvent(new CustomEvent('versefy-dj-mode-changed'));
            }}
          />
          <span>Enable DJ Mode (adds a DJ button to the player)</span>
        </label>
      </section>

      {/* Video Background */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoVideocam className="settings-icon" />
          <div>
            <h2>Video Background</h2>
            <p>Download a YouTube video or upload your own to play behind the app. Max 4 GB.</p>
          </div>
        </div>

        <div className="videobg-row">
          <label className="videobg-enable">
            <input
              type="checkbox"
              checked={videoBg.enabled}
              onChange={e => updateVideoBg({ enabled: e.target.checked })}
            />
            <span>Enable video background</span>
          </label>
        </div>

        {/* YouTube downloader */}
        <div className="videobg-yt-row">
          <div className="videobg-yt-input-wrap">
            <IoLogoYoutube style={{ color: '#ff0033', fontSize: 18, flexShrink: 0 }} />
            <input
              type="text"
              className="videobg-input"
              placeholder="Paste a YouTube URL to download..."
              value={ytVideoUrl}
              onChange={e => setYtVideoUrl(e.target.value)}
              disabled={ytDownloading}
            />
          </div>
          <button
            className="videobg-download-btn"
            onClick={handleYoutubeDownload}
            disabled={ytDownloading || !extractYouTubeId(ytVideoUrl)}
          >
            <IoCloudDownload /> {ytDownloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
        {ytProgress && <div className="videobg-progress">{ytProgress}</div>}

        {/* File upload */}
        <div className="videobg-upload-row">
          <input
            type="file"
            accept="video/*"
            id="videobg-file"
            className="videobg-file-input"
            onChange={handleVideoBgFileUpload}
          />
          <label htmlFor="videobg-file" className="videobg-upload">
            <IoCloudUpload /> Or upload your own video
          </label>
        </div>

        {/* Library */}
        {videoLibrary.length > 0 && (
          <div className="videobg-library">
            <div className="videobg-library-label">Your videos ({videoLibrary.length})</div>
            <div className="videobg-library-grid">
              {videoLibrary.map(v => (
                <div
                  key={v.id}
                  className={`videobg-card ${videoBg.activeVideoId === v.id ? 'active' : ''}`}
                  onClick={() => handleSelectVideo(v.id)}
                  title={v.name}
                >
                  <div className="videobg-card-icon">
                    {v.source === 'youtube' ? <IoLogoYoutube /> : <IoVideocam />}
                  </div>
                  <div className="videobg-card-info">
                    <div className="videobg-card-name">{v.name}</div>
                    <div className="videobg-card-meta">
                      {v.source === 'youtube' ? 'YouTube' : 'Uploaded'} · {formatBytes(v.size)}
                    </div>
                  </div>
                  <button
                    className="videobg-card-delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteVideo(v.id, v.name); }}
                    title="Remove"
                  >
                    <IoTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="videobg-opacity">
          <label>Video opacity</label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={videoBg.opacity}
            onChange={e => updateVideoBg({ opacity: parseFloat(e.target.value) })}
          />
          <span>{Math.round(videoBg.opacity * 100)}%</span>
        </div>

        {videoBgMsg && <div className="settings-notice">{videoBgMsg}</div>}
      </section>

      {/* Keybinds */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoKeypad className="settings-icon" />
          <div>
            <h2>Global Keybinds</h2>
            <p>These work even when Versefy is in the background or minimized</p>
          </div>
        </div>

        {!available && (
          <div className="settings-notice">
            Global keybinds only work in the desktop app (Electron).
          </div>
        )}

        <div className="keybind-list">
          {Object.entries(ACTION_LABELS).map(([action, label]) => (
            <div key={action} className={`keybind-row ${recording === action ? 'recording' : ''}`}>
              <span className="keybind-label">{label}</span>
              <div className="keybind-value">
                {recording === action ? (
                  <span className="keybind-recording">
                    <IoRadioButtonOn className="recording-dot" />
                    Press any key combo...
                  </span>
                ) : (
                  <span className={`keybind-combo ${!hotkeys[action] ? 'empty' : ''}`}>
                    {formatAccelerator(hotkeys[action])}
                  </span>
                )}
              </div>
              <div className="keybind-actions">
                <button className="keybind-btn" onClick={() => handleRecord(action)} disabled={recording !== null}>
                  {recording === action ? 'Listening...' : 'Rebind'}
                </button>
                <button className="keybind-btn secondary" onClick={() => handleClear(action)} disabled={recording !== null}>
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="settings-reset-btn" onClick={handleReset}>
          <IoRefresh /> Reset all to defaults
        </button>
      </section>

      {/* Custom CSS */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoCode className="settings-icon" />
          <div>
            <h2>Custom CSS</h2>
            <p>Inject your own styles to customize the app appearance</p>
          </div>
        </div>

        <textarea
          className="custom-css-area"
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          placeholder="/* Enter your custom CSS here */&#10;.page { background: #111; }"
          spellCheck={false}
        />

        <div className="custom-css-actions">
          <button className="keybind-btn" onClick={handleApplyCSS}>Apply</button>
          <button className="keybind-btn secondary" onClick={handleResetCSS}>Reset</button>
        </div>
      </section>

      {/* Visualizer Wallpaper */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoEye className="settings-icon" />
          <div>
            <h2>Visualizer Wallpaper</h2>
            <p>Render the visualizer behind the entire app as a live background</p>
          </div>
        </div>
        <button className={`keybind-btn ${showWallpaperViz ? 'active' : ''}`} onClick={toggleWallpaperViz}>
          {showWallpaperViz ? 'Disable Wallpaper Visualizer' : 'Enable Wallpaper Visualizer'}
        </button>
      </section>

      {/* Export / Import Library */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoCloudDownload className="settings-icon" />
          <div>
            <h2>Backup &amp; Restore</h2>
            <p>Export your entire library (songs, playlists, folders) or restore from a backup</p>
          </div>
        </div>
        <div className="settings-actions-row">
          <button className="keybind-btn" onClick={handleExport} disabled={exporting}>
            <IoCloudDownload /> {exporting ? 'Exporting...' : 'Export Library'}
          </button>
          <button className="keybind-btn secondary" onClick={handleImport} disabled={importing}>
            <IoCloudUpload /> {importing ? 'Importing...' : 'Import Library'}
          </button>
        </div>
        {importMsg && <p className="settings-msg">{importMsg}</p>}
      </section>

      {/* Custom Font */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoText className="settings-icon" />
          <div>
            <h2>Custom Font</h2>
            <p>Load any Google Font to change the app's typeface</p>
          </div>
        </div>
        <div className="settings-actions-row">
          <input
            type="text"
            className="welcome-input-settings"
            value={customFont}
            onChange={e => setCustomFont(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFontChange(customFont)}
            placeholder="e.g. Poppins, Outfit, Space Grotesk..."
          />
          <button className="keybind-btn" onClick={() => handleFontChange(customFont)}>Apply</button>
          <button className="keybind-btn secondary" onClick={() => handleFontChange('')}>Reset</button>
        </div>
        <div className="font-presets">
          {['Inter', 'Poppins', 'Outfit', 'Space Grotesk', 'JetBrains Mono', 'Nunito', 'Lexend'].map(f => (
            <button key={f} className={`eq-speed-btn ${customFont === f ? 'active' : ''}`}
              onClick={() => handleFontChange(f)}>{f}</button>
          ))}
        </div>
      </section>

      {/* Song Change Notification */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoEye className="settings-icon" />
          <div>
            <h2>Song Notification</h2>
            <p>Show a toast when the song changes</p>
          </div>
        </div>
        <button className={`keybind-btn ${localStorage.getItem('versefy-song-toast') !== 'false' ? 'active' : ''}`}
          onClick={() => {
            const cur = localStorage.getItem('versefy-song-toast') !== 'false';
            localStorage.setItem('versefy-song-toast', cur ? 'false' : 'true');
            window.location.reload();
          }}>
          {localStorage.getItem('versefy-song-toast') !== 'false' ? 'Enabled' : 'Disabled'}
        </button>
      </section>

      {/* Theater Mode */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoContrast className="settings-icon" />
          <div>
            <h2>Theater Mode</h2>
            <p>Dims everything except the player for a focused listening experience</p>
          </div>
        </div>
        <button className={`keybind-btn ${theaterMode ? 'active' : ''}`} onClick={handleToggleTheater}>
          {theaterMode ? 'Exit Theater Mode' : 'Enter Theater Mode'}
        </button>
      </section>

      {/* Audio Output Device */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoHardwareChip className="settings-icon" />
          <div>
            <h2>Audio Output</h2>
            <p>Choose which audio device to play through</p>
          </div>
        </div>
        {audioDevices.length > 0 ? (
          <div className="device-list">
            {audioDevices.map(d => (
              <button key={d.deviceId} className={`keybind-btn ${selectedDevice === d.deviceId ? 'active' : ''}`}
                onClick={() => handleAudioDevice(d.deviceId)}
                style={{ marginBottom: 4, display: 'block', width: '100%', textAlign: 'left' }}>
                {d.label || `Device ${d.deviceId.slice(0, 8)}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="settings-msg">No audio devices found or permission denied.</p>
        )}
      </section>

      {/* OBS Overlay */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoTv className="settings-icon" />
          <div>
            <h2>OBS Overlay</h2>
            <p>Show "Now Playing" as a browser source in OBS or any streaming software</p>
          </div>
        </div>
        <div className="settings-actions-row">
          <button className={`keybind-btn ${obsRunning ? 'active' : ''}`} onClick={toggleObs}>
            {obsRunning ? 'Stop Overlay' : 'Start Overlay'}
          </button>
          {obsRunning && obsUrl && (
            <button className="keybind-btn" onClick={() => { navigator.clipboard.writeText(obsUrl); }}>
              Copy URL
            </button>
          )}
        </div>
        {obsRunning && obsUrl && (
          <p className="settings-msg success">
            Overlay running at: <strong>{obsUrl}</strong><br />
            Add this as a Browser Source in OBS (width: 420, height: 80, transparent background)
          </p>
        )}
      </section>

      {/* Duplicate Detector */}
      <section className="settings-section">
        <div className="settings-section-header">
          <IoCopy className="settings-icon" />
          <div>
            <h2>Duplicate Detector</h2>
            <p>Scan your library for songs with the same title and artist</p>
          </div>
        </div>
        <button className="keybind-btn" onClick={handleScanDuplicates} disabled={dupScanning}>
          {dupScanning ? 'Scanning...' : 'Scan for Duplicates'}
        </button>
        {duplicates !== null && (
          <div className="dup-results">
            {duplicates.length === 0 ? (
              <p className="settings-msg success">No duplicates found!</p>
            ) : (
              <>
                <p className="settings-msg warn">Found {duplicates.length} duplicate group{duplicates.length !== 1 ? 's' : ''}</p>
                {duplicates.map((group, gi) => (
                  <div key={gi} className="dup-group">
                    <div className="dup-group-title">{group[0].title} — {group[0].artist || 'Unknown'}</div>
                    {group.map((song, si) => (
                      <div key={song.id} className="dup-row">
                        <span className="dup-song-info">
                          <span className="dup-badge">{si === 0 ? 'Original' : `Copy ${si}`}</span>
                          {song.title}
                        </span>
                        {si > 0 && (
                          <button className="keybind-btn danger-sm" onClick={() => handleDeleteDuplicate(song.id)}>
                            <IoTrash /> Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
