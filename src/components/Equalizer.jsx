import { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  IoClose, IoRefresh, IoFlash, IoMusicalNote, IoVolumeHigh, IoMoon,
  IoSwapHorizontal, IoWater, IoHeadset, IoRadio, IoMic, IoSettings,
  IoBrush, IoColorWand
} from 'react-icons/io5';
import './Equalizer.css';

const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0],
  bass: [8, 5, 1, 0, 0, 0],
  treble: [0, 0, 0, 2, 5, 7],
  vocal: [-2, 0, 3, 4, 2, 0],
  electronic: [5, 3, 0, -1, 3, 6],
  rock: [4, 2, -1, 1, 3, 5],
  jazz: [3, 1, -1, 2, 3, 4],
};

const BAND_LABELS = ['60', '170', '350', '1K', '3.5K', '10K'];
const SPEED_MARKS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SLEEP_OPTIONS = [0, 5, 10, 15, 30, 45, 60, 90];
const PITCH_MARKS = [-6, -3, 0, 3, 6];

export default function Equalizer() {
  const {
    eqValues, setEQ, resetEQ, crossfadeDuration, setCrossfade, playbackSpeed, setSpeed, toggleEQ,
    bassBoost, toggleBassBoost, bassBoostAmount, setBassBoostAmount, pitchShift, setPitchShift,
    normalization, toggleNormalization, sleepTimer, setSleepTimer,
    transitionEffect, setTransitionEffect, TRANSITION_EFFECTS,
    reverbAmount, setReverbAmount, monoMode, toggleMono,
    eightDAudio, toggle8DAudio, karaoke, toggleKaraoke,
    vibeMorph, setVibeMorph,
  } = usePlayer();
  const [showMore, setShowMore] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVibeMorph, setShowVibeMorph] = useState(false);
  const [wandMode, setWandMode] = useState(false);
  const wandCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const pathRef = useRef([]); // smoothed mouse path
  const W = 300, H = 140;

  // Convert a path of points (x in 0..1) to 6 EQ band values
  const pathToEq = useCallback((path) => {
    if (path.length < 2) return null;
    const bandXs = [0.08, 0.22, 0.38, 0.55, 0.75, 0.92]; // approx log positions
    const result = [];
    for (const bx of bandXs) {
      // Find nearest points around bx and interpolate Y
      let closest = path[0], dist = Infinity;
      for (const p of path) {
        const d = Math.abs(p.x - bx);
        if (d < dist) { dist = d; closest = p; }
      }
      // Y 0 = top (+12 dB), 1 = bottom (-12 dB)
      const db = (0.5 - closest.y) * 24;
      result.push(Math.max(-12, Math.min(12, Math.round(db * 2) / 2)));
    }
    return result;
  }, []);

  const drawWandCanvas = useCallback(() => {
    const canvas = wandCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);

    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);

    // Draw current EQ curve from band values (interpolated)
    const bandXs = [0.08, 0.22, 0.38, 0.55, 0.75, 0.92];
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < bandXs.length; i++) {
      const x = bandXs[i] * W;
      const y = H / 2 - (eqValues[i] / 12) * (H / 2 - 8);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dots on band points
    ctx.fillStyle = '#ec4899';
    for (let i = 0; i < bandXs.length; i++) {
      const x = bandXs[i] * W;
      const y = H / 2 - (eqValues[i] / 12) * (H / 2 - 8);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw active path preview
    if (pathRef.current.length > 1) {
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < pathRef.current.length; i++) {
        const p = pathRef.current[i];
        const x = p.x * W, y = p.y * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Band labels
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < bandXs.length; i++) {
      ctx.fillText(BAND_LABELS[i], bandXs[i] * W, H - 4);
    }
  }, [eqValues]);

  useEffect(() => {
    if (wandMode) drawWandCanvas();
  }, [wandMode, drawWandCanvas]);

  const onWandPointer = (e, type) => {
    const canvas = wandCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const x = Math.max(0, Math.min(1, cx / rect.width));
    const y = Math.max(0, Math.min(1, cy / rect.height));

    if (type === 'down') {
      drawingRef.current = true;
      pathRef.current = [{ x, y }];
    } else if (type === 'move') {
      if (!drawingRef.current) return;
      pathRef.current.push({ x, y });
      drawWandCanvas();
    } else if (type === 'up') {
      drawingRef.current = false;
      const eq = pathToEq(pathRef.current);
      if (eq) setEQ(eq);
      pathRef.current = [];
      // Canvas will redraw via eqValues effect
    }
  };

  function handleBandChange(index, value) {
    const newValues = [...eqValues];
    newValues[index] = parseFloat(value);
    setEQ(newValues);
  }

  function applyPreset(name) {
    setEQ([...PRESETS[name]]);
  }

  return (
    <div className="eq-panel">
      <div className="eq-header">
        <h3>Equalizer</h3>
        <button className="eq-close" onClick={toggleEQ}><IoClose /></button>
      </div>

      {/* Vibe Morph — hidden by default, toggle to reveal */}
      <button
        className={`vibe-morph-toggle ${showVibeMorph ? 'active' : ''}`}
        onClick={() => setShowVibeMorph(!showVibeMorph)}
      >
        <IoColorWand /> {showVibeMorph ? 'Hide Vibe Morph' : 'Show Vibe Morph'}
      </button>

      {showVibeMorph && (
        <div className="vibe-morph">
          <div className="vibe-morph-head">
            <span className="vibe-morph-label">Vibe Morph</span>
            <span className="vibe-morph-val">
              {vibeMorph < 33 ? 'Chill' : vibeMorph > 66 ? 'Hype' : 'Neutral'} · {vibeMorph}
            </span>
          </div>
          <input
            type="range" min="0" max="100" step="1" value={vibeMorph}
            onChange={e => setVibeMorph(parseInt(e.target.value))}
            className="vibe-morph-slider"
          />
          <div className="vibe-morph-ends">
            <span>❄ Chill</span>
            <span>Hype ⚡</span>
          </div>
          <button className="vibe-morph-reset" onClick={() => setVibeMorph(50)}>Reset to neutral</button>
        </div>
      )}

      {/* Magic wand toggle */}
      <button
        className={`eq-wand-toggle ${wandMode ? 'active' : ''}`}
        onClick={() => setWandMode(!wandMode)}
      >
        <IoColorWand /> {wandMode ? 'Close Magic Wand' : 'Draw EQ Curve (Magic Wand)'}
      </button>

      {wandMode && (
        <div className="eq-wand-wrap">
          <canvas
            ref={wandCanvasRef}
            width={W}
            height={H}
            className="eq-wand-canvas"
            onMouseDown={e => onWandPointer(e, 'down')}
            onMouseMove={e => onWandPointer(e, 'move')}
            onMouseUp={e => onWandPointer(e, 'up')}
            onMouseLeave={e => drawingRef.current && onWandPointer(e, 'up')}
            onTouchStart={e => { e.preventDefault(); onWandPointer(e, 'down'); }}
            onTouchMove={e => { e.preventDefault(); onWandPointer(e, 'move'); }}
            onTouchEnd={e => onWandPointer(e, 'up')}
          />
          <p className="eq-wand-hint"><IoBrush /> Drag across to paint your EQ curve</p>
        </div>
      )}

      {/* Presets */}
      <div className="eq-presets">
        {Object.keys(PRESETS).map(name => (
          <button
            key={name}
            className={`eq-preset ${JSON.stringify(eqValues) === JSON.stringify(PRESETS[name]) ? 'active' : ''}`}
            onClick={() => applyPreset(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="eq-sliders">
        {eqValues.map((val, i) => (
          <div key={i} className="eq-band">
            <span className="eq-val">{val > 0 ? '+' : ''}{val}dB</span>
            <div className="eq-slider-track">
              <input
                type="range" min="-12" max="12" step="0.5" value={val}
                onChange={e => handleBandChange(i, e.target.value)}
                className="eq-slider" orient="vertical"
              />
              <div className="eq-fill" style={{
                height: `${((val + 12) / 24) * 100}%`,
                background: val >= 0 ? 'linear-gradient(0deg, var(--accent), var(--accent-hover))' : 'linear-gradient(0deg, #ec4899, #f472b6)',
              }} />
            </div>
            <span className="eq-label">{BAND_LABELS[i]}</span>
          </div>
        ))}
      </div>

      <button className="eq-reset" onClick={resetEQ}>
        <IoRefresh /> Reset
      </button>

      {/* Speed control */}
      <div className="eq-section">
        <div className="eq-section-header">
          <span>Speed</span>
          <span className="eq-section-val">{playbackSpeed.toFixed(2)}x</span>
        </div>
        <input
          type="range" min="0.5" max="2.0" step="0.05" value={playbackSpeed}
          onChange={e => setSpeed(parseFloat(e.target.value))}
          className="eq-range"
        />
        <div className="eq-speed-marks">
          {SPEED_MARKS.map(s => (
            <button key={s} className={`eq-speed-btn ${Math.abs(playbackSpeed - s) < 0.03 ? 'active' : ''}`}
              onClick={() => setSpeed(s)}>{s}x</button>
          ))}
        </div>
      </div>

      {/* Crossfade control */}
      <div className="eq-section">
        <div className="eq-section-header">
          <span>Crossfade</span>
          <span className="eq-section-val">{crossfadeDuration}s</span>
        </div>
        <input
          type="range" min="0" max="8" step="1" value={crossfadeDuration}
          onChange={e => setCrossfade(parseInt(e.target.value))}
          className="eq-range"
        />
        <div className="eq-range-labels">
          <span>Off</span>
          <span>8s</span>
        </div>
      </div>

      {/* Reverb */}
      <div className="eq-section">
        <div className="eq-section-header">
          <span><IoWater style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reverb</span>
          <span className="eq-section-val">{reverbAmount}%</span>
        </div>
        <input
          type="range" min="0" max="100" step="1" value={reverbAmount}
          onChange={e => setReverbAmount(parseInt(e.target.value))}
          className="eq-range"
        />
        <div className="eq-range-labels">
          <span>Dry</span>
          <span>Wet</span>
        </div>
      </div>

      {/* Quick toggles */}
      <div className="eq-toggles">
        <button className={`eq-toggle-btn ${bassBoost ? 'active' : ''}`} onClick={toggleBassBoost}>
          <IoFlash /> Bass Boost
        </button>
        <button className={`eq-toggle-btn ${normalization ? 'active' : ''}`} onClick={toggleNormalization}>
          <IoVolumeHigh /> Normalize
        </button>
      </div>

      {/* Bass boost intensity — only while bass boost is ON */}
      {bassBoost && (
        <div className="eq-section">
          <div className="eq-section-header">
            <span><IoFlash style={{ verticalAlign: 'middle', marginRight: 4 }} /> Bass Intensity</span>
            <span className="eq-section-val">+{bassBoostAmount} dB</span>
          </div>
          <input
            type="range" min="1" max="24" step="1" value={bassBoostAmount}
            onChange={e => setBassBoostAmount(parseInt(e.target.value))}
            className="eq-range"
          />
          <div className="eq-range-labels">
            <span>Subtle</span>
            <span>Rumble</span>
          </div>
        </div>
      )}

      {/* Advanced Options button */}
      <button className={`eq-advanced-btn ${showAdvanced ? 'active' : ''}`} onClick={() => setShowAdvanced(!showAdvanced)}>
        <IoSettings /> Advanced Options
      </button>

      {/* Advanced Options Panel */}
      {showAdvanced && (
        <div className="eq-advanced-panel">
          {/* 8D Audio */}
          <div className="eq-adv-row">
            <div className="eq-adv-info">
              <span className="eq-adv-label"><IoHeadset /> 8D Audio</span>
              <span className="eq-adv-desc">Auto-pans sound left to right</span>
            </div>
            <button className={`eq-adv-toggle ${eightDAudio ? 'on' : ''}`} onClick={toggle8DAudio}>
              {eightDAudio ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Mono */}
          <div className="eq-adv-row">
            <div className="eq-adv-info">
              <span className="eq-adv-label"><IoRadio /> Mono Mode</span>
              <span className="eq-adv-desc">Merge stereo to single channel</span>
            </div>
            <button className={`eq-adv-toggle ${monoMode ? 'on' : ''}`} onClick={toggleMono}>
              {monoMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Karaoke */}
          <div className="eq-adv-row">
            <div className="eq-adv-info">
              <span className="eq-adv-label"><IoMic /> Karaoke</span>
              <span className="eq-adv-desc">Reduce center-panned vocals</span>
            </div>
            <button className={`eq-adv-toggle ${karaoke ? 'on' : ''}`} onClick={toggleKaraoke}>
              {karaoke ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Pitch shift */}
          <div className="eq-section" style={{ borderTop: 'none', paddingTop: 8 }}>
            <div className="eq-section-header">
              <span><IoMusicalNote style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pitch</span>
              <span className="eq-section-val">{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
            </div>
            <input
              type="range" min="-12" max="12" step="1" value={pitchShift}
              onChange={e => setPitchShift(parseInt(e.target.value))}
              className="eq-range"
            />
            <div className="eq-speed-marks">
              {PITCH_MARKS.map(p => (
                <button key={p} className={`eq-speed-btn ${pitchShift === p ? 'active' : ''}`}
                  onClick={() => setPitchShift(p)}>{p > 0 ? '+' : ''}{p}</button>
              ))}
            </div>
          </div>

          {/* Transition effects */}
          <div className="eq-section" style={{ borderTop: 'none', paddingTop: 8 }}>
            <div className="eq-section-header">
              <span><IoSwapHorizontal style={{ verticalAlign: 'middle', marginRight: 4 }} /> Transition</span>
              <span className="eq-section-val" style={{ textTransform: 'capitalize' }}>{transitionEffect}</span>
            </div>
            <div className="eq-speed-marks">
              {TRANSITION_EFFECTS.map(e => (
                <button key={e} className={`eq-speed-btn ${transitionEffect === e ? 'active' : ''}`}
                  onClick={() => setTransitionEffect(e)} style={{ textTransform: 'capitalize' }}>{e}</button>
              ))}
            </div>
          </div>

          {/* Sleep timer */}
          <div className="eq-section" style={{ borderTop: 'none', paddingTop: 8 }}>
            <div className="eq-section-header">
              <span><IoMoon style={{ verticalAlign: 'middle', marginRight: 4 }} /> Sleep Timer</span>
              <span className="eq-section-val">{sleepTimer > 0 ? `${sleepTimer}m` : 'Off'}</span>
            </div>
            <div className="eq-speed-marks" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {SLEEP_OPTIONS.map(m => (
                <button key={m} className={`eq-speed-btn ${sleepTimer === m ? 'active' : ''}`}
                  onClick={() => setSleepTimer(m)}>{m === 0 ? 'Off' : `${m}m`}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Show more (legacy — hidden if advanced is open) */}
      {!showAdvanced && (
        <button className="eq-more-btn" onClick={() => setShowMore(!showMore)}>
          {showMore ? 'Less options' : 'More options'}
        </button>
      )}

      {showMore && !showAdvanced && (
        <>
          <div className="eq-section">
            <div className="eq-section-header">
              <span><IoMusicalNote style={{ verticalAlign: 'middle', marginRight: 4 }} /> Pitch</span>
              <span className="eq-section-val">{pitchShift > 0 ? '+' : ''}{pitchShift} st</span>
            </div>
            <input
              type="range" min="-12" max="12" step="1" value={pitchShift}
              onChange={e => setPitchShift(parseInt(e.target.value))}
              className="eq-range"
            />
            <div className="eq-speed-marks">
              {PITCH_MARKS.map(p => (
                <button key={p} className={`eq-speed-btn ${pitchShift === p ? 'active' : ''}`}
                  onClick={() => setPitchShift(p)}>{p > 0 ? '+' : ''}{p}</button>
              ))}
            </div>
          </div>

          <div className="eq-section">
            <div className="eq-section-header">
              <span><IoMoon style={{ verticalAlign: 'middle', marginRight: 4 }} /> Sleep Timer</span>
              <span className="eq-section-val">{sleepTimer > 0 ? `${sleepTimer}m` : 'Off'}</span>
            </div>
            <div className="eq-speed-marks" style={{ flexWrap: 'wrap', gap: '4px' }}>
              {SLEEP_OPTIONS.map(m => (
                <button key={m} className={`eq-speed-btn ${sleepTimer === m ? 'active' : ''}`}
                  onClick={() => setSleepTimer(m)}>{m === 0 ? 'Off' : `${m}m`}</button>
              ))}
            </div>
          </div>

          <div className="eq-section">
            <div className="eq-section-header">
              <span><IoSwapHorizontal style={{ verticalAlign: 'middle', marginRight: 4 }} /> Transition</span>
              <span className="eq-section-val" style={{ textTransform: 'capitalize' }}>{transitionEffect}</span>
            </div>
            <div className="eq-speed-marks">
              {TRANSITION_EFFECTS.map(e => (
                <button key={e} className={`eq-speed-btn ${transitionEffect === e ? 'active' : ''}`}
                  onClick={() => setTransitionEffect(e)} style={{ textTransform: 'capitalize' }}>{e}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
