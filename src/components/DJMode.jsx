import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IoClose, IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp, IoMusicalNotes, IoSwapHorizontal, IoSearch
} from 'react-icons/io5';
import { usePlayer } from '../context/PlayerContext';
import { getAllSongs, getSong } from '../utils/db';
import './DJMode.css';

const DJ_EQ_BANDS = [80, 1000, 8000]; // 3-band DJ EQ: low / mid / high
const DJ_EQ_LABELS = ['LOW', 'MID', 'HIGH'];

function fmt(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Equal-power crossfade: constant perceived loudness across positions.
// x in 0..1 (0 = all A, 1 = all B)
function equalPowerGains(x) {
  const theta = x * Math.PI / 2;
  return { a: Math.cos(theta), b: Math.sin(theta) };
}

export default function DJMode({ onClose }) {
  const {
    currentSong, isPlaying, duration, currentTime, volume,
    togglePlay, seek, playbackSpeed, setSpeed, setVolume, audioRef,
    eqValues, setEQ, EQ_BANDS, playSong,
  } = usePlayer();

  const [library, setLibrary] = useState([]);
  const [deckBSong, setDeckBSong] = useState(null);
  const [deckBPlaying, setDeckBPlaying] = useState(false);
  const [deckBTime, setDeckBTime] = useState(0);
  const [deckBDuration, setDeckBDuration] = useState(0);
  const [deckBSpeed, setDeckBSpeed] = useState(1.0);
  const [deckBVol, setDeckBVol] = useState(0.9);
  const [deckAVol, setDeckAVol] = useState(0.9);
  const [crossfader, setCrossfader] = useState(0); // 0 = A, 1 = B
  const [pickerSide, setPickerSide] = useState(null); // null | 'a' | 'b'
  const [pickerSearch, setPickerSearch] = useState('');

  // 3-band DJ EQ values per deck [low, mid, high] in dB (-12..+12)
  const [deckAEq, setDeckAEq] = useState([0, 0, 0]);
  const [deckBEq, setDeckBEq] = useState([0, 0, 0]);

  const deckBAudioRef = useRef(null);
  const deckBCtxRef = useRef(null);
  const deckBSourceRef = useRef(null);
  const deckBGainRef = useRef(null);
  const deckBEqFiltersRef = useRef([]);
  const savedMasterRef = useRef(null);
  const savedEqRef = useRef(null);

  // Load library once
  useEffect(() => { getAllSongs().then(setLibrary); }, []);

  // Save the user's current master volume + EQ on open, restore on close
  useEffect(() => {
    savedMasterRef.current = volume;
    savedEqRef.current = [...eqValues];
    return () => {
      try { setVolume(savedMasterRef.current ?? 0.8); } catch {}
      try { if (savedEqRef.current) setEQ(savedEqRef.current); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create Deck B audio element + its own Web Audio graph with 3-band EQ
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    deckBAudioRef.current = a;

    // Independent AudioContext for Deck B (can't share the MediaElementSource
    // from PlayerContext — each element gets exactly one source node).
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try {
        const ctx = new Ctx();
        deckBCtxRef.current = ctx;
        const src = ctx.createMediaElementSource(a);
        deckBSourceRef.current = src;
        const filters = DJ_EQ_BANDS.map((freq, i) => {
          const f = ctx.createBiquadFilter();
          f.type = i === 0 ? 'lowshelf' : i === DJ_EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
          f.frequency.value = freq;
          f.gain.value = 0;
          f.Q.value = 1.0;
          return f;
        });
        deckBEqFiltersRef.current = filters;
        const g = ctx.createGain();
        g.gain.value = 1;
        deckBGainRef.current = g;
        // Chain: src → f0 → f1 → f2 → gain → destination
        let last = src;
        for (const f of filters) { last.connect(f); last = f; }
        last.connect(g);
        g.connect(ctx.destination);
      } catch {}
    }

    const onTime = () => setDeckBTime(a.currentTime || 0);
    const onDur = () => setDeckBDuration(a.duration || 0);
    const onEnd = () => setDeckBPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('ended', onEnd);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('ended', onEnd);
      a.src = '';
      try { deckBCtxRef.current?.close(); } catch {}
    };
  }, []);

  // Apply Deck A EQ to the main player's EQ filters (6 bands).
  // We map the 3-band [low/mid/high] onto the 6-band system:
  //   low  → bands 0, 1 (60, 170 Hz)
  //   mid  → bands 2, 3 (350, 1000 Hz)
  //   high → bands 4, 5 (3500, 10000 Hz)
  useEffect(() => {
    const [low, mid, high] = deckAEq;
    setEQ([low, low, mid, mid, high, high]);
  }, [deckAEq, setEQ]);

  // Apply Deck B EQ to its own filter chain
  useEffect(() => {
    const fs = deckBEqFiltersRef.current;
    if (!fs || !fs.length) return;
    deckBEq.forEach((v, i) => { if (fs[i]) fs[i].gain.value = v; });
  }, [deckBEq]);

  // Apply crossfader + per-deck volumes every time they change
  useEffect(() => {
    const { a: gA, b: gB } = equalPowerGains(crossfader);
    // Deck A — route via player's volume. Multiply deck volume × crossfade gain.
    try { setVolume(Math.max(0, Math.min(1, deckAVol * gA))); } catch {}
    // Deck B — direct
    if (deckBAudioRef.current) {
      deckBAudioRef.current.volume = Math.max(0, Math.min(1, deckBVol * gB));
    }
  }, [crossfader, deckAVol, deckBVol, setVolume]);

  // Apply Deck B speed
  useEffect(() => {
    if (deckBAudioRef.current) {
      deckBAudioRef.current.playbackRate = deckBSpeed;
      deckBAudioRef.current.preservesPitch = Math.abs(deckBSpeed - 1) < 0.02;
    }
  }, [deckBSpeed]);

  // Load a song onto Deck B. List songs from getAllSongs() don't carry audioUrl
  // to save memory — fetch the full record here.
  async function loadDeckB(song) {
    if (!song || !deckBAudioRef.current) return;
    const full = song.audioUrl ? song : await getSong(song.id);
    if (!full?.audioUrl) return;
    setDeckBSong(full);
    const a = deckBAudioRef.current;
    a.pause();
    setDeckBPlaying(false);
    a.src = full.audioUrl;
    a.playbackRate = deckBSpeed;
    a.volume = deckBVol * equalPowerGains(crossfader).b;
    a.load();
    setPickerSide(null);
    setPickerSearch('');
  }

  // Load a song onto Deck A = route through the main player so the existing
  // audio chain (EQ, effects, session persistence, etc.) keeps working.
  function loadDeckA(song) {
    if (!song) return;
    playSong([song], 0);
    setPickerSide(null);
    setPickerSearch('');
  }

  function handlePick(song) {
    if (pickerSide === 'a') loadDeckA(song);
    else if (pickerSide === 'b') loadDeckB(song);
  }

  function toggleDeckB() {
    const a = deckBAudioRef.current;
    if (!a || !deckBSong) return;
    // Deck B's AudioContext starts suspended in Chromium until user gesture
    if (deckBCtxRef.current?.state === 'suspended') {
      deckBCtxRef.current.resume().catch(() => {});
    }
    if (a.paused) {
      a.play().catch(() => {});
      setDeckBPlaying(true);
    } else {
      a.pause();
      setDeckBPlaying(false);
    }
  }

  function seekB(pct) {
    const a = deckBAudioRef.current;
    if (!a || !deckBDuration) return;
    a.currentTime = pct * deckBDuration;
  }

  // Quick actions
  function autoFadeToB(durationSec = 6) {
    const steps = 60;
    const interval = (durationSec * 1000) / steps;
    const a = deckBAudioRef.current;
    if (a && deckBSong && a.paused) {
      a.play().catch(() => {});
      setDeckBPlaying(true);
    }
    let i = 0;
    const start = crossfader;
    const timer = setInterval(() => {
      i++;
      const x = start + ((1 - start) * i) / steps;
      setCrossfader(Math.min(1, x));
      if (i >= steps) clearInterval(timer);
    }, interval);
  }

  function swapDecks() {
    setCrossfader(c => (c > 0.5 ? 0 : 1));
  }

  // Deck A seek handler
  const seekA = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * (duration || 0));
  };

  const deckBSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekB(pct);
  };

  const filteredLibrary = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const base = library.filter(s => s.type !== 'sfx');
    if (!q) return base.slice(0, 200);
    return base.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [library, pickerSearch]);

  const deckASpinStyle = {
    '--spin-state': isPlaying ? 'running' : 'paused',
    '--spin-duration': `${8 / Math.max(0.1, playbackSpeed)}s`,
    '--platter-art': currentSong?.artwork ? `url(${currentSong.artwork})` : undefined,
  };

  const deckBSpinStyle = {
    '--spin-state': deckBPlaying ? 'running' : 'paused',
    '--spin-duration': `${8 / Math.max(0.1, deckBSpeed)}s`,
    '--platter-art': deckBSong?.artwork ? `url(${deckBSong.artwork})` : undefined,
  };

  return createPortal(
    <div className="dj-overlay">
      <div className="dj-header">
        <div className="dj-title">
          <IoMusicalNotes />
          <span className="dj-title-glow">DJ MODE</span>
        </div>
        <button className="dj-close" onClick={onClose}><IoClose /></button>
      </div>

      <div className="dj-decks">
        {/* Deck A */}
        <div className="dj-deck a">
          <div className="dj-deck-head">
            <div className="dj-deck-label">A</div>
            <div className="dj-deck-info">
              {currentSong ? (
                <>
                  <div className="dj-deck-title">{currentSong.title}</div>
                  <div className="dj-deck-artist">{currentSong.artist || 'Unknown Artist'}</div>
                </>
              ) : (
                <div className="dj-deck-empty">Nothing loaded — pick a song</div>
              )}
            </div>
            <button className="dj-load-btn" onClick={() => setPickerSide('a')}>
              <IoMusicalNotes /> Load
            </button>
          </div>

          <div className="dj-platter" style={deckASpinStyle} />

          <div className="dj-seek" onClick={seekA}>
            <div className="dj-seek-fill" style={{ '--fill': `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          </div>
          <div className="dj-seek-time">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>

          <div className="dj-deck-controls">
            <button className="dj-ctrl" onClick={() => seek(Math.max(0, currentTime - 10))} title="Back 10s"><IoPlaySkipBackSharp /></button>
            <button className="dj-ctrl play" onClick={togglePlay} disabled={!currentSong}>
              {isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
            </button>
            <button className="dj-ctrl" onClick={() => seek(Math.min(duration, currentTime + 10))} title="Skip 10s"><IoPlaySkipForwardSharp /></button>
          </div>

          <div className="dj-knobs">
            <div className="dj-knob">
              <div className="dj-knob-label">
                <span>Volume</span>
                <span className="dj-knob-val">{Math.round(deckAVol * 100)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={deckAVol}
                onChange={e => setDeckAVol(parseFloat(e.target.value))} />
            </div>
            <div className="dj-knob">
              <div className="dj-knob-label">
                <span>Tempo</span>
                <span className="dj-knob-val">{playbackSpeed.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.01" value={playbackSpeed}
                onChange={e => setSpeed(parseFloat(e.target.value))} />
            </div>
          </div>

          {/* Deck A EQ: low / mid / high */}
          <div className="dj-eq">
            {DJ_EQ_LABELS.map((lbl, i) => (
              <div key={lbl} className="dj-eq-band">
                <div className="dj-eq-label">
                  <span>{lbl}</span>
                  <span className="dj-eq-val">{deckAEq[i] > 0 ? '+' : ''}{deckAEq[i]}</span>
                </div>
                <input
                  type="range" min="-12" max="12" step="0.5" value={deckAEq[i]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setDeckAEq(prev => prev.map((p, idx) => idx === i ? v : p));
                  }}
                />
              </div>
            ))}
            <button className="dj-eq-reset" onClick={() => setDeckAEq([0, 0, 0])}>Reset EQ</button>
          </div>

          {pickerSide === 'a' && (
            <div className="dj-picker" onClick={e => e.stopPropagation()}>
              <div className="dj-picker-head">
                <IoSearch style={{ color: 'var(--text-muted)' }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search your library..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                />
                <button className="dj-picker-close" onClick={() => setPickerSide(null)}><IoClose /></button>
              </div>
              <div className="dj-picker-list">
                {filteredLibrary.map(s => (
                  <button key={s.id} className="dj-picker-item" onClick={() => handlePick(s)}>
                    <div className="dj-picker-art">
                      {s.artwork ? <img src={s.artwork} alt="" /> : null}
                    </div>
                    <div className="dj-picker-info">
                      <div className="dj-picker-title">{s.title}</div>
                      <div className="dj-picker-artist">{s.artist || 'Unknown'}</div>
                    </div>
                  </button>
                ))}
                {filteredLibrary.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20, fontSize: 12 }}>
                    No matching songs
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Deck B */}
        <div className="dj-deck b">
          <div className="dj-deck-head">
            <div className="dj-deck-label">B</div>
            <div className="dj-deck-info">
              {deckBSong ? (
                <>
                  <div className="dj-deck-title">{deckBSong.title}</div>
                  <div className="dj-deck-artist">{deckBSong.artist || 'Unknown Artist'}</div>
                </>
              ) : (
                <div className="dj-deck-empty">Load a song to deck B</div>
              )}
            </div>
            <button className="dj-load-btn" onClick={() => setPickerSide('b')}>
              <IoMusicalNotes /> Load
            </button>
          </div>

          <div className="dj-platter" style={deckBSpinStyle} />

          <div className="dj-seek" onClick={deckBSeek}>
            <div className="dj-seek-fill" style={{ '--fill': `${deckBDuration ? (deckBTime / deckBDuration) * 100 : 0}%` }} />
          </div>
          <div className="dj-seek-time">
            <span>{fmt(deckBTime)}</span>
            <span>{fmt(deckBDuration)}</span>
          </div>

          <div className="dj-deck-controls">
            <button className="dj-ctrl" onClick={() => { const a = deckBAudioRef.current; if (a) a.currentTime = Math.max(0, a.currentTime - 10); }}><IoPlaySkipBackSharp /></button>
            <button className="dj-ctrl play" onClick={toggleDeckB} disabled={!deckBSong}>
              {deckBPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
            </button>
            <button className="dj-ctrl" onClick={() => { const a = deckBAudioRef.current; if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); }}><IoPlaySkipForwardSharp /></button>
          </div>

          <div className="dj-knobs">
            <div className="dj-knob">
              <div className="dj-knob-label">
                <span>Volume</span>
                <span className="dj-knob-val">{Math.round(deckBVol * 100)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={deckBVol}
                onChange={e => setDeckBVol(parseFloat(e.target.value))} />
            </div>
            <div className="dj-knob">
              <div className="dj-knob-label">
                <span>Tempo</span>
                <span className="dj-knob-val">{deckBSpeed.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.01" value={deckBSpeed}
                onChange={e => setDeckBSpeed(parseFloat(e.target.value))} />
            </div>
          </div>

          {/* Deck B EQ: low / mid / high */}
          <div className="dj-eq">
            {DJ_EQ_LABELS.map((lbl, i) => (
              <div key={lbl} className="dj-eq-band">
                <div className="dj-eq-label">
                  <span>{lbl}</span>
                  <span className="dj-eq-val">{deckBEq[i] > 0 ? '+' : ''}{deckBEq[i]}</span>
                </div>
                <input
                  type="range" min="-12" max="12" step="0.5" value={deckBEq[i]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setDeckBEq(prev => prev.map((p, idx) => idx === i ? v : p));
                  }}
                />
              </div>
            ))}
            <button className="dj-eq-reset" onClick={() => setDeckBEq([0, 0, 0])}>Reset EQ</button>
          </div>

          {pickerSide === 'b' && (
            <div className="dj-picker" onClick={e => e.stopPropagation()}>
              <div className="dj-picker-head">
                <IoSearch style={{ color: 'var(--text-muted)' }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search your library..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                />
                <button className="dj-picker-close" onClick={() => setPickerSide(null)}><IoClose /></button>
              </div>
              <div className="dj-picker-list">
                {filteredLibrary.map(s => (
                  <button key={s.id} className="dj-picker-item" onClick={() => handlePick(s)}>
                    <div className="dj-picker-art">
                      {s.artwork ? <img src={s.artwork} alt="" /> : null}
                    </div>
                    <div className="dj-picker-info">
                      <div className="dj-picker-title">{s.title}</div>
                      <div className="dj-picker-artist">{s.artist || 'Unknown'}</div>
                    </div>
                  </button>
                ))}
                {filteredLibrary.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20, fontSize: 12 }}>
                    No matching songs
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dj-crossfader">
        <div className="dj-crossfader-label">
          <span className="a">DECK A</span>
          <span className="mid">{crossfader === 0.5 ? 'MIX' : crossfader < 0.5 ? `${Math.round((1 - crossfader) * 100)}% A` : `${Math.round(crossfader * 100)}% B`}</span>
          <span className="b">DECK B</span>
        </div>
        <div className="dj-crossfader-track">
          <input
            type="range" min="0" max="1" step="0.01" value={crossfader}
            onChange={e => setCrossfader(parseFloat(e.target.value))}
          />
        </div>
        <div className="dj-quick-actions">
          <button className="dj-quick-btn" onClick={() => setCrossfader(0)}>Cut to A</button>
          <button className="dj-quick-btn" onClick={() => setCrossfader(0.5)}>50/50 Mix</button>
          <button className="dj-quick-btn" onClick={() => setCrossfader(1)}>Cut to B</button>
          <button className="dj-quick-btn" onClick={() => autoFadeToB(6)}>Auto-fade → B (6s)</button>
          <button className="dj-quick-btn" onClick={swapDecks}><IoSwapHorizontal /> Flip</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
