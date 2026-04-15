import { useRef, useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useLocation } from 'react-router-dom';
import './Screensaver.css';

const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

export default function Screensaver() {
  const { currentSong, isPlaying, analyserRef, ensureAudioGraph } = usePlayer();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const dataRef = useRef(null);

  // Floating text position
  const textPosRef = useRef({ x: 0.5, y: 0.5, vx: 0.3, vy: 0.2 });

  // Reset idle timer on any user interaction
  useEffect(() => {
    function resetTimer() {
      if (active) setActive(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Only activate if music is playing and not already on visualizer page
        if (document.hidden) return;
        setActive(true);
      }, IDLE_TIMEOUT);
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  // Don't show if on visualizer page or not playing
  const onVisualizerPage = location.pathname === '/visualizer';
  const shouldShow = active && isPlaying && currentSong && !onVisualizerPage;

  // Canvas animation
  useEffect(() => {
    if (!shouldShow) {
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      return;
    }

    ensureAudioGraph();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const tp = textPosRef.current;

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      const analyser = analyserRef.current;

      if (!dataRef.current || dataRef.current.length !== (analyser?.frequencyBinCount || 256)) {
        dataRef.current = new Uint8Array(analyser?.frequencyBinCount || 256);
      }
      if (analyser) analyser.getByteFrequencyData(dataRef.current);
      const data = dataRef.current;

      let bass = 0, energy = 0;
      const len = data.length;
      for (let i = 0; i < len * 0.15; i++) bass += data[i];
      bass = bass / (len * 0.15) / 255;
      for (let i = 0; i < len; i++) energy += data[i];
      energy = energy / len / 255;

      const t = performance.now() / 1000;
      const hue = (t * 10) % 360;

      // Fade
      ctx.fillStyle = `rgba(2, 2, 8, 0.05)`;
      ctx.fillRect(0, 0, W, H);

      // Ambient orbs
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const ox = W * (0.2 + i * 0.2) + Math.sin(t * 0.2 + i * 1.5) * 100;
        const oy = H * (0.3 + i * 0.1) + Math.cos(t * 0.15 + i) * 80;
        const or = 100 + energy * 150 + bass * 80;
        const oHue = (hue + i * 90) % 360;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
        grad.addColorStop(0, `hsla(${oHue}, 70%, 50%, ${0.03 + energy * 0.05})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(ox, oy, or, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Frequency wave
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (let x = 0; x < W; x += 3) {
        const di = Math.floor((x / W) * len * 0.5);
        const val = (data[di] || 0) / 255;
        const y = H * 0.5 + Math.sin(x * 0.005 + t * 0.8) * (20 + val * 50) + Math.sin(x * 0.012 + t * 0.4) * 15;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${hue}, 60%, 50%, ${0.03 + energy * 0.04})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Floating song info — DVD screensaver style bounce
      tp.x += tp.vx * 0.001;
      tp.y += tp.vy * 0.001;
      if (tp.x < 0.1 || tp.x > 0.9) tp.vx *= -1;
      if (tp.y < 0.15 || tp.y > 0.85) tp.vy *= -1;

      const tx = tp.x * W;
      const ty = tp.y * H;

      // Text glow
      ctx.save();
      ctx.textAlign = 'center';

      // Song title
      ctx.font = 'bold 36px Inter, system-ui, sans-serif';
      ctx.fillStyle = `hsla(${hue}, 60%, 85%, ${0.7 + energy * 0.3})`;
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, ${0.4 + bass * 0.3})`;
      ctx.shadowBlur = 20 + bass * 20;
      ctx.fillText(currentSong?.title || '', tx, ty);

      // Artist
      ctx.font = '18px Inter, system-ui, sans-serif';
      ctx.fillStyle = `hsla(${hue + 30}, 50%, 70%, ${0.4 + energy * 0.2})`;
      ctx.shadowBlur = 10;
      ctx.fillText(currentSong?.artist || 'Unknown Artist', tx, ty + 36);

      // "Now Playing" badge
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${0.3 + Math.sin(t * 2) * 0.15})`;
      ctx.shadowBlur = 8;
      ctx.fillText('NOW PLAYING', tx, ty - 30);

      ctx.restore();
    }

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [shouldShow, currentSong, analyserRef, ensureAudioGraph]);

  if (!shouldShow) return null;

  return (
    <div className="screensaver" onClick={() => setActive(false)}>
      <canvas ref={canvasRef} className="screensaver-canvas" />
      <div className="screensaver-hint">Move mouse or press any key to exit</div>
    </div>
  );
}
