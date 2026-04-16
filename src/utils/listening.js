// Real listening-time tracker. Only increments while audio is actually playing.
// Stored entirely in localStorage — no server, no tracking, fully local.
//
// Shape:
// {
//   "2026-04": {
//     totalSec: 12345,
//     days:  { "2026-04-16": 1234, ... },
//     songs: { "<songId>": 456, ... },
//     artists: { "<artistName>": 789, ... },
//     sessions: number,   // count of distinct play sessions this month
//     lastSessionStart: timestamp,
//   }
// }

const KEY = 'versefy-listening';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Call this every second while actively playing
export function addListeningSecond(song) {
  if (!song) return;
  const data = load();
  const mk = monthKey();
  const dk = dayKey();
  if (!data[mk]) data[mk] = { totalSec: 0, days: {}, songs: {}, artists: {}, sessions: 0, lastSessionStart: 0 };
  const m = data[mk];
  m.totalSec = (m.totalSec || 0) + 1;
  m.days[dk] = (m.days[dk] || 0) + 1;
  m.songs[song.id] = (m.songs[song.id] || 0) + 1;
  const artist = song.artist || 'Unknown Artist';
  m.artists[artist] = (m.artists[artist] || 0) + 1;
  save(data);
}

// Call when a new play session starts (not every song change — only after a pause > 5 min)
export function markSessionStart() {
  const data = load();
  const mk = monthKey();
  if (!data[mk]) data[mk] = { totalSec: 0, days: {}, songs: {}, artists: {}, sessions: 0, lastSessionStart: 0 };
  const m = data[mk];
  const now = Date.now();
  if (now - (m.lastSessionStart || 0) > 5 * 60 * 1000) {
    m.sessions = (m.sessions || 0) + 1;
  }
  m.lastSessionStart = now;
  save(data);
}

export function getMonthStats(year, month) {
  const data = load();
  const mk = `${year}-${String(month).padStart(2, '0')}`;
  return data[mk] || { totalSec: 0, days: {}, songs: {}, artists: {}, sessions: 0 };
}

export function getCurrentMonthStats() {
  const d = new Date();
  return getMonthStats(d.getFullYear(), d.getMonth() + 1);
}

// Get last fully completed month (for the "wrapped" popup)
export function getLastMonthStats() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { stats: getMonthStats(d.getFullYear(), d.getMonth() + 1), year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function listAllMonths() {
  const data = load();
  return Object.keys(data).filter(k => k !== '__legacy').sort().reverse();
}

export function getMonthData(mk) {
  const data = load();
  return data[mk] || null;
}

// Top songs in a month (by listened seconds) — takes a songs map keyed by id
export function getTopSongsForMonth(stats, songsById, limit = 10) {
  if (!stats?.songs) return [];
  return Object.entries(stats.songs)
    .map(([id, sec]) => ({ song: songsById[id], sec }))
    .filter(x => x.song)
    .sort((a, b) => b.sec - a.sec)
    .slice(0, limit);
}

export function getTopArtistsForMonth(stats, limit = 5) {
  if (!stats?.artists) return [];
  return Object.entries(stats.artists)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, sec]) => ({ name, sec }));
}

// Total historical listening time across all months (plus any legacy estimate)
export function getLifetimeSec() {
  const data = load();
  const monthly = Object.entries(data)
    .filter(([k]) => k !== '__legacy')
    .reduce((sum, [, m]) => sum + (m.totalSec || 0), 0);
  const legacy = data.__legacy?.sec || 0;
  return monthly + legacy;
}

// One-time migration: seed legacy listening time from old playCount × duration
// so users who listened before real-tracking existed don't see their totals vanish.
export function migrateLegacyListening(songs) {
  if (!songs || !songs.length) return;
  const MIGRATION_FLAG = 'versefy-listening-migrated';
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const legacySec = songs.reduce((sum, s) => {
    const d = (s.duration && isFinite(s.duration) && s.duration > 0) ? s.duration : 0;
    return sum + (s.playCount || 0) * d;
  }, 0);

  if (legacySec > 0) {
    const data = load();
    data.__legacy = { sec: Math.round(legacySec) };
    save(data);
  }
  localStorage.setItem(MIGRATION_FLAG, '1');
}

// Clear all listening data
export function clearListening() {
  localStorage.removeItem(KEY);
}

// Is the Wrapped viewing window open right now?
// Window: last 3 days of a month (preview the month you're in) + first 3 days of the next month (see last month).
// Outside this 6-day window, no Wrapped is accessible.
export function getWrappedWindowStatus(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const day = date.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();

  // Last 3 days of current month → current month's wrapped (preview)
  if (day >= lastDay - 2) {
    return {
      open: true,
      kind: 'preview',
      year: y,
      month: m + 1,
      stats: getMonthStats(y, m + 1),
    };
  }

  // First 3 days of current month → previous month's final wrapped
  if (day <= 3) {
    const prev = new Date(y, m - 1, 1);
    const py = prev.getFullYear();
    const pm = prev.getMonth() + 1;
    return {
      open: true,
      kind: 'final',
      year: py,
      month: pm,
      stats: getMonthStats(py, pm),
    };
  }

  return { open: false };
}

export function formatListenTime(sec) {
  if (!sec || sec < 60) return `${Math.round(sec || 0)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
