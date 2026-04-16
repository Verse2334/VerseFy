import { useRef, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function MiniWaveform({ width = 120, height = 32 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const dataRef = useRef(null);
  const { analyserRef, isPlaying, ensureAudioGraph } = usePlayer();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    let lastDraw = 0;

    function draw(now) {
      animRef.current = requestAnimationFrame(draw);

      // Pause entirely when window hidden
      if (document.hidden) return;
      // Throttle to ~24fps
      if (now - lastDraw < 42) return;
      lastDraw = now;

      ctx.clearRect(0, 0, width, height);
      const analyser = analyserRef.current;

      if (analyser && isPlaying) {
        if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
          dataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(dataRef.current);
        const data = dataRef.current;

        const barCount = 28;
        const barWidth = width / barCount - 1.5;
        const step = Math.floor(data.length / barCount);

        for (let i = 0; i < barCount; i++) {
          const val = data[i * step] / 255;
          const barH = Math.max(2, val * height * 0.9);
          const x = i * (barWidth + 1.5);
          const y = height - barH;

          const hue = 270 + (i / barCount) * 60;
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${0.5 + val * 0.5})`;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, 1.5);
          ctx.fill();
        }
      } else {
        for (let i = 0; i < 28; i++) {
          const barWidth = width / 28 - 1.5;
          const x = i * (barWidth + 1.5);
          ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
          ctx.beginPath();
          ctx.roundRect(x, height - 3, barWidth, 3, 1);
          ctx.fill();
        }
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyserRef, isPlaying, width, height, ensureAudioGraph]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, opacity: 0.9 }}
    />
  );
}
