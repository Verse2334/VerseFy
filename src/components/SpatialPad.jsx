import { useRef, useState, useEffect, useCallback } from 'react';
import { IoClose, IoHeadset } from 'react-icons/io5';
import { usePlayer } from '../context/PlayerContext';
import './SpatialPad.css';

export default function SpatialPad({ onClose }) {
  const { spatialEnabled, spatialX, spatialY, setSpatialPad, ensureAudioGraph } = usePlayer();
  const padRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const updatePosFromEvent = useCallback((e) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    // Map to -1..1
    const x = Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((clientY - rect.top) / rect.height) * 2 - 1));
    setSpatialPad({ x, y });
  }, [setSpatialPad]);

  const onDown = useCallback((e) => {
    if (!spatialEnabled) return;
    e.preventDefault();
    ensureAudioGraph();
    setDragging(true);
    updatePosFromEvent(e);
  }, [spatialEnabled, updatePosFromEvent, ensureAudioGraph]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => updatePosFromEvent(e);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updatePosFromEvent]);

  const toggleEnabled = () => {
    ensureAudioGraph();
    setSpatialPad({ enabled: !spatialEnabled });
  };

  const resetPos = () => setSpatialPad({ x: 0, y: 0 });

  // Ball position in %
  const ballX = ((spatialX + 1) / 2) * 100;
  const ballY = ((spatialY + 1) / 2) * 100;

  // Display values
  const panLabel = spatialX === 0 ? 'Center'
    : spatialX < 0 ? `${Math.round(Math.abs(spatialX) * 100)}% L`
    : `${Math.round(spatialX * 100)}% R`;
  const distLabel = spatialY < -0.1 ? 'Close'
    : spatialY > 0.1 ? 'Far'
    : 'Normal';

  return (
    <div className="spatial-panel">
      <div className="spatial-header">
        <IoHeadset style={{ color: 'var(--accent)', fontSize: 18 }} />
        <h3>Spatial Audio</h3>
        <span className="spatial-badge">Headphones</span>
        <button className="spatial-close" onClick={onClose} title="Close"><IoClose /></button>
      </div>
      <p className="spatial-sub">Drag the ball to position the sound around your head.</p>

      <div className="spatial-toggle-row">
        <label onClick={toggleEnabled}>Enable spatial positioning</label>
        <div className={`spatial-switch ${spatialEnabled ? 'on' : ''}`} onClick={toggleEnabled} />
      </div>

      <div
        ref={padRef}
        className={`spatial-pad ${dragging ? 'dragging' : ''} ${!spatialEnabled ? 'disabled' : ''}`}
        onMouseDown={onDown}
        onTouchStart={onDown}
      >
        <div className="spatial-ring r3" />
        <div className="spatial-ring r2" />
        <div className="spatial-ring r1" />
        <div className="spatial-axis h" />
        <div className="spatial-axis v" />
        <div className="spatial-label top">FRONT</div>
        <div className="spatial-label bot">BEHIND</div>
        <div className="spatial-label left">L</div>
        <div className="spatial-label right">R</div>
        <IoHeadset className="spatial-head" />
        <div
          className="spatial-ball"
          style={{ left: `${ballX}%`, top: `${ballY}%` }}
        />
      </div>

      <div className="spatial-values">
        <span>Pan <strong>{panLabel}</strong></span>
        <span>Depth <strong>{distLabel}</strong></span>
      </div>

      <button className="spatial-reset" onClick={resetPos}>Re-center</button>
    </div>
  );
}
