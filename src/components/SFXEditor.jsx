import { useState, useRef, useEffect, useCallback } from 'react';
import { updateSong } from '../utils/db';
import { IoClose, IoSave, IoPlay, IoPause, IoDownload, IoCut, IoRefresh } from 'react-icons/io5';
import './SFXEditor.css';

const EQ_PRESETS = {
  flat: { name: 'Flat', bass: 0, mid: 0, treble: 0 },
  boostBass: { name: 'Bass Boost', bass: 12, mid: 0, treble: 0 },
  boostTreble: { name: 'Treble Boost', bass: 0, mid: 0, treble: 10 },
  telephone: { name: 'Telephone', bass: -10, mid: 8, treble: -8 },
  megaphone: { name: 'Megaphone', bass: -6, mid: 10, treble: 4 },
  muffled: { name: 'Muffled', bass: 4, mid: -4, treble: -12 },
  crisp: { name: 'Crisp', bass: -2, mid: 2, treble: 8 },
};

export default function SFXEditor({ song, onClose, onSaved }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const bufferRef = useRef(null);
  const bassNodeRef = useRef(null);
  const midNodeRef = useRef(null);
  const trebleNodeRef = useRef(null);
  const gainNodeRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1); // 0-1 fraction
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [volume, setVolume] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | null
  const timeUpdateRef = useRef(null);

  // Decode audio on mount
  useEffect(() => {
    if (!song?.audioUrl) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    fetch(song.audioUrl)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        bufferRef.current = decoded;
        setDuration(decoded.duration);
        drawWaveform(decoded);
      })
      .catch(() => {});

    const audio = new Audio(song.audioUrl);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    audio.addEventListener('ended', () => setPlaying(false));

    // Route audio element through EQ filters for live preview
    const source = ctx.createMediaElementSource(audio);
    const bassNode = ctx.createBiquadFilter();
    bassNode.type = 'lowshelf'; bassNode.frequency.value = 200; bassNode.gain.value = 0;
    const midNode = ctx.createBiquadFilter();
    midNode.type = 'peaking'; midNode.frequency.value = 1000; midNode.Q.value = 1; midNode.gain.value = 0;
    const trebleNode = ctx.createBiquadFilter();
    trebleNode.type = 'highshelf'; trebleNode.frequency.value = 4000; trebleNode.gain.value = 0;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;
    source.connect(bassNode);
    bassNode.connect(midNode);
    midNode.connect(trebleNode);
    trebleNode.connect(gainNode);
    gainNode.connect(ctx.destination);
    bassNodeRef.current = bassNode;
    midNodeRef.current = midNode;
    trebleNodeRef.current = trebleNode;
    gainNodeRef.current = gainNode;

    return () => {
      audio.pause();
      ctx.close();
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current);
    };
  }, [song]);

  // Draw waveform
  const drawWaveform = useCallback((buffer) => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(1, 1);

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / (W / 2));

    ctx.clearRect(0, 0, W, H);

    // Trim regions (dimmed)
    const tsX = trimStart * W;
    const teX = trimEnd * W;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, 0, tsX, H);
    ctx.fillRect(teX, 0, W - teX, H);

    // Active region bg
    ctx.fillStyle = 'rgba(139, 92, 246, 0.03)';
    ctx.fillRect(tsX, 0, teX - tsX, H);

    // Waveform
    const mid = H / 2;
    for (let i = 0; i < W / 2; i++) {
      let min = 1, max = -1;
      const start = i * step;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const val = data[start + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      const x = i * 2;
      const frac = x / W;
      const inTrim = frac >= trimStart && frac <= trimEnd;

      const alpha = inTrim ? 0.8 : 0.15;
      const hue = inTrim ? 270 : 0;
      const sat = inTrim ? 80 : 0;
      const light = inTrim ? 65 : 50;

      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
      const top = mid + min * mid * 0.9;
      const bottom = mid + max * mid * 0.9;
      ctx.fillRect(x, top, 2, bottom - top || 1);
    }

    // Trim handles
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(tsX - 1, 0, 3, H);
    ctx.fillRect(teX - 1, 0, 3, H);

    // Handle grips
    [tsX, teX].forEach(x => {
      ctx.fillStyle = '#c4b5fd';
      ctx.beginPath();
      ctx.roundRect(x - 6, H / 2 - 16, 12, 32, 4);
      ctx.fill();
      // Grip lines
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 3, H / 2 + i * 4);
        ctx.lineTo(x + 3, H / 2 + i * 4);
        ctx.stroke();
      }
    });

    // Playhead
    if (duration > 0) {
      const px = (currentTime / duration) * W;
      ctx.fillStyle = '#fff';
      ctx.fillRect(px - 0.5, 0, 1, H);
    }
  }, [trimStart, trimEnd, currentTime, duration]);

  // Redraw on trim/time changes
  useEffect(() => {
    if (bufferRef.current) drawWaveform(bufferRef.current);
  }, [trimStart, trimEnd, currentTime, drawWaveform]);

  // Live EQ + volume updates
  useEffect(() => {
    if (bassNodeRef.current) bassNodeRef.current.gain.value = bass;
    if (midNodeRef.current) midNodeRef.current.gain.value = mid;
    if (trebleNodeRef.current) trebleNodeRef.current.gain.value = treble;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
  }, [bass, mid, treble, volume]);

  // Play/pause
  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current);
      setPlaying(false);
    } else {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      audio.currentTime = trimStart * duration;
      audio.play();
      setPlaying(true);
      timeUpdateRef.current = setInterval(() => {
        setCurrentTime(audio.currentTime);
        if (audio.currentTime >= trimEnd * duration) {
          audio.pause();
          setPlaying(false);
          clearInterval(timeUpdateRef.current);
        }
      }, 50);
    }
  }

  // Handle waveform click/drag for trim handles
  function handleCanvasMouseDown(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const distStart = Math.abs(frac - trimStart);
    const distEnd = Math.abs(frac - trimEnd);
    if (distStart < 0.02) setDragging('start');
    else if (distEnd < 0.02) setDragging('end');
    else {
      // Click to set playhead
      if (audioRef.current) {
        audioRef.current.currentTime = frac * duration;
        setCurrentTime(frac * duration);
      }
    }
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e) {
      const rect = canvasRef.current.getBoundingClientRect();
      let frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (dragging === 'start') setTrimStart(Math.min(frac, trimEnd - 0.01));
      else setTrimEnd(Math.max(frac, trimStart + 0.01));
    }
    function onUp() { setDragging(null); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, trimStart, trimEnd]);

  function applyPreset(preset) {
    setBass(preset.bass);
    setMid(preset.mid);
    setTreble(preset.treble);
  }

  function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  }

  // Render the trimmed + EQ'd audio
  async function renderAudio() {
    const buffer = bufferRef.current;
    if (!buffer) return null;

    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(trimStart * buffer.length);
    const endSample = Math.floor(trimEnd * buffer.length);
    const length = endSample - startSample;
    if (length <= 0) return null;

    const offline = new OfflineAudioContext(buffer.numberOfChannels, length, sampleRate);
    const source = offline.createBufferSource();

    // Copy trimmed portion
    const trimmedBuf = offline.createBuffer(buffer.numberOfChannels, length, sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = trimmedBuf.getChannelData(ch);
      for (let i = 0; i < length; i++) dst[i] = src[startSample + i];
    }
    source.buffer = trimmedBuf;

    // EQ chain
    const bassFilter = offline.createBiquadFilter();
    bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 200; bassFilter.gain.value = bass;

    const midFilter = offline.createBiquadFilter();
    midFilter.type = 'peaking'; midFilter.frequency.value = 1000; midFilter.Q.value = 1; midFilter.gain.value = mid;

    const trebleFilter = offline.createBiquadFilter();
    trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = treble;

    const gain = offline.createGain();
    gain.gain.value = volume;

    source.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(gain);
    gain.connect(offline.destination);
    source.start();

    return offline.startRendering();
  }

  function audioBufferToWav(buf) {
    const numCh = buf.numberOfChannels;
    const sr = buf.sampleRate;
    const length = buf.length;
    const dataSize = length * numCh * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    function w(off, str) { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
    w(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); w(8, 'WAVE'); w(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * numCh * 2, true);
    view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true); w(36, 'data');
    view.setUint32(40, dataSize, true);
    let off = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const s = Math.max(-1, Math.min(1, buf.getChannelData(ch)[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rendered = await renderAudio();
      if (!rendered) return;
      const blob = audioBufferToWav(rendered);
      const reader = new FileReader();
      reader.onload = async () => {
        const updated = { ...song, audioUrl: reader.result, duration: rendered.duration };
        await updateSong(updated);
        onSaved?.(updated);
        onClose();
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  async function handleExport() {
    const rendered = await renderAudio();
    if (!rendered) return;
    const blob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song.title || 'sfx'}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="sfx-editor-overlay">
      <div className="sfx-editor">
        {/* Header */}
        <div className="sfx-editor-header">
          <h2>Edit SFX: {song.title}</h2>
          <button className="sfx-editor-close" onClick={onClose}><IoClose /></button>
        </div>

        {/* Waveform */}
        <div className="sfx-waveform-wrap">
          <canvas
            ref={canvasRef}
            className="sfx-waveform-canvas"
            onMouseDown={handleCanvasMouseDown}
          />
          <div className="sfx-waveform-times">
            <span>{formatTime(trimStart * duration)}</span>
            <span className="sfx-waveform-current">{formatTime(currentTime)}</span>
            <span>{formatTime(trimEnd * duration)}</span>
          </div>
        </div>

        {/* Trim info */}
        <div className="sfx-trim-info">
          <IoCut /> Drag the purple handles to trim &middot; Selection: {formatTime((trimEnd - trimStart) * duration)}
        </div>

        {/* Transport */}
        <div className="sfx-transport">
          <button className="sfx-transport-btn" onClick={togglePlay}>
            {playing ? <IoPause /> : <IoPlay />}
          </button>
          <div className="sfx-volume-ctrl">
            <span>Vol</span>
            <input type="range" min="0" max="1.5" step="0.01" value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="sfx-slider" />
            <span className="sfx-slider-val">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* EQ */}
        <div className="sfx-eq-section">
          <h3>Equalizer</h3>
          <div className="sfx-eq-presets">
            {Object.entries(EQ_PRESETS).map(([key, p]) => (
              <button key={key} className={`sfx-eq-preset ${bass === p.bass && mid === p.mid && treble === p.treble ? 'active' : ''}`}
                onClick={() => applyPreset(p)}>{p.name}</button>
            ))}
          </div>
          <div className="sfx-eq-sliders">
            <div className="sfx-eq-band">
              <label>Bass</label>
              <input type="range" min="-12" max="12" step="1" value={bass}
                onChange={e => setBass(parseInt(e.target.value))} className="sfx-slider" />
              <span className="sfx-slider-val">{bass > 0 ? '+' : ''}{bass}dB</span>
            </div>
            <div className="sfx-eq-band">
              <label>Mid</label>
              <input type="range" min="-12" max="12" step="1" value={mid}
                onChange={e => setMid(parseInt(e.target.value))} className="sfx-slider" />
              <span className="sfx-slider-val">{mid > 0 ? '+' : ''}{mid}dB</span>
            </div>
            <div className="sfx-eq-band">
              <label>Treble</label>
              <input type="range" min="-12" max="12" step="1" value={treble}
                onChange={e => setTreble(parseInt(e.target.value))} className="sfx-slider" />
              <span className="sfx-slider-val">{treble > 0 ? '+' : ''}{treble}dB</span>
            </div>
          </div>
          <button className="sfx-eq-reset" onClick={() => { setBass(0); setMid(0); setTreble(0); }}>
            <IoRefresh /> Reset EQ
          </button>
        </div>

        {/* Actions */}
        <div className="sfx-editor-actions">
          <button className="sfx-action-btn save" onClick={handleSave} disabled={saving}>
            <IoSave /> {saving ? 'Saving...' : 'Save to Library'}
          </button>
          <button className="sfx-action-btn export" onClick={handleExport}>
            <IoDownload /> Export WAV
          </button>
          <button className="sfx-action-btn cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
