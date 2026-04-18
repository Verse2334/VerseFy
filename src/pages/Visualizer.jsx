import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { IoClose, IoEye, IoEyeOff, IoVolumeHigh } from 'react-icons/io5';
import './Visualizer.css';

function initParticles(W, H, count = 60) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
    size: Math.random() * 2 + 0.5, hue: Math.random() * 360,
    alpha: Math.random() * 0.35 + 0.15, trail: [],
  }));
}

function initStars(W, H, count = 120) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    size: Math.random() * 1.5 + 0.3, twinkle: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.5 + 0.1,
  }));
}

// ===== DRAW: RADIAL =====
function drawRadial(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, particles, stars) {
  const cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);

  // Nebula
  for (let i = 0; i < 3; i++) {
    const a = t * 0.2 + i * 2.1, dist = 180 + Math.sin(t * 0.3 + i) * 80;
    const c = i % 2 === 0 ? [139, 92, 246] : [236, 72, 153];
    const grad = ctx.createRadialGradient(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, 0, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, 300);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]}, 0.04)`); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  for (const s of stars) { s.twinkle += s.speed * 0.05; ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(s.twinkle) * 0.3 + treble * 0.2})`; ctx.fill(); }

  const orbR = Math.min(W, H) * 0.1 + bass * 60 + beat * 30;
  const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
  orbGrad.addColorStop(0, `hsla(${(t * 40) % 360}, 90%, 75%, ${0.4 + beat * 0.4})`);
  orbGrad.addColorStop(0.5, `hsla(${(t * 40 + 30) % 360}, 70%, 40%, 0.1)`); orbGrad.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fillStyle = orbGrad; ctx.fill();

  for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.arc(cx, cy, orbR + 30 + r * 35 + bass * 20, 0, Math.PI * 2); ctx.strokeStyle = `hsla(${(hueBase + r * 50) % 360}, 85%, 65%, ${0.12 + beat * 0.15})`; ctx.lineWidth = 1.5 + beat * 2; ctx.stroke(); }

  if (data) {
    const barCount = 160, step = Math.max(1, Math.floor(data.length / barCount)), innerR = orbR + 15;
    for (let i = 0; i < barCount; i++) {
      const val = data[i * step] / 255; if (val < 0.02) continue;
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2, hue = (hueBase + (i / barCount) * 300) % 360;
      const len = val * Math.min(W, H) * 0.25;
      const x1 = cx + Math.cos(angle) * innerR, y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + len), y2 = cy + Math.sin(angle) * (innerR + len);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `hsla(${hue}, 90%, 65%, ${0.5 + val * 0.5})`); g.addColorStop(1, `hsla(${hue}, 85%, 50%, 0)`);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1.5, (Math.PI * 2 * innerR) / barCount * 0.5); ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  for (const p of particles) {
    p.x += p.vx + (Math.random() - 0.5) * beat * 4; p.y += p.vy + (Math.random() - 0.5) * beat * 4;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    p.hue = (p.hue + 0.5) % 360;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size + bass * 2 + beat, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${p.alpha + energy * 0.2})`; ctx.fill();
  }

  if (beat > 0.5) { const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.5); fg.addColorStop(0, `hsla(${hueBase}, 90%, 80%, ${beat * 0.05})`); fg.addColorStop(1, 'transparent'); ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H); }
}

// ===== DRAW: BARS =====
function drawBars(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase) {
  ctx.clearRect(0, 0, W, H);

  if (!data) return;
  const barCount = 64, barW = W / barCount - 2, step = Math.max(1, Math.floor(data.length / barCount));

  for (let i = 0; i < barCount; i++) {
    const val = data[i * step] / 255;
    const barH = val * H * 0.45;
    const x = i * (barW + 2);
    const hue = (hueBase + (i / barCount) * 200) % 360;

    // Bottom bars
    const g = ctx.createLinearGradient(x, H, x, H - barH);
    g.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.9)`);
    g.addColorStop(1, `hsla(${(hue + 40) % 360}, 80%, 40%, 0.3)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, H - barH, barW, barH, 3); ctx.fill();

    // Mirror top (fainter)
    const g2 = ctx.createLinearGradient(x, 0, x, barH * 0.6);
    g2.addColorStop(0, `hsla(${hue}, 85%, 55%, 0.5)`);
    g2.addColorStop(1, `hsla(${hue}, 70%, 30%, 0)`);
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.roundRect(x, 0, barW, barH * 0.6, 3); ctx.fill();
  }

  // Center line glow
  ctx.beginPath(); ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5);
  ctx.strokeStyle = `hsla(${hueBase}, 80%, 60%, ${0.05 + beat * 0.1})`; ctx.lineWidth = 2 + beat * 4; ctx.stroke();

  if (beat > 0.5) { ctx.fillStyle = `rgba(255,255,255,${beat * 0.03})`; ctx.fillRect(0, 0, W, H); }
}

// ===== DRAW: WAVE =====
function drawWave(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, particles) {
  ctx.clearRect(0, 0, W, H);

  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(hueBase + p.hue) % 360}, 70%, 60%, ${p.alpha * 0.3})`; ctx.fill();
  }

  if (!data) return;
  const layers = [
    { offset: 0, amp: 0.35, hueShift: 0, alpha: 0.7, lineW: 3 },
    { offset: 0.15, amp: 0.25, hueShift: 60, alpha: 0.5, lineW: 2 },
    { offset: 0.3, amp: 0.18, hueShift: 120, alpha: 0.35, lineW: 1.5 },
  ];

  for (const layer of layers) {
    const step = Math.max(1, Math.floor(data.length / W));
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const idx = Math.min(data.length - 1, Math.floor((x / W) * data.length * 0.8 + data.length * layer.offset));
      const val = data[idx] / 255;
      const wave = Math.sin(x * 0.015 + t * 2 + layer.offset * 10) * 20;
      const y = H * 0.5 + wave - val * H * layer.amp + bass * 30;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const hue = (hueBase + layer.hueShift) % 360;
    ctx.strokeStyle = `hsla(${hue}, 85%, 60%, ${layer.alpha})`;
    ctx.lineWidth = layer.lineW + beat * 2;
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = `hsla(${hue}, 80%, 40%, ${layer.alpha * 0.08})`;
    ctx.fill();
  }
}

