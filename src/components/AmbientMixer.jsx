import { useState, useRef, useEffect, useCallback } from 'react';
import { IoClose, IoRainy, IoLeaf, IoFlame, IoWater, IoCafe, IoThunderstorm } from 'react-icons/io5';
import './AmbientMixer.css';

// Generate ambient noise using Web Audio API oscillators + noise
function createNoise(ctx, type = 'white') {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + (0.02 * w)) / 1.02;
      last = data[i]; data[i] *= 3.5;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

const SOUNDS = [
  { id: 'rain', name: 'Rain', icon: IoRainy, noise: 'pink', filterFreq: 800, color: '#3b82f6' },
  { id: 'thunder', name: 'Storm', icon: IoThunderstorm, noise: 'brown', filterFreq: 200, color: '#6366f1' },
  { id: 'wind', name: 'Wind', icon: IoLeaf, noise: 'white', filterFreq: 600, color: '#22c55e' },
  { id: 'fire', name: 'Fire', icon: IoFlame, noise: 'brown', filterFreq: 400, color: '#f97316' },
  { id: 'water', name: 'Stream', icon: IoWater, noise: 'pink', filterFreq: 1200, color: '#06b6d4' },
  { id: 'lofi', name: 'Lo-fi', icon: IoCafe, noise: 'brown', filterFreq: 300, color: '#ec4899' },
];

export default function AmbientMixer({ onClose }) {
  const [volumes, setVolumes] = useState(() => {
    const saved = localStorage.getItem('versefy-ambient');
    return saved ? JSON.parse(saved) : {};
  });
  const ctxRef = useRef(null);
  const nodesRef = useRef({});

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  function ensureNode(sound) {
    if (nodesRef.current[sound.id]) return nodesRef.current[sound.id];
    const ctx = getCtx();
    const source = createNoise(ctx, sound.noise);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sound.filterFreq;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    nodesRef.current[sound.id] = { source, filter, gain };
    return nodesRef.current[sound.id];
  }

  function setVol(id, val) {
    const sound = SOUNDS.find(s => s.id === id);
    if (!sound) return;
    const node = ensureNode(sound);
    node.gain.gain.setTargetAtTime(val, getCtx().currentTime, 0.1);
    const next = { ...volumes, [id]: val };
    if (val === 0) delete next[id];
    setVolumes(next);
    localStorage.setItem('versefy-ambient', JSON.stringify(next));
  }

  // Restore volumes on mount
  useEffect(() => {
    for (const [id, vol] of Object.entries(volumes)) {
      if (vol > 0) {
        const sound = SOUNDS.find(s => s.id === id);
        if (sound) {
          const node = ensureNode(sound);
          node.gain.gain.value = vol;
        }
      }
    }
    return () => {
      // Don't stop on unmount - keep playing
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = Object.values(volumes).filter(v => v > 0).length;

  return (
    <div className="ambient-panel">
      <div className="ambient-header">
        <h3>Ambient Mixer</h3>
        {activeCount > 0 && <span className="ambient-badge">{activeCount} active</span>}
        <button className="ambient-close" onClick={onClose}><IoClose /></button>
      </div>
      <p className="ambient-desc">Layer ambient sounds over your music</p>

      <div className="ambient-grid">
        {SOUNDS.map(s => {
          const vol = volumes[s.id] || 0;
          const Icon = s.icon;
          return (
            <div key={s.id} className={`ambient-card ${vol > 0 ? 'active' : ''}`}>
              <button
                className="ambient-toggle"
                style={{ '--amb-color': s.color }}
                onClick={() => setVol(s.id, vol > 0 ? 0 : 0.3)}
              >
                <Icon />
              </button>
              <span className="ambient-name">{s.name}</span>
              <input
                type="range" min="0" max="1" step="0.02"
                value={vol}
                onChange={e => setVol(s.id, parseFloat(e.target.value))}
                className="ambient-slider"
                style={{ '--amb-color': s.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
