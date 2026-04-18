// Dev-only: seed the library with realistic-looking dummy songs for taking
// screenshots. Each song is marked with { _demo: true } so clearDemoSongs()
// can remove only the dummies without touching real uploads.
//
// - audioUrl is a ~1.6 KB silent WAV (so the library stays small and IDB happy)
// - artwork is a procedural gradient rendered to a small JPEG data URL
// - durations / plays / favorites / ratings / timestamps are realistic
//
// Call addDemoSongs() from Settings → Developer. Clear with clearDemoSongs().

import { v4 as uuidv4 } from 'uuid';
import { addSong, getAllSongsFull, deleteSong } from './db';

const TITLES = [
  'Midnight Drive', 'Solace', 'After Hours', 'Parallel', 'Ghost in the Machine',
  'Afterglow', 'Neon Rain', 'Stay Up', 'Satellites', 'Weightless',
  'Tokyo 3 A.M.', 'Undercurrent', 'Pulse', 'Hyperspace', 'Lavender Fields',
  'Static', 'Wavelengths', 'Moonphase', 'Orbit', 'Daydream',
  'Echo Chamber', 'Slowdance', 'Mirage', 'Fade', 'Glass',
  'Infinite', 'Velvet', 'Cascade', 'Serotonin', 'Overcast',
];

const ARTISTS = [
  'Leo Ray', 'Stellar Kid', 'Nova Wave', 'ATLAS', 'Monarch',
  'Tidal', 'Halcyon', 'Arc Light', 'Odeon', 'Verity',
  'Caldera', 'Rook & Ivy', 'Pale Blue', 'Echoes', 'Midnight Set',
  'Future Rooms', 'Slow Moon', 'Copper', 'Night Drive', 'Delay Unit',
];

const GENRES = ['Electronic', 'Synthwave', 'Lo-fi', 'Ambient', 'House', 'Indie', 'Dream Pop', 'Chillwave'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickUnique(arr, used) {
  for (let i = 0; i < 20; i++) {
    const v = pick(arr);
    if (!used.has(v)) { used.add(v); return v; }
  }
  return pick(arr); // give up
}

// Tiny silent WAV (~1.6 KB) — IDB-friendly
function silentWavDataUrl(durationMs = 150) {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * durationMs / 1000);
  const buf = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples * 2, true);
  // samples are already zero
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

// Procedural artwork — unique per song, ~4-8 KB JPEG
function gradientArtwork(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const hue1 = (seed * 37) % 360;
  const hue2 = (hue1 + 90 + ((seed * 17) % 100)) % 360;

  const g = ctx.createLinearGradient(0, 0, 400, 400);
  g.addColorStop(0, `hsl(${hue1}, 70%, 55%)`);
  g.addColorStop(1, `hsl(${hue2}, 70%, 25%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 400);

  // Random blob overlay
  ctx.beginPath();
  ctx.arc(120 + (seed * 13 % 200), 140 + (seed * 7 % 180), 90 + (seed * 5 % 80), 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${(hue1 + 180) % 360}, 80%, 65%, 0.25)`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(300 - (seed * 9 % 180), 280 - (seed * 11 % 160), 60 + (seed * 3 % 50), 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${(hue2 + 60) % 360}, 90%, 70%, 0.2)`;
  ctx.fill();

  // Faint noise texture
  const img = ctx.getImageData(0, 0, 400, 400);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    data[i]   = Math.max(0, Math.min(255, data[i]   + n));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.72);
}

const ONE_DAY = 24 * 60 * 60 * 1000;

// Add N dummy songs. Default 30.
export async function addDemoSongs(count = 30) {
  const usedTitles = new Set();
  const silent = silentWavDataUrl(150); // shared across all demos to save space

  for (let i = 0; i < count; i++) {
    const title = pickUnique(TITLES, usedTitles);
    const artist = pick(ARTISTS);
    const duration = 90 + Math.floor(Math.random() * 210); // 1:30 - 5:00

    // Addition timestamp: spread across last ~6 months
    const addedAt = Date.now() - Math.floor(Math.random() * 180 * ONE_DAY);

    // Play count: most songs have low counts, a few are heavily played
    const roll = Math.random();
    const playCount = roll < 0.15
      ? 80 + Math.floor(Math.random() * 200)   // heavy rotation
      : roll < 0.55
      ? 5 + Math.floor(Math.random() * 30)     // regular
      : Math.floor(Math.random() * 4);         // barely played

    const lastPlayed = playCount > 0
      ? Date.now() - Math.floor(Math.random() * 30 * ONE_DAY)
      : null;

    const song = {
      id: uuidv4(),
      title,
      artist,
      duration,
      audioUrl: silent, // shared tiny blob — only stored once due to IDB dedupe isn't a thing actually, but it's fine
      artwork: gradientArtwork(i * 101 + addedAt % 1000),
      addedAt,
      playCount,
      lastPlayed,
      favorite: Math.random() < 0.22, // ~1 in 5
      rating: Math.random() < 0.35 ? 3 + Math.floor(Math.random() * 3) : 0,
      category: pick(GENRES),
      tags: [],
      type: 'music',
      folderId: null,
      _demo: true,
    };
    await addSong(song);
  }
}

// Remove only songs tagged with _demo
export async function clearDemoSongs() {
  const all = await getAllSongsFull();
  const demos = all.filter(s => s._demo);
  for (const s of demos) {
    await deleteSong(s.id);
  }
  return demos.length;
}

export async function countDemoSongs() {
  const all = await getAllSongsFull();
  return all.filter(s => s._demo).length;
}
