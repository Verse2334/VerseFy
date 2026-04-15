import { useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import './AnimatedBG.css';

export default function AnimatedBG() {
  const canvasRef = useRef(null);
  const { theme, themes } = useTheme();
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const t = themes[theme];
    // Parse accent color to RGB
    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    }
    const c1 = hexToRgb(t.accent);
    const c2 = hexToRgb(t.secondary);

    // Particles
    const particles = [];
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.15 + 0.03,
        useSecondary: Math.random() > 0.5,
      });
    }

    let time = 0;
    function draw() {
      time += 0.005;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Slow-moving orbs
      for (let i = 0; i < 3; i++) {
        const a = time * 0.15 + i * 2.1;
        const ox = W * 0.5 + Math.cos(a) * W * 0.25;
        const oy = H * 0.3 + Math.sin(a * 0.7) * H * 0.2;
        const c = i % 2 === 0 ? c1 : c2;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 300);
        grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.04)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const c = p.useSecondary ? c2 : c1;
        const flicker = p.alpha + Math.sin(time * 2 + p.x * 0.01) * 0.02;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, flicker)})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [theme, themes]);

  return <canvas ref={canvasRef} className="animated-bg" />;
}