// ===== DRAW: GALAXY =====
function drawGalaxy(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, stars) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;

  // Starfield
  for (const s of stars) {
    s.twinkle += s.speed * 0.03;
    // Slow rotation
    const a = Math.atan2(s.y - cy, s.x - cx) + 0.0005;
    const d = Math.sqrt((s.x - cx) ** 2 + (s.y - cy) ** 2);
    s.x = cx + Math.cos(a) * d; s.y = cy + Math.sin(a) * d;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(s.twinkle) * 0.3})`; ctx.fill();
  }

  // Central core
  const coreR = 30 + bass * 50 + beat * 20;
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  cg.addColorStop(0, `hsla(${hueBase}, 90%, 80%, ${0.5 + beat * 0.3})`);
  cg.addColorStop(0.4, `hsla(${(hueBase + 30) % 360}, 80%, 50%, 0.15)`);
  cg.addColorStop(1, 'transparent');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();

  // Spiral arms
  if (data) {
    const arms = 3;
    for (let arm = 0; arm < arms; arm++) {
      const baseAngle = (arm / arms) * Math.PI * 2 + t * 0.15;
      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const angle = baseAngle + i * 0.06;
        const idx = Math.min(data.length - 1, Math.floor((i / 200) * data.length * 0.6));
        const val = data[idx] / 255;
        const r = 40 + i * 1.8 + val * 40 + bass * 20;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const hue = (hueBase + arm * 120 + i * 0.8) % 360;
        const size = 1 + val * 3 + beat;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 85%, 65%, ${0.15 + val * 0.5})`; ctx.fill();
      }
    }
  }

  // Orbiting ring
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + t * 0.3;
    const r = 120 + mid * 60;
    const ox = cx + Math.cos(a) * r, oy = cy + Math.sin(a) * r;
    ctx.beginPath(); ctx.arc(ox, oy, 2 + treble * 4, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(hueBase + i * 18) % 360}, 90%, 70%, 0.5)`; ctx.fill();
  }
}

// ===== DRAW: EARTH =====
function drawEarth(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, stars, earthState) {
  const cx = W / 2, cy = H / 2;
  const baseR = Math.min(W, H) * 0.28;
  const R = baseR + bass * 6 + beat * 4; // Earth breathes with bass

  ctx.clearRect(0, 0, W, H);

  // Nebula clouds in background - react to frequency data
  if (data) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < 3; n++) {
      const nx = W * (0.15 + n * 0.35) + Math.sin(t * 0.1 + n * 2) * 50;
      const ny = H * (0.2 + n * 0.25) + Math.cos(t * 0.08 + n) * 40;
      const nR = 80 + energy * 60 + bass * 40;
      const nHue = (hueBase + n * 120) % 360;
      const nebulaGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nR);
      nebulaGrad.addColorStop(0, `hsla(${nHue}, 60%, 40%, ${0.02 + energy * 0.03})`);
      nebulaGrad.addColorStop(0.5, `hsla(${nHue + 30}, 50%, 30%, ${0.01 + mid * 0.015})`);
      nebulaGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = nebulaGrad;
      ctx.beginPath(); ctx.arc(nx, ny, nR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Stars - react to treble, shoot on beats
  for (const s of stars) {
    s.twinkle += s.speed * 0.02;
    const bright = 0.1 + Math.sin(s.twinkle) * 0.2 + treble * 0.4 + (beat > 0.5 ? 0.3 : 0);
    const sz = s.size * (0.7 + treble * 0.8 + beat * 0.3);
    ctx.beginPath();
    ctx.arc(s.x, s.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 210, 255, ${Math.max(0, Math.min(1, bright))})`;
    ctx.fill();
    // Cross sparkle on bright stars
    if (bright > 0.5 && s.size > 1) {
      ctx.strokeStyle = `rgba(200, 220, 255, ${(bright - 0.5) * 0.3})`;
      ctx.lineWidth = 0.5;
      const sparkLen = sz * 3;
      ctx.beginPath(); ctx.moveTo(s.x - sparkLen, s.y); ctx.lineTo(s.x + sparkLen, s.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, s.y - sparkLen); ctx.lineTo(s.x, s.y + sparkLen); ctx.stroke();
    }
  }

  // Shooting stars on strong beats
  if (!earthState.shootingStars) earthState.shootingStars = [];
  if (beat > 0.6 && Math.random() > 0.5) {
    earthState.shootingStars.push({
      x: Math.random() * W, y: Math.random() * H * 0.4,
      vx: 4 + Math.random() * 6, vy: 2 + Math.random() * 3,
      life: 1.0, len: 20 + Math.random() * 30,
    });
  }
  for (let i = earthState.shootingStars.length - 1; i >= 0; i--) {
    const ss = earthState.shootingStars[i];
    ss.x += ss.vx; ss.y += ss.vy; ss.life -= 0.03;
    if (ss.life <= 0) { earthState.shootingStars.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.moveTo(ss.x, ss.y); ctx.lineTo(ss.x - ss.vx * ss.len * 0.15, ss.y - ss.vy * ss.len * 0.15);
    ctx.strokeStyle = `rgba(220, 240, 255, ${ss.life * 0.6})`;
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${ss.life * 0.8})`; ctx.fill();
  }

  // Atmospheric glow layers - breathe heavily with bass
  for (let layer = 5; layer >= 0; layer--) {
    const glowR = R + 25 + layer * 20 + bass * 30 + beat * 20 + energy * 10;
    const glow = ctx.createRadialGradient(cx, cy, R - 5, cx, cy, glowR);
    const breathe = 0.02 + energy * 0.04 + (layer < 2 ? beat * 0.06 : 0) + bass * 0.02;
    const glowHue = layer < 2 ? 220 : (layer < 4 ? 200 + mid * 40 : 160 + treble * 60);
    glow.addColorStop(0, `hsla(${glowHue}, 70%, 55%, ${breathe})`);
    glow.addColorStop(0.5, `hsla(${glowHue + 20}, 60%, 40%, ${breathe * 0.4})`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();
  }

  // Earth sphere base - ocean color shifts with music
  const oceanHue = 210 + bass * 15;
  const earthGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
  earthGrad.addColorStop(0, `hsla(${oceanHue}, 60%, 25%, ${0.9 + bass * 0.1})`);
  earthGrad.addColorStop(0.4, `hsla(${oceanHue - 10}, 55%, 15%, 0.95)`);
  earthGrad.addColorStop(0.8, `hsla(${oceanHue - 20}, 50%, 8%, 0.98)`);
  earthGrad.addColorStop(1, 'rgba(2, 5, 15, 1)');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = earthGrad; ctx.fill();

  // Continental landmasses - rotate
  const rotation = t * 0.08;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, Math.PI * 2); ctx.clip();

  // Generate continents once
  if (!earthState.continents) {
    earthState.continents = [];
    for (let c = 0; c < 7; c++) {
      const pts = [];
      const cAngle = (c / 7) * Math.PI * 2 + Math.random() * 0.5;
      const cDist = R * (0.2 + Math.random() * 0.5);
      const cSize = R * (0.15 + Math.random() * 0.2);
      for (let p = 0; p < 12; p++) {
        const a = (p / 12) * Math.PI * 2;
        const wobble = cSize * (0.6 + Math.random() * 0.8);
        pts.push({ a, r: wobble });
      }
      earthState.continents.push({ angle: cAngle, dist: cDist, pts, lat: (Math.random() - 0.5) * R * 0.8 });
    }
  }

  // Draw continents with REACTIVE city lights
  for (const cont of earthState.continents) {
    const contX = cx + Math.cos(cont.angle + rotation) * cont.dist;
    const contY = cy + cont.lat;

    const dx = contX - cx, dy = contY - cy;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    if (distFromCenter > R * 0.9) continue;
    const visibility = 1 - (distFromCenter / R);

    // Land mass
    ctx.beginPath();
    for (let i = 0; i <= cont.pts.length; i++) {
      const pt = cont.pts[i % cont.pts.length];
      const px = contX + Math.cos(pt.a) * pt.r;
      const py = contY + Math.sin(pt.a) * pt.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(12, 30, 18, ${0.5 * visibility})`;
    ctx.fill();

    // City lights - MORE of them, reacting heavily
    const lightCount = 6 + Math.floor(bass * 16 + energy * 8);
    for (let i = 0; i < lightCount; i++) {
      const pt = cont.pts[i % cont.pts.length];
      const scatter = 0.4 + Math.random() * 0.5;
      const lx = contX + Math.cos(pt.a + i * 0.5) * pt.r * scatter;
      const ly = contY + Math.sin(pt.a + i * 0.3) * pt.r * scatter;

      // Color shifts dramatically: warm on calm, electric on drops
      const lightHue = beat > 0.4 ? (hueBase + 200 + beat * 60) % 360 : 35 + mid * 25;
      const lightBright = 0.25 + bass * 0.6 + beat * 0.5 + energy * 0.2;
      const lightSize = 0.8 + bass * 3 + beat * 2;

      // Wide city glow
      ctx.beginPath(); ctx.arc(lx, ly, lightSize * 5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${lightHue}, 80%, 70%, ${lightBright * 0.08 * visibility})`;
      ctx.fill();
      // City glow
      ctx.beginPath(); ctx.arc(lx, ly, lightSize * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${lightHue}, 85%, 75%, ${lightBright * 0.15 * visibility})`;
      ctx.fill();
      // City point
      ctx.beginPath(); ctx.arc(lx, ly, lightSize, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${lightHue}, 90%, 85%, ${Math.min(1, lightBright * visibility)})`;
      ctx.fill();
    }

    // Lightning/power grid lines between nearby cities on strong beats
    if (beat > 0.5 && visibility > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const pt1 = cont.pts[i % cont.pts.length];
        const pt2 = cont.pts[(i + 2) % cont.pts.length];
        const x1 = contX + Math.cos(pt1.a) * pt1.r * 0.5;
        const y1 = contY + Math.sin(pt1.a) * pt1.r * 0.5;
        const x2 = contX + Math.cos(pt2.a) * pt2.r * 0.5;
        const y2 = contY + Math.sin(pt2.a) * pt2.r * 0.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsla(${hueBase + 200}, 80%, 70%, ${beat * 0.15 * visibility})`;
        ctx.lineWidth = 0.5 + beat; ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.restore();

  // Sphere rim light - stronger reaction
  const rimGrad = ctx.createRadialGradient(cx + R * 0.4, cy - R * 0.3, R * 0.5, cx, cy, R);
  rimGrad.addColorStop(0, 'transparent');
  rimGrad.addColorStop(0.8, 'transparent');
  rimGrad.addColorStop(0.92, `hsla(${210 + bass * 20}, 70%, 65%, ${0.12 + energy * 0.15 + beat * 0.1})`);
  rimGrad.addColorStop(1, `hsla(${220 + mid * 15}, 60%, 70%, ${0.06 + bass * 0.08})`);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad; ctx.fill();

  // Aurora borealis ribbons - much more reactive
  if (data) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let ribbon = 0; ribbon < 4; ribbon++) {
      const ribbonY = cy - R * (0.55 + ribbon * 0.12);
      const ribbonHue = [140, 170, 280, 320][ribbon];
      const ribbonAlpha = 0.06 + mid * 0.2 + (ribbon < 2 ? treble * 0.15 : bass * 0.1) + beat * 0.08;

      ctx.beginPath();
      for (let x = cx - R * 1.3; x <= cx + R * 1.3; x += 2) {
        const idx = Math.floor(((x - cx + R * 1.3) / (R * 2.6)) * (data.length * 0.5));
        const val = data[Math.min(data.length - 1, Math.abs(idx))] / 255;
        const waveY = ribbonY + Math.sin(x * 0.02 + t * 1.5 + ribbon) * (12 + val * 40 + bass * 15)
          + Math.sin(x * 0.008 + t * 0.7) * (15 + energy * 15);
        const dFromCenter = Math.sqrt((x - cx) ** 2 + (waveY - cy) ** 2);
        if (dFromCenter > R * 1.15) continue;
        x === cx - R * 1.3 ? ctx.moveTo(x, waveY) : ctx.lineTo(x, waveY);
      }
      ctx.strokeStyle = `hsla(${ribbonHue + treble * 40}, 85%, 65%, ${ribbonAlpha})`;
      ctx.lineWidth = 2 + mid * 6 + beat * 4;
      ctx.shadowColor = `hsla(${ribbonHue}, 90%, 60%, ${0.3 + energy * 0.3})`;
      ctx.shadowBlur = 15 + beat * 20 + energy * 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  // Orbiting particles - speed up with energy
  for (let i = 0; i < 16; i++) {
    const orbitR = R + 30 + i * 7 + Math.sin(t + i * 2) * (8 + energy * 12);
    const orbitSpeed = 0.12 + i * 0.025 + energy * 0.08;
    const a = t * orbitSpeed + (i / 16) * Math.PI * 2;
    const sx = cx + Math.cos(a) * orbitR;
    const sy = cy + Math.sin(a) * orbitR * 0.35;
    const satSize = 0.8 + treble * 2.5 + beat * 1;

    // Trail
    for (let tr = 0; tr < 6; tr++) {
      const ta = a - tr * 0.025;
      const tx = cx + Math.cos(ta) * orbitR;
      const ty = cy + Math.sin(ta) * orbitR * 0.35;
      ctx.beginPath(); ctx.arc(tx, ty, satSize * (1 - tr * 0.14), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(hueBase + i * 20) % 360}, 60%, 75%, ${0.12 - tr * 0.02})`; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(sx, sy, satSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 230, 255, ${0.5 + energy * 0.4})`; ctx.fill();
  }

  // Multiple expanding pulse rings on beats
  if (!earthState.pulseRings) earthState.pulseRings = [];
  if (beat > 0.35) {
    earthState.pulseRings.push({ radius: R + 5, alpha: 0.2 + beat * 0.2, hue: hueBase });
  }
  for (let i = earthState.pulseRings.length - 1; i >= 0; i--) {
    const ring = earthState.pulseRings[i];
    ring.radius += 2.5 + energy * 2;
    ring.alpha *= 0.96;
    if (ring.alpha < 0.01) { earthState.pulseRings.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${ring.hue + 200}, 70%, 60%, ${ring.alpha})`;
    ctx.lineWidth = 1.5 + ring.alpha * 4; ctx.stroke();
  }

  // Sun / lens flare - reacts more dramatically
  const sunX = cx + R * 1.5, sunY = cy - R * 0.3;
  const flareR = 25 + bass * 25 + beat * 15 + energy * 10;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const flareGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, flareR);
  flareGrad.addColorStop(0, `rgba(255, 250, 230, ${0.15 + energy * 0.15})`);
  flareGrad.addColorStop(0.2, `rgba(255, 220, 150, ${0.08 + bass * 0.06})`);
  flareGrad.addColorStop(0.5, `rgba(255, 180, 80, ${0.02 + energy * 0.02})`);
  flareGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = flareGrad; ctx.beginPath(); ctx.arc(sunX, sunY, flareR, 0, Math.PI * 2); ctx.fill();

  // Sun rays - rotate and scale with music
  for (let ray = 0; ray < 8; ray++) {
    const rayAngle = ray * (Math.PI / 4) + t * 0.06 + Math.sin(t * 0.3) * 0.1;
    const rayLen = 40 + mid * 60 + bass * 30 + beat * 20;
    ctx.beginPath(); ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(rayAngle) * rayLen, sunY + Math.sin(rayAngle) * rayLen);
    ctx.strokeStyle = `rgba(255, 220, 150, ${0.03 + energy * 0.04 + beat * 0.02})`;
    ctx.lineWidth = 1 + energy; ctx.stroke();
  }

  // Lens flare artifacts along a line from sun through center
  const flareAngle = Math.atan2(cy - sunY, cx - sunX);
  for (let f = 0; f < 4; f++) {
    const fd = 80 + f * 70;
    const fx = sunX + Math.cos(flareAngle) * fd;
    const fy = sunY + Math.sin(flareAngle) * fd;
    const fr = 5 + f * 3 + energy * 4;
    const fHue = [40, 200, 280, 140][f];
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${fHue}, 80%, 70%, ${0.03 + energy * 0.03})`; ctx.fill();
  }
  ctx.restore();

  // Frequency ring around earth - visible EQ response
  if (data) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ringR = R + 15 + energy * 8;
    ctx.beginPath();
    for (let i = 0; i < data.length * 0.6; i++) {
      const angle = (i / (data.length * 0.6)) * Math.PI * 2 - Math.PI / 2;
      const val = data[i] / 255;
      const r = ringR + val * 25 * energy;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `hsla(${hueBase + 200}, 70%, 60%, ${0.06 + energy * 0.08})`;
    ctx.lineWidth = 1.5 + energy * 2; ctx.stroke();
    ctx.restore();
  }
}

// ===== DRAW: CITY SKYLINE =====
function drawCity(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, cityState) {
  ctx.clearRect(0, 0, W, H);

  const groundY = H * 0.62;

  // Sky gradient - color shifts with energy
  const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  skyGrad.addColorStop(0, `rgba(5, 3, ${20 + Math.floor(bass * 15)}, 0.3)`);
  skyGrad.addColorStop(0.5, `hsla(${(hueBase + 240) % 360}, 30%, 5%, ${0.05 + energy * 0.08})`);
  skyGrad.addColorStop(1, `rgba(15, 8, 40, ${0.1 + bass * 0.1})`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, groundY);

  // Stars - twinkle harder with treble
  if (!cityState.stars) {
    cityState.stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.45,
      size: Math.random() * 1.5 + 0.2, phase: Math.random() * Math.PI * 2,
    }));
  }
  for (const s of cityState.stars) {
    const flicker = 0.15 + Math.sin(t * 2 + s.phase) * 0.15 + treble * 0.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (1 + treble * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flicker)})`; ctx.fill();
  }

  // Moon - pulses with bass
  const moonX = W * 0.82, moonY = H * 0.12, moonR = 22 + bass * 12;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 4);
  moonGlow.addColorStop(0, `rgba(255, 250, 230, ${0.25 + energy * 0.15})`);
  moonGlow.addColorStop(0.2, `hsla(${hueBase}, 40%, 80%, ${0.06 + bass * 0.06})`);
  moonGlow.addColorStop(0.5, `rgba(200, 180, 255, 0.03)`);
  moonGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(240, 235, 220, ${0.7 + bass * 0.3})`; ctx.fill();

  // Searchlight beams from tall buildings - sweep with music
  if (!cityState.searchlights) {
    cityState.searchlights = [
      { x: W * 0.15, phase: 0 },
      { x: W * 0.55, phase: 2 },
      { x: W * 0.85, phase: 4 },
    ];
  }
  if (energy > 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sl of cityState.searchlights) {
      const angle = Math.sin(t * 0.4 + sl.phase) * 0.5 + mid * 0.3;
      const beamLen = H * 0.8;
      const baseY = groundY - 20;
      const endX = sl.x + Math.sin(angle) * beamLen;
      const endY = baseY - Math.cos(angle) * beamLen;
      const beamGrad = ctx.createLinearGradient(sl.x, baseY, endX, endY);
      beamGrad.addColorStop(0, `hsla(${hueBase}, 60%, 80%, ${0.04 + energy * 0.06})`);
      beamGrad.addColorStop(0.5, `hsla(${hueBase}, 50%, 70%, ${0.01 + energy * 0.02})`);
      beamGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.moveTo(sl.x - 3, baseY); ctx.lineTo(endX - 30, endY); ctx.lineTo(endX + 30, endY); ctx.lineTo(sl.x + 3, baseY);
      ctx.fillStyle = beamGrad; ctx.fill();
    }
    ctx.restore();
  }

  // Generate buildings once
  if (!cityState.buildings) {
    cityState.buildings = [];
    let x = 0;
    while (x < W + 60) {
      const w = 22 + Math.random() * 55;
      const h = 50 + Math.random() * 220;
      const windows = [];
      for (let wy = 10; wy < h - 10; wy += 11) {
        for (let wx = 4; wx < w - 4; wx += 7) {
          if (Math.random() > 0.25) windows.push({ x: wx, y: wy, lit: Math.random() > 0.35, hue: Math.random() * 60 + 20 });
        }
      }
      // Some buildings have neon strips on the side
      const hasNeon = Math.random() > 0.6;
      const neonSide = Math.random() > 0.5 ? 'left' : 'right';
      const neonHue = Math.random() * 360;
      // Some tall buildings have billboard screens
      const hasBillboard = h > 120 && Math.random() > 0.5;
      const billboardY = 0.2 + Math.random() * 0.3;
      cityState.buildings.push({ x, w, h, windows, hue: Math.random() * 30 + 220, hasNeon, neonSide, neonHue, hasBillboard, billboardY });
      x += w + 2 + Math.random() * 4;
    }
  }

  // Init cars
  if (!cityState.cars) {
    cityState.cars = Array.from({ length: 8 }, () => ({
      x: Math.random() * W, lane: Math.random() > 0.5 ? 0 : 1,
      speed: 0.5 + Math.random() * 1.5, hue: Math.random() * 360,
      tailLen: 15 + Math.random() * 25,
    }));
  }

  // Draw buildings
  for (const b of cityState.buildings) {
    const bassLift = bass * 8 * (b.h / 250); // taller buildings react more
    const bh = b.h + bassLift;
    const bx = b.x, by = groundY - bh;

    // Building body
    const bGrad = ctx.createLinearGradient(bx, by, bx, groundY);
    bGrad.addColorStop(0, `rgba(18, 16, 32, 0.95)`);
    bGrad.addColorStop(1, `rgba(10, 8, 22, 0.98)`);
    ctx.fillStyle = bGrad;
    ctx.fillRect(bx, by, b.w, bh);

    // Edge highlights - glow with energy
    ctx.fillStyle = `rgba(80, 65, 130, ${0.1 + energy * 0.15})`;
    ctx.fillRect(bx, by, 1, bh);
    ctx.fillRect(bx + b.w - 1, by, 1, bh);
    // Top edge
    ctx.fillStyle = `rgba(100, 80, 160, ${0.08 + energy * 0.12})`;
    ctx.fillRect(bx, by, b.w, 1);

    // Neon strip running up the building edge - reacts to mid frequencies
    if (b.hasNeon) {
      const stripX = b.neonSide === 'left' ? bx + 1 : bx + b.w - 3;
      const neonH = bh * (0.3 + mid * 0.7); // height grows with mids
      const neonGrad = ctx.createLinearGradient(stripX, groundY, stripX, groundY - neonH);
      neonGrad.addColorStop(0, `hsla(${(b.neonHue + hueBase) % 360}, 100%, 60%, ${0.6 + energy * 0.4})`);
      neonGrad.addColorStop(0.7, `hsla(${(b.neonHue + hueBase + 30) % 360}, 90%, 50%, ${0.2 + mid * 0.3})`);
      neonGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = neonGrad;
      ctx.fillRect(stripX, groundY - neonH, 2, neonH);
      // Neon glow
      ctx.fillStyle = `hsla(${(b.neonHue + hueBase) % 360}, 100%, 60%, ${0.03 + energy * 0.04})`;
      ctx.fillRect(stripX - 6, groundY - neonH, 14, neonH);
    }

    // Billboard screen - shows reactive color bars
    if (b.hasBillboard && data) {
      const bbW = b.w * 0.7;
      const bbH = 16 + mid * 8;
      const bbX = bx + (b.w - bbW) / 2;
      const bbY = by + bh * b.billboardY;
      // Screen background
      ctx.fillStyle = `rgba(0, 0, 0, 0.8)`;
      ctx.fillRect(bbX - 1, bbY - 1, bbW + 2, bbH + 2);
      // Frequency bars inside the billboard
      const barCount = Math.floor(bbW / 3);
      for (let bi = 0; bi < barCount; bi++) {
        const di = Math.floor((bi / barCount) * (data.length * 0.5));
        const val = (data[di] || 0) / 255;
        const barH = val * bbH;
        const barHue = (hueBase + bi * 8) % 360;
        ctx.fillStyle = `hsla(${barHue}, 90%, 60%, ${0.6 + val * 0.4})`;
        ctx.fillRect(bbX + bi * 3, bbY + bbH - barH, 2, barH);
      }
    }

    // Windows -- react to music more intensely
    for (const win of b.windows) {
      if (!win.lit && Math.random() > (0.992 - beat * 0.01)) win.lit = true;
      if (win.lit && Math.random() > (0.996 + energy * 0.002)) win.lit = false;
      // On strong beats, random windows flash on
      if (beat > 0.6 && Math.random() > 0.85) win.lit = true;

      if (win.lit || beat > 0.4) {
        const winBright = win.lit ? 0.35 + bass * 0.5 + beat * 0.4 : beat * 0.4;
        const winHue = beat > 0.3 ? (hueBase + win.hue + t * 10) % 360 : win.hue + mid * 30;
        // Window glow
        ctx.fillStyle = `hsla(${winHue}, 70%, 70%, ${winBright * 0.25})`;
        ctx.fillRect(bx + win.x - 2, by + win.y - 2, 9, 9);
        // Window
        ctx.fillStyle = `hsla(${winHue}, 80%, 75%, ${Math.min(1, winBright)})`;
        ctx.fillRect(bx + win.x, by + win.y, 5, 5);
      }
    }

    // Rooftop light + antenna
    if (b.h > 130) {
      // Antenna
      ctx.fillStyle = `rgba(60, 50, 80, 0.6)`;
      ctx.fillRect(bx + b.w / 2 - 0.5, by - 12, 1, 12);
      const blink = Math.sin(t * 3 + b.x) > 0.7;
      if (blink) {
        ctx.beginPath(); ctx.arc(bx + b.w / 2, by - 12, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 40, 40, ${0.7 + bass * 0.3})`; ctx.fill();
        ctx.beginPath(); ctx.arc(bx + b.w / 2, by - 12, 8 + bass * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 40, 40, ${0.08 + bass * 0.06})`; ctx.fill();
      }
    }
  }

  // Neon signs on beat drops - more intense
  if (beat > 0.3 && data) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const b = cityState.buildings[Math.floor(Math.random() * cityState.buildings.length)];
      if (!b) continue;
      const nx = b.x + b.w / 2, ny = groundY - b.h * (0.2 + Math.random() * 0.5);
      const neonHue = (hueBase + i * 45) % 360;
      const r = 6 + beat * 10 + energy * 5;
      ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${neonHue}, 100%, 60%, ${beat * 0.15})`; ctx.fill();
      // Neon glow halo
      ctx.beginPath(); ctx.arc(nx, ny, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${neonHue}, 90%, 50%, ${beat * 0.04})`; ctx.fill();
    }
    ctx.restore();
  }

  // Ground / road
  ctx.fillStyle = 'rgba(6, 4, 14, 0.95)';
  ctx.fillRect(0, groundY, W, H - groundY);

  // Road markings
  const roadCenterY = groundY + (H - groundY) * 0.45;
  ctx.setLineDash([20, 15]);
  ctx.strokeStyle = `rgba(80, 70, 60, ${0.15 + energy * 0.1})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, roadCenterY); ctx.lineTo(W, roadCenterY); ctx.stroke();
  ctx.setLineDash([]);

  // Cars with headlights + taillights
  const carY1 = groundY + (H - groundY) * 0.3;
  const carY2 = groundY + (H - groundY) * 0.6;
  for (const car of cityState.cars) {
    const speedMult = 1 + bass * 2 + beat * 3; // cars speed up with bass/beats
    if (car.lane === 0) {
      car.x += car.speed * speedMult;
      if (car.x > W + 50) car.x = -50;
    } else {
      car.x -= car.speed * speedMult;
      if (car.x < -50) car.x = W + 50;
    }
    const cy = car.lane === 0 ? carY1 : carY2;

    // Headlight beams
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beamDir = car.lane === 0 ? 1 : -1;
    const beamGrad = ctx.createLinearGradient(car.x, cy, car.x + beamDir * (60 + energy * 40), cy);
    beamGrad.addColorStop(0, `rgba(255, 250, 220, ${0.15 + energy * 0.1})`);
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(car.x, cy - 2, beamDir * (60 + energy * 40), 4);

    // Headlight point
    ctx.beginPath(); ctx.arc(car.x, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 250, 230, 0.9)`; ctx.fill();

    // Taillight
    ctx.beginPath(); ctx.arc(car.x - beamDir * 8, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 30, 30, 0.7)`; ctx.fill();
    // Taillight trail
    const tailGrad = ctx.createLinearGradient(car.x - beamDir * 8, cy, car.x - beamDir * (8 + car.tailLen), cy);
    tailGrad.addColorStop(0, `rgba(255, 30, 30, 0.2)`);
    tailGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = tailGrad;
    ctx.fillRect(car.x - beamDir * 8, cy - 1.5, -beamDir * car.tailLen, 3);
    ctx.restore();
  }

  // Wet road reflections - mirrored building lights
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (data) {
    for (let i = 0; i < 60; i++) {
      const rx = Math.random() * W;
      const val = data[Math.floor(Math.random() * data.length)] / 255;
      const ry = groundY + 5 + Math.random() * (H - groundY - 10);
      const rHue = (hueBase + i * 6) % 360;
      const streakLen = 20 + val * 30;
      ctx.fillStyle = `hsla(${rHue}, 70%, 60%, ${val * 0.05 + energy * 0.02})`;
      ctx.fillRect(rx - streakLen / 2, ry, streakLen, 1);
    }
  }
  ctx.restore();

  // Bass shockwave on road - ripple effect on heavy beats
  if (beat > 0.5) {
    if (!cityState.shockwave || cityState.shockwave.alpha <= 0) {
      cityState.shockwave = { radius: 0, alpha: 0.3 + beat * 0.2, cx: W / 2, cy: groundY + 20 };
    }
  }
  if (cityState.shockwave && cityState.shockwave.alpha > 0) {
    const sw = cityState.shockwave;
    sw.radius += 8 + energy * 6;
    sw.alpha *= 0.94;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.ellipse(sw.cx, sw.cy, sw.radius, sw.radius * 0.15, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hueBase}, 80%, 60%, ${sw.alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (sw.alpha < 0.01) cityState.shockwave = null;
  }

  // Lightning bolts on heavy beats
  if (!cityState.lightning) cityState.lightning = [];
  if (beat > 0.7 && Math.random() > 0.4) {
    const lx = Math.random() * W;
    cityState.lightning.push({ x: lx, alpha: 1.0, segments: [] });
    const segs = cityState.lightning[cityState.lightning.length - 1].segments;
    let ly = 0;
    while (ly < groundY) {
      const nx = lx + (Math.random() - 0.5) * 60;
      const ny = ly + 15 + Math.random() * 30;
      segs.push({ x1: lx + (segs.length ? segs[segs.length-1].x2 - lx : 0), y1: ly, x2: nx, y2: ny });
      ly = ny;
    }
  }
  for (let li = cityState.lightning.length - 1; li >= 0; li--) {
    const l = cityState.lightning[li];
    l.alpha *= 0.85;
    if (l.alpha < 0.02) { cityState.lightning.splice(li, 1); continue; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(200, 180, 255, ${l.alpha * 0.8})`;
    ctx.lineWidth = 2 + l.alpha * 2;
    ctx.shadowColor = `rgba(139, 92, 246, ${l.alpha})`;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (const seg of l.segments) {
      ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Flash the whole sky
    if (l.alpha > 0.6) {
      ctx.fillStyle = `rgba(200, 180, 255, ${l.alpha * 0.03})`;
      ctx.fillRect(0, 0, W, groundY);
    }
    ctx.restore();
  }

  // Rain particles - intensity based on treble + energy
  if (!cityState.rain) cityState.rain = Array.from({ length: 60 }, () => ({
    x: Math.random() * W * 1.2, y: Math.random() * H, speed: 3 + Math.random() * 5, len: 8 + Math.random() * 12,
  }));
  const rainIntensity = treble * 0.6 + energy * 0.3;
  if (rainIntensity > 0.15) {
    ctx.save();
    ctx.strokeStyle = `rgba(150, 170, 220, ${rainIntensity * 0.15})`;
    ctx.lineWidth = 0.8;
    for (const r of cityState.rain) {
      r.y += r.speed * (1 + energy * 2);
      r.x -= 1.5;
      if (r.y > H) { r.y = -r.len; r.x = Math.random() * W * 1.2; }
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 1.5, r.y + r.len); ctx.stroke();
    }
    ctx.restore();
  }

  // Pulsing sky aurora / northern lights band
  if (data && energy > 0.2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let a = 0; a < 2; a++) {
      const auroraY = H * (0.08 + a * 0.12);
      ctx.beginPath();
      for (let x = 0; x < W; x += 3) {
        const di = Math.floor((x / W) * data.length * 0.4);
        const val = (data[di] || 0) / 255;
        const y = auroraY + Math.sin(x * 0.008 + t * 0.5 + a) * (10 + val * 25 + bass * 15);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const aHue = (hueBase + 120 + a * 60) % 360;
      ctx.strokeStyle = `hsla(${aHue}, 80%, 55%, ${0.04 + energy * 0.06})`;
      ctx.lineWidth = 3 + mid * 5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Atmospheric haze between buildings and sky
  const hazeGrad = ctx.createLinearGradient(0, groundY - 40, 0, groundY + 10);
  hazeGrad.addColorStop(0, 'transparent');
  hazeGrad.addColorStop(0.5, `hsla(${hueBase}, 40%, 30%, ${0.04 + energy * 0.06})`);
  hazeGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, groundY - 40, W, 50);

  // Beat flash across entire scene - more intense
  if (beat > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(${hueBase}, 70%, 50%, ${beat * 0.06})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Frequency bars along the bottom edge like an EQ reflection on the road
  if (data) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const barCount = 64;
    const barW = W / barCount;
    for (let i = 0; i < barCount; i++) {
      const di = Math.floor((i / barCount) * data.length * 0.6);
      const val = (data[di] || 0) / 255;
      const barH = val * 25 * energy;
      if (barH < 1) continue;
      const barHue = (hueBase + i * 4) % 360;
      ctx.fillStyle = `hsla(${barHue}, 80%, 55%, ${val * 0.12})`;
      ctx.fillRect(i * barW, H - barH, barW - 1, barH);
    }
    ctx.restore();
  }
}

