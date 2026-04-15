import { useRef, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function WallpaperViz() {
  const { showWallpaperViz, analyserRef, ensureAudioGraph } = usePlayer();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({ particles: null, pulses: [], lastBeat: 0 });

  useEffect(() => {
    if (!showWallpaperViz) {
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      return;
    }

    ensureAudioGraph();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const st = stateRef.current;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      st.particles = null; // regenerate on resize
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      const analyser = analyserRef.current;

      const dataArray = new Uint8Array(analyser?.frequencyBinCount || 256);
      if (analyser) analyser.getByteFrequencyData(dataArray);

      // Audio analysis
      let bass = 0, mid = 0, treble = 0;
      const len = dataArray.length;
      for (let i = 0; i < len * 0.15; i++) bass += dataArray[i];
      for (let i = Math.floor(len * 0.15); i < len * 0.5; i++) mid += dataArray[i];
      for (let i = Math.floor(len * 0.5); i < len; i++) treble += dataArray[i];
      bass = bass / (len * 0.15) / 255;
      mid = mid / (len * 0.35) / 255;
      treble = treble / (len * 0.5) / 255;
      const energy = (bass + mid + treble) / 3;

      // Beat detection
      const beat = bass > 0.6 && bass - st.lastBeat > 0.1 ? bass : 0;
      st.lastBeat = bass;

      const t = performance.now() / 1000;
      const hue = (t * 12) % 360;

      // Fade - slower fade = more trail
      ctx.fillStyle = `rgba(4, 2, 10, ${0.04 + energy * 0.03})`;
      ctx.fillRect(0, 0, W, H);

      // Init particles
      if (!st.particles) {
        st.particles = Array.from({ length: 80 }, () => ({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
          size: 1 + Math.random() * 2, hue: Math.random() * 360,
          phase: Math.random() * Math.PI * 2,
        }));
      }

      // Reactive gradient orbs - bigger, brighter
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const ox = W * (0.1 + i * 0.16) + Math.sin(t * 0.25 + i * 1.2) * (100 + bass * 50);
        const oy = H * (0.2 + i * 0.1) + Math.cos(t * 0.18 + i * 0.8) * (80 + mid * 40);
        const or = 80 + energy * 180 + bass * 100;
        const orbHue = (hue + i * 60) % 360;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
        grad.addColorStop(0, `hsla(${orbHue}, 80%, 55%, ${0.04 + energy * 0.07 + beat * 0.05})`);
        grad.addColorStop(0.4, `hsla(${orbHue + 30}, 70%, 45%, ${0.02 + mid * 0.04})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(ox, oy, or, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Reactive particles - move with music
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of st.particles) {
        // Particles react to bass
        p.x += p.vx * (1 + bass * 4) + Math.sin(t + p.phase) * 0.3;
        p.y += p.vy * (1 + bass * 4) + Math.cos(t + p.phase) * 0.3;

        // Wrap around
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const sz = p.size * (1 + energy * 1.5 + beat * 1);
        const bright = 0.15 + energy * 0.4 + Math.sin(t * 2 + p.phase) * 0.1;
        const pH = (p.hue + hue) % 360;

        // Glow
        ctx.beginPath(); ctx.arc(p.x, p.y, sz * 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${pH}, 70%, 60%, ${bright * 0.06})`; ctx.fill();
        // Core
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${pH}, 80%, 75%, ${bright * 0.5})`; ctx.fill();
      }
      ctx.restore();

      // Frequency wave through the middle - big and reactive
      if (energy > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let w = 0; w < 3; w++) {
          const waveY = H * (0.35 + w * 0.15);
          ctx.beginPath();
          for (let x = 0; x < W; x += 2) {
            const di = Math.floor((x / W) * len * 0.5);
            const val = (dataArray[di] || 0) / 255;
            const amp = 30 + val * 60 * energy + bass * 25;
            const y = waveY + Math.sin(x * 0.006 + t * (0.8 + w * 0.3)) * amp
              + Math.sin(x * 0.015 + t * 0.4) * (10 + mid * 15);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          const wHue = (hue + w * 45) % 360;
          ctx.strokeStyle = `hsla(${wHue}, 70%, 55%, ${0.03 + energy * 0.05})`;
          ctx.lineWidth = 2 + energy * 3;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Frequency bars at bottom
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const barCount = 100;
      const barW = W / barCount;
      for (let i = 0; i < barCount; i++) {
        const di = Math.floor((i / barCount) * len * 0.6);
        const val = (dataArray[di] || 0) / 255;
        const barH = val * 60 * energy;
        if (barH < 1) continue;
        const barHue = (hue + i * 3.6) % 360;
        ctx.fillStyle = `hsla(${barHue}, 75%, 55%, ${val * 0.06 + energy * 0.02})`;
        ctx.fillRect(i * barW, H - barH, barW - 0.5, barH);
        // Mirror on top
        ctx.fillStyle = `hsla(${barHue}, 75%, 55%, ${val * 0.03})`;
        ctx.fillRect(i * barW, 0, barW - 0.5, barH * 0.5);
      }
      ctx.restore();

      // Beat pulse rings
      if (beat > 0.5) {
        st.pulses.push({ x: W / 2, y: H / 2, r: 10, alpha: 0.3 + beat * 0.2, hue: hue });
      }
      for (let i = st.pulses.length - 1; i >= 0; i--) {
        const p = st.pulses[i];
        p.r += 4 + energy * 5;
        p.alpha *= 0.95;
        if (p.alpha < 0.01) { st.pulses.splice(i, 1); continue; }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, ${p.alpha})`;
        ctx.lineWidth = 1.5 + p.alpha * 3; ctx.stroke();
        ctx.restore();
      }

      // Diagonal light streaks on beats
      if (beat > 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let s = 0; s < 3; s++) {
          const sx = Math.random() * W;
          const grad = ctx.createLinearGradient(sx, 0, sx - 100, H);
          grad.addColorStop(0, `hsla(${(hue + s * 40) % 360}, 80%, 60%, ${beat * 0.04})`);
          grad.addColorStop(0.5, `hsla(${(hue + s * 40 + 20) % 360}, 70%, 50%, ${beat * 0.02})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(sx - 2, 0, 4, H);
        }
        ctx.restore();
      }
    }

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      window.removeEventListener('resize', resize);
    };
  }, [showWallpaperViz, analyserRef, ensureAudioGraph]);

  if (!showWallpaperViz) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 1,
        pointerEvents: 'none', width: '100%', height: '100%',
        opacity: 0.75,
      }}
    />
  );
}
