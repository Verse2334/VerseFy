import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { integrityOK } from '../utils/integrity';
import { usePlayer } from '../context/PlayerContext';
import './TamperGuard.css';

export default function TamperGuard() {
  const [tampered, setTampered] = useState(false);
  const { pause } = usePlayer();

  useEffect(() => {
    // Check on mount
    if (!integrityOK()) {
      setTampered(true);
      try { pause(); } catch {}
    }
    // Re-check periodically — also catches mid-session tampering
    const interval = setInterval(() => {
      if (!integrityOK()) {
        setTampered(true);
        try { pause(); } catch {}
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [pause]);

  if (!tampered) return null;

  return createPortal(
    <div className="tamper-overlay">
      <div className="tamper-card">
        <div className="tamper-icon">⚠</div>
        <h1>Unauthorized Modification Detected</h1>
        <p>
          This copy of the application has been modified in a way that removes or alters the original
          creator's credit. Please obtain an unmodified copy from the official source.
        </p>
        <p className="tamper-sig">
          Versefy — Created by <strong>Verse</strong>. Free, non-commercial, community software.
        </p>
        <p className="tamper-small">
          Playback has been paused. This warning cannot be dismissed on a tampered build.
        </p>
      </div>
    </div>,
    document.body
  );
}
