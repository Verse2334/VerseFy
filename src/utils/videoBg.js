import { openDB } from 'idb';

const DB_NAME = 'versefy-video-bg';
const STORE = 'videos';
const CONFIG_KEY = 'versefy-video-bg';
const CHANGE_EVENT = 'versefy-video-bg-changed';

async function getDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      }
      // v2: nothing structural — keys are ids now, but old 'bg' key is still readable
    },
  });
}

export const DEFAULT_CONFIG = {
  enabled: false,
  activeVideoId: null,
  opacity: 0.5,
};

export function getConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Migrate old shape: { enabled, type, youtubeUrl, hasFile, fileName, opacity }
    if (parsed && ('type' in parsed || 'hasFile' in parsed)) {
      return { ...DEFAULT_CONFIG, enabled: !!parsed.enabled, opacity: parsed.opacity ?? 0.5 };
    }
    return parsed ? { ...DEFAULT_CONFIG, ...parsed } : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}

export function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function onConfigChange(cb) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

// ===== Video library =====
// Each video stored under its own id. Record shape:
// { id, name, mime, source: 'file'|'youtube', ytUrl, addedAt, size, blob }

function genId() {
  return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export async function addVideo({ blob, name, mime, source = 'file', ytUrl = '' }) {
  const db = await getDB();
  const id = genId();
  const rec = { id, name, mime: mime || blob.type || 'video/mp4', source, ytUrl, addedAt: Date.now(), size: blob.size, blob };
  await db.put(STORE, rec, id);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return id;
}

export async function getAllVideos() {
  const db = await getDB();
  const keys = await db.getAllKeys(STORE);
  const items = [];
  for (const k of keys) {
    if (k === 'bg') continue; // skip legacy single-slot blob if present
    const rec = await db.get(STORE, k);
    if (rec && rec.blob) {
      const { blob, ...meta } = rec;
      items.push({ ...meta, _hasBlob: true });
    }
  }
  return items.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getVideoBlobUrl(id) {
  const db = await getDB();
  const rec = await db.get(STORE, id);
  if (!rec?.blob) return null;
  return URL.createObjectURL(rec.blob);
}

export async function deleteVideo(id) {
  const db = await getDB();
  await db.delete(STORE, id);
  const cfg = getConfig();
  if (cfg.activeVideoId === id) {
    saveConfig({ ...cfg, activeVideoId: null, enabled: false });
  } else {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export async function renameVideo(id, newName) {
  const db = await getDB();
  const rec = await db.get(STORE, id);
  if (!rec) return;
  rec.name = newName;
  await db.put(STORE, rec, id);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function setActiveVideo(id) {
  const cfg = getConfig();
  saveConfig({ ...cfg, activeVideoId: id, enabled: id ? true : false });
}

export function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