// ===== DRAW: NORTHERN LIGHTS =====
function drawAurora(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, stars) {
  ctx.clearRect(0, 0, W, H);

  // Horizon glow
  const horizY = H * 0.85;
  const horizGrad = ctx.createLinearGradient(0, horizY - 60, 0, H);
  horizGrad.addColorStop(0, 'transparent');
  horizGrad.addColorStop(0.5, `rgba(10, 15, 30, 0.15)`);
  horizGrad.addColorStop(1, `rgba(5, 8, 20, 0.3)`);
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, horizY - 60, W, H - horizY + 60);

  // Stars
  for (const s of stars) {
    s.twinkle += s.speed * 0.015;
    const bright = 0.1 + Math.sin(s.twinkle) * 0.2 + treble * 0.15;
    if (s.y > horizY) continue;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 230, 255, ${Math.max(0, bright)})`; ctx.fill();
  }

  // Aurora curtains - THE MAIN EVENT
  const curtainCount = 5;
  for (let c = 0; c < curtainCount; c++) {
    const baseY = H * (0.15 + c * 0.08);
    const curtainHue = c === 0 ? 130 : c === 1 ? 155 : c === 2 ? 100 : c === 3 ? 280 : 170;
    const speed = 0.3 + c * 0.1;
    const amplitude = 40 + mid * 60 + c * 10;

    // Each curtain is a filled shape with flowing top edge
    ctx.beginPath();
    const points = [];

    for (let x = -20; x <= W + 20; x += 4) {
      let y = baseY;
      // Layer multiple sine waves for organic movement
      y += Math.sin(x * 0.003 + t * speed) * amplitude;
      y += Math.sin(x * 0.008 + t * speed * 1.3 + c) * (amplitude * 0.5);
      y += Math.sin(x * 0.015 + t * speed * 0.7 + c * 2) * (amplitude * 0.3);

      // React to frequency data
      if (data) {
        const idx = Math.floor((x / W) * data.length * 0.6 + data.length * c * 0.05);
        const val = data[Math.min(data.length - 1, Math.abs(idx) % data.length)] / 255;
        y -= val * 50 * (1 + beat * 0.5);
      }

      points.push({ x, y });
      x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    // Close the shape downward for the curtain body
    ctx.lineTo(W + 20, baseY + 200);
    ctx.lineTo(-20, baseY + 200);
    ctx.closePath();

    // Curtain gradient - top bright, fades down. Bumped 2.5× because trails
    // are gone now (shapes don't build up over frames), need more per-frame density.
    const curtainGrad = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY + 200);
    const alpha = 0.12 + energy * 0.15 + (c === 0 ? beat * 0.08 : 0);
    curtainGrad.addColorStop(0, `hsla(${curtainHue + treble * 20}, 85%, 65%, ${alpha * 1.6})`);
    curtainGrad.addColorStop(0.3, `hsla(${curtainHue + 15}, 75%, 50%, ${alpha})`);
    curtainGrad.addColorStop(0.6, `hsla(${curtainHue + 30}, 60%, 35%, ${alpha * 0.5})`);
    curtainGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = curtainGrad;
    ctx.fill();

    // Bright edge along the top of the curtain
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      i === 0 ? ctx.moveTo(points[i].x, points[i].y) : ctx.lineTo(points[i].x, points[i].y);
    }
    const edgeAlpha = 0.25 + mid * 0.3 + beat * 0.2;
    ctx.strokeStyle = `hsla(${curtainHue}, 90%, 75%, ${edgeAlpha})`;
    ctx.lineWidth = 2.5 + beat * 3;
    ctx.shadowColor = `hsla(${curtainHue}, 85%, 70%, 0.5)`;
    ctx.shadowBlur = 14 + beat * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Vertical rays of light within the curtain
    if (data) {
      for (let r = 0; r < 20; r++) {
        const rx = W * (r / 20) + Math.sin(t * 0.5 + r) * 30;
        const idx = Math.floor((r / 20) * data.length * 0.4 + c * 30);
        const val = data[Math.min(data.length - 1, idx)] / 255;
        if (val < 0.15) continue;

        const rayTop = baseY - amplitude + Math.sin(rx * 0.01 + t * speed) * amplitude;
        const rayBot = rayTop + 80 + val * 100;
        const rayGrad = ctx.createLinearGradient(rx, rayTop, rx, rayBot);
        rayGrad.addColorStop(0, `hsla(${curtainHue + val * 30}, 85%, 70%, ${val * 0.06})`);
        rayGrad.addColorStop(0.5, `hsla(${curtainHue + 10}, 75%, 55%, ${val * 0.03})`);
        rayGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rayGrad;
        ctx.fillRect(rx - 3, rayTop, 6, rayBot - rayTop);
      }
    }
  }

  // Ground silhouette - mountains/treeline
  ctx.beginPath();
  ctx.moveTo(-10, horizY);
  for (let x = 0; x <= W; x += 8) {
    const mtn = Math.sin(x * 0.005) * 30 + Math.sin(x * 0.012 + 1) * 15 + Math.sin(x * 0.025) * 8;
    ctx.lineTo(x, horizY - 20 - Math.max(0, mtn));
  }
  ctx.lineTo(W + 10, horizY);
  ctx.lineTo(W + 10, H);
  ctx.lineTo(-10, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(3, 4, 8, 0.95)';
  ctx.fill();

  // Ground reflection of aurora (subtle)
  if (data) {
    const reflGrad = ctx.createLinearGradient(0, horizY, 0, H);
    reflGrad.addColorStop(0, `hsla(140, 60%, 40%, ${0.02 + energy * 0.02})`);
    reflGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = reflGrad;
    ctx.fillRect(0, horizY, W, H - horizY);
  }

  // Occasional shooting star on big beats
  if (beat > 0.7) {
    const sx = Math.random() * W * 0.8;
    const sy = Math.random() * H * 0.3;
    const len = 60 + beat * 40;
    const sGrad = ctx.createLinearGradient(sx, sy, sx + len, sy + len * 0.3);
    sGrad.addColorStop(0, `rgba(255, 255, 255, ${beat * 0.6})`);
    sGrad.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy + len * 0.3);
    ctx.strokeStyle = sGrad; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

// ===== DRAW: OCEAN (Tetris Effect Metamorphosis — constellation dolphins in space) =====
function drawOcean(ctx, W, H, t, data, bass, mid, treble, energy, beat, hueBase, oceanState) {
  if (!oceanState.init) {
    oceanState.init = true;
    // Starfield — dense, layered depths
    oceanState.stars = Array.from({ length: 300 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * 2 + 0.3,
      depth: 0.2 + Math.random() * 0.8, // parallax depth
      phase: Math.random() * Math.PI * 2,
      hue: 200 + Math.random() * 60,
    }));
    // Two dolphins — made of particle constellations
    oceanState.dolphins = [0, 1].map((_, i) => {
      // Dolphin body defined as constellation points (relative coords)
      const shape = [];
      // Body outline
      for (let a = 0; a < Math.PI * 2; a += 0.15) {
        const rx = Math.cos(a) * 1.2 * (1 + 0.3 * Math.cos(a * 2));
        const ry = Math.sin(a) * 0.45;
        shape.push({ ox: rx, oy: ry, bright: 0.5 + Math.random() * 0.5 });
      }
      // Nose
      shape.push({ ox: 1.5, oy: 0, bright: 1 });
      shape.push({ ox: 1.3, oy: -0.1, bright: 0.8 });
      shape.push({ ox: 1.3, oy: 0.1, bright: 0.8 });
      // Dorsal fin
      shape.push({ ox: 0.2, oy: -0.6, bright: 0.9 });
      shape.push({ ox: 0, oy: -0.8, bright: 1 });
      shape.push({ ox: -0.2, oy: -0.55, bright: 0.7 });
      // Tail
      shape.push({ ox: -1.4, oy: -0.35, bright: 0.9 });
      shape.push({ ox: -1.6, oy: -0.5, bright: 0.7 });
      shape.push({ ox: -1.4, oy: 0.35, bright: 0.9 });
      shape.push({ ox: -1.6, oy: 0.5, bright: 0.7 });
      // Internal sparkle points
      for (let j = 0; j < 15; j++) {
        shape.push({
          ox: (Math.random() - 0.3) * 2, oy: (Math.random() - 0.5) * 0.7,
          bright: 0.3 + Math.random() * 0.4,
        });
      }
      return {
        x: i === 0 ? W * 0.3 : W * 0.6,
        y: H * 0.4 + i * H * 0.15,
        vx: 0.8 + i * 0.3,
        phase: i * Math.PI * 0.7,
        size: 50 + i * 10,
        shape,
        trail: [],
        hue: i === 0 ? 30 : 200,
      };
    });
    oceanState.sparkles = [];
    oceanState.pulses = [];
  }

  ctx.clearRect(0, 0, W, H);

  // Subtle nebula glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const nx = W * (0.25 + i * 0.25) + Math.sin(t * 0.08 + i * 2) * 60;
    const ny = H * (0.35 + i * 0.15) + Math.cos(t * 0.06 + i) * 40;
    const nr = 150 + energy * 100;
    const nHue = (20 + i * 80 + hueBase * 0.1) % 360;
    const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    nGrad.addColorStop(0, `hsla(${nHue}, 60%, 40%, ${0.015 + energy * 0.02})`);
    nGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nGrad;
    ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Stars — parallax, twinkle with treble
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of oceanState.stars) {
    // Parallax movement — deeper stars move slower
    s.x -= 0.15 * s.depth * (1 + energy * 2);
    if (s.x < -5) { s.x = W + 5; s.y = Math.random() * H; }

    const twinkle = 0.2 + Math.sin(t * 3 + s.phase) * 0.15 + treble * 0.5 + beat * 0.2;
    const sz = s.size * (0.8 + energy * 0.6);

    // Glow
    ctx.beginPath(); ctx.arc(s.x, s.y, sz * 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${s.hue}, 60%, 80%, ${twinkle * 0.04})`;
    ctx.fill();
    // Core
    ctx.beginPath(); ctx.arc(s.x, s.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${s.hue}, 50%, 90%, ${Math.min(1, twinkle * 0.8)})`;
    ctx.fill();
    // Cross sparkle on bright stars
    if (s.size > 1.5 && twinkle > 0.5) {
      const sLen = sz * 3;
      ctx.strokeStyle = `hsla(${s.hue}, 50%, 85%, ${(twinkle - 0.4) * 0.15})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(s.x - sLen, s.y); ctx.lineTo(s.x + sLen, s.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, s.y - sLen); ctx.lineTo(s.x, s.y + sLen); ctx.stroke();
    }
  }
  ctx.restore();

  // Dolphins — constellation style, made of glowing particles connected by faint lines
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of oceanState.dolphins) {
    // Graceful swimming motion
    const swimY = Math.sin(t * 0.5 + d.phase) * 40 + Math.sin(t * 0.8 + d.phase * 2) * bass * 50;
    const swimX = Math.cos(t * 0.3 + d.phase) * 20;
    d.x += d.vx * (1 + energy * 1.5 + beat * 2);
    d.y += (swimY - (d.y - H * 0.45)) * 0.02;

    if (d.x > W + d.size * 2) { d.x = -d.size * 2; d.y = H * 0.3 + Math.random() * H * 0.35; }

    const angle = Math.sin(t * 0.5 + d.phase) * 0.15 + Math.sin(t * 0.8 + d.phase) * bass * 0.2;
    const sz = d.size + bass * 15 + beat * 8;
    const tailWave = Math.sin(t * 2.5 + d.phase) * 0.25 + bass * 0.15;

    // Trail of stardust
    d.trail.push({ x: d.x - Math.cos(angle) * sz * 0.8, y: d.y - Math.sin(angle) * sz * 0.3, alpha: 0.5 + energy * 0.3, hue: d.hue });
    if (d.trail.length > 40) d.trail.shift();

    for (let ti = 0; ti < d.trail.length; ti++) {
      const tp = d.trail[ti];
      const frac = ti / d.trail.length;
      tp.alpha *= 0.96;
      const tSz = 1 + frac * 2;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tSz, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${tp.hue + 20}, 70%, 70%, ${tp.alpha * frac * 0.12})`;
      ctx.fill();
    }

    // Constellation points — transform each shape point
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const points = d.shape.map(p => {
      let oy = p.oy;
      // Tail animation
      if (p.ox < -0.8) oy += tailWave * (Math.abs(p.ox) - 0.8);
      return {
        x: d.x + (p.ox * cosA - oy * sinA) * sz,
        y: d.y + (p.ox * sinA + oy * cosA) * sz,
        bright: p.bright,
      };
    });

    // Draw constellation lines between nearby points
    ctx.strokeStyle = `hsla(${d.hue + 20}, 60%, 65%, ${0.04 + energy * 0.06 + beat * 0.04})`;
    ctx.lineWidth = 0.5 + energy;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < sz * 0.6) {
          const lineAlpha = (1 - dist / (sz * 0.6)) * (0.06 + energy * 0.08);
          ctx.strokeStyle = `hsla(${d.hue + 20}, 60%, 70%, ${lineAlpha})`;
          ctx.beginPath(); ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[j].x, points[j].y); ctx.stroke();
        }
      }
    }

    // Draw constellation points (the dolphin's body made of stars)
    for (const pt of points) {
      const ptBright = pt.bright * (0.4 + energy * 0.6 + beat * 0.3);
      const ptSize = 1.5 + pt.bright * 2 + bass * 1.5;

      // Outer glow
      ctx.beginPath(); ctx.arc(pt.x, pt.y, ptSize * 4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${d.hue + 15}, 70%, 70%, ${ptBright * 0.06})`;
      ctx.fill();
      // Inner glow
      ctx.beginPath(); ctx.arc(pt.x, pt.y, ptSize * 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${d.hue + 10}, 75%, 75%, ${ptBright * 0.12})`;
      ctx.fill();
      // Core star
      ctx.beginPath(); ctx.arc(pt.x, pt.y, ptSize, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${d.hue}, 50%, 90%, ${Math.min(1, ptBright * 0.8)})`;
      ctx.fill();
    }

    // Overall dolphin glow aura
    const auraGrad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, sz * 1.8);
    auraGrad.addColorStop(0, `hsla(${d.hue + 10}, 70%, 60%, ${0.02 + energy * 0.03 + beat * 0.02})`);
    auraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrad;
    ctx.beginPath(); ctx.arc(d.x, d.y, sz * 1.8, 0, Math.PI * 2); ctx.fill();

    // Sparkle burst on beats
    if (beat > 0.4 && Math.random() > 0.4) {
      for (let sp = 0; sp < 5; sp++) {
        oceanState.sparkles.push({
          x: d.x + (Math.random() - 0.5) * sz * 1.5,
          y: d.y + (Math.random() - 0.5) * sz * 0.8,
          vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
          size: 1 + Math.random() * 2, alpha: 0.7 + Math.random() * 0.3,
          hue: d.hue + Math.random() * 40 - 20,
        });
      }
    }
  }
  ctx.restore();

  // Free-floating sparkle particles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = oceanState.sparkles.length - 1; i >= 0; i--) {
    const sp = oceanState.sparkles[i];
    sp.x += sp.vx * 0.8; sp.y += sp.vy * 0.8;
    sp.vx *= 0.97; sp.vy *= 0.97;
    sp.alpha *= 0.95;
    if (sp.alpha < 0.02) { oceanState.sparkles.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.size * 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${sp.hue}, 70%, 70%, ${sp.alpha * 0.1})`;
    ctx.fill();
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${sp.hue}, 60%, 90%, ${sp.alpha * 0.6})`;
    ctx.fill();
  }
  if (oceanState.sparkles.length > 200) oceanState.sparkles.splice(0, 50);
  ctx.restore();

  // Beat pulse rings expanding from center
  if (beat > 0.4) {
    oceanState.pulses.push({ r: 5, alpha: 0.15 + beat * 0.1, hue: hueBase + 20 });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = oceanState.pulses.length - 1; i >= 0; i--) {
    const p = oceanState.pulses[i];
    p.r += 3 + energy * 4;
    p.alpha *= 0.96;
    if (p.alpha < 0.01) { oceanState.pulses.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(W / 2, H / 2, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${p.hue}, 50%, 70%, ${p.alpha})`;
    ctx.lineWidth = 1 + p.alpha * 3;
    ctx.stroke();
  }
  ctx.restore();

  // Frequency bars along the very bottom — subtle
  if (data) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const barCount = 80;
    const barW = W / barCount;
    for (let i = 0; i < barCount; i++) {
      const di = Math.floor((i / barCount) * data.length * 0.5);
      const val = (data[di] || 0) / 255;
      const barH = val * 30 * energy;
      if (barH < 1) continue;
      ctx.fillStyle = `hsla(${30 + i * 2}, 60%, 65%, ${val * 0.04})`;
      ctx.fillRect(i * barW, H - barH, barW - 0.5, barH);
    }
    ctx.restore();
  }
}

export default function Visualizer() {
  const navigate = useNavigate();
  const { currentSong, isPlaying, analyserRef, ensureAudioGraph, volume, setVolume } = usePlayer();
  const [showInfo, setShowInfo] = useState(true);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const starsRef = useRef([]);
  const timeRef = useRef(0);
  const prevBassRef = useRef(0);
  const beatRef = useRef(0);
  const earthStateRef = useRef({});
  const cityStateRef = useRef({});
  const oceanStateRef = useRef({});
  // Radial is the default — other themes are lazy (click to run, click active one again to stop).
  const [vizTheme, setVizTheme] = useState('radial');

  // Canvas setup runs once (doesn't depend on theme).
  // We cap the *rendered* canvas resolution at ~1920px and CSS-scale it to fill
  // the window. A music visualizer doesn't need native 4K pixels — this cuts
  // GPU fill-rate work ~4× on a 4K display with zero perceptible difference.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function resize() {
      const MAX = 1920;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.min(1, MAX / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Animation loop — only runs while a theme is selected
  useEffect(() => {
    if (!vizTheme) {
      // Clear canvas so the previous theme doesn't linger when user deselects
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    ensureAudioGraph();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Lazy-init per-theme state only for the active theme
    if (!particlesRef.current.length) particlesRef.current = initParticles(canvas.width, canvas.height);
    if (!starsRef.current.length) starsRef.current = initStars(canvas.width, canvas.height);

    const analyser = analyserRef.current;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let cancelled = false;

    function draw() {
      if (cancelled) return;
      // Pause when window is hidden/minimized
      if (document.hidden) { animRef.current = requestAnimationFrame(draw); return; }

      const W = canvas.width, H = canvas.height;
      const t = timeRef.current += 0.016;

      let bass = 0, mid = 0, treble = 0, energy = 0;
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        const len = dataArray.length;
        for (let i = 0; i < len * 0.15; i++) bass += dataArray[i]; bass /= (len * 0.15 * 255);
        for (let i = Math.floor(len * 0.15); i < len * 0.45; i++) mid += dataArray[i]; mid /= (len * 0.3 * 255);
        for (let i = Math.floor(len * 0.45); i < len; i++) treble += dataArray[i]; treble /= (len * 0.55 * 255);
        for (let i = 0; i < len; i++) energy += dataArray[i]; energy /= (len * 255);
        bass = Math.min(1, bass * 1.8);
        mid = Math.min(1, mid * 1.5);
        treble = Math.min(1, treble * 1.6);
        energy = Math.min(1, energy * 1.6);
      }

      const bassJump = bass - prevBassRef.current;
      if (bassJump > 0.04) beatRef.current = Math.min(1, beatRef.current + 0.6 + bassJump * 3);
      else beatRef.current *= 0.88;
      prevBassRef.current = bass;
      const beat = beatRef.current;
      const hueBase = (t * 15) % 360;

      switch (vizTheme) {
        case 'bars': drawBars(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase); break;
        case 'wave': drawWave(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, particlesRef.current); break;
        case 'galaxy': drawGalaxy(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, starsRef.current); break;
        case 'earth': drawEarth(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, starsRef.current, earthStateRef.current); break;
        case 'city': drawCity(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, cityStateRef.current); break;
        case 'aurora': drawAurora(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, starsRef.current); break;
        case 'ocean': drawOcean(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, oceanStateRef.current); break;
        case 'radial':
        default: drawRadial(ctx, W, H, t, dataArray, bass, mid, treble, energy, beat, hueBase, particlesRef.current, starsRef.current); break;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    };
  }, [vizTheme, analyserRef, ensureAudioGraph]);

  return createPortal(
    <div className="visualizer-overlay">
      <canvas ref={canvasRef} className="visualizer-canvas" />

      {showInfo && currentSong ? (
        <div className="visualizer-song-info">
          <span className="visualizer-song-title">{currentSong.title}</span>
          <span className="visualizer-song-artist">{currentSong.artist || 'Unknown Artist'}</span>
          {isPlaying && <span className="visualizer-playing-badge">Playing</span>}
        </div>
      ) : !currentSong ? (
        <div className="visualizer-no-song">Play a song to see the magic</div>
      ) : null}

      {!vizTheme && (
        <div className="visualizer-idle">
          <div className="visualizer-idle-title">Pick a visualizer below</div>
          <div className="visualizer-idle-sub">Nothing runs until you choose one.</div>
        </div>
      )}

      {/* Controls — top left */}
      <div className="viz-controls">
        <button className={`viz-ctrl-btn ${showInfo ? 'active' : ''}`} onClick={() => setShowInfo(!showInfo)} title={showInfo ? 'Hide song info' : 'Show song info'}>
          {showInfo ? <IoEye /> : <IoEyeOff />}
        </button>
        <div className="viz-volume">
          <IoVolumeHigh className="viz-vol-icon" />
          <input type="range" min="0" max="1" step="0.01" value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="viz-vol-slider" />
        </div>
      </div>

      <div className="viz-themes">
        {['Radial', 'Bars', 'Wave', 'Galaxy', 'Earth', 'City', 'Aurora', 'Ocean'].map(t => {
          const key = t.toLowerCase();
          const active = vizTheme === key;
          return (
            <button
              key={t}
              className={`viz-theme-btn ${active ? 'active' : ''}`}
              onClick={() => setVizTheme(active ? null : key)}
              title={active ? `Click to stop ${t}` : `Start ${t}`}
            >{t}</button>
          );
        })}
      </div>

      <button className="visualizer-close-btn" onClick={() => navigate(-1)} title="Close">
        <IoClose />
      </button>
    </div>,
    document.body
  );
}
