import { openDB } from 'idb';

const DB_NAME = 'versefy-db';
const DB_VERSION = 4;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const songStore = db.createObjectStore('songs', { keyPath: 'id' });
        songStore.createIndex('title', 'title');
        songStore.createIndex('artist', 'artist');
        songStore.createIndex('addedAt', 'addedAt');

        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
        playlistStore.createIndex('name', 'name');

        db.createObjectStore('recentlyPlayed', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('recentlyPlayed')) {
          db.createObjectStore('recentlyPlayed', { keyPath: 'id' });
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id' });
        }
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
      }
    },
  });
}

function normalizeSong(song) {
  if (!song) return song;
  return {
    tags: [],
    category: '',
    type: 'music',
    folderId: null,
    favorite: false,
    playCount: 0,
    lastPlayed: null,
    rating: 0,
    ...song,
  };
}

// Song rating
export async function rateSong(id, rating) {
  const db = await getDB();
  const song = normalizeSong(await db.get('songs', id));
  if (!song) return null;
  song.rating = rating;
  await db.put('songs', song);
  return song;
}

// Duplicate detection
export async function findDuplicates() {
  const songs = await getAllSongs();
  const groups = {};
  for (const s of songs) {
    // Group by normalized title + artist
    const key = `${(s.title || '').trim().toLowerCase()}|${(s.artist || '').trim().toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  // Return only groups with more than one song
  return Object.values(groups).filter(g => g.length > 1);
}

// Export entire library
export async function exportLibrary() {
  const db = await getDB();
  const songs = await db.getAll('songs');
  const playlists = await db.getAll('playlists');
  const folders = await db.getAll('folders');
  const tags = await db.getAll('tags');
  const recentlyPlayed = await db.getAll('recentlyPlayed');
  return { songs, playlists, folders, tags, recentlyPlayed, exportedAt: Date.now(), version: DB_VERSION };
}

// Import library
export async function importLibrary(data, { merge = false } = {}) {
  const db = await getDB();
  if (!merge) {
    // Clear all stores first
    const stores = ['songs', 'playlists', 'folders', 'tags', 'recentlyPlayed'];
    for (const store of stores) {
      const tx = db.transaction(store, 'readwrite');
      await tx.store.clear();
      await tx.done;
    }
  }
  // Import each store
  if (data.songs) { const tx = db.transaction('songs', 'readwrite'); for (const s of data.songs) tx.store.put(s); await tx.done; }
  if (data.playlists) { const tx = db.transaction('playlists', 'readwrite'); for (const p of data.playlists) tx.store.put(p); await tx.done; }
  if (data.folders) { const tx = db.transaction('folders', 'readwrite'); for (const f of data.folders) tx.store.put(f); await tx.done; }
  if (data.tags) { const tx = db.transaction('tags', 'readwrite'); for (const t of data.tags) tx.store.put(t); await tx.done; }
  if (data.recentlyPlayed) { const tx = db.transaction('recentlyPlayed', 'readwrite'); for (const r of data.recentlyPlayed) tx.store.put(r); await tx.done; }
}

// Songs
export async function addSong(song) {
  const db = await getDB();
  await db.put('songs', { tags: [], category: '', type: 'music', folderId: null, favorite: false, ...song });
}

export async function getAllSongs() {
  const db = await getDB();
  const songs = await db.getAll('songs');
  return songs.map(normalizeSong).sort((a, b) => b.addedAt - a.addedAt);
}

export async function getSong(id) {
  const db = await getDB();
  return normalizeSong(await db.get('songs', id));
}

export async function updateSong(song) {
  const db = await getDB();
  await db.put('songs', song);
}

export async function deleteSong(id) {
  const db = await getDB();
  await db.delete('songs', id);
}

export async function incrementPlayCount(id) {
  const db = await getDB();
  const song = normalizeSong(await db.get('songs', id));
  if (!song) return;
  song.playCount = (song.playCount || 0) + 1;
  song.lastPlayed = Date.now();
  await db.put('songs', song);
}

export async function toggleFavorite(id) {
  const db = await getDB();
  const song = normalizeSong(await db.get('songs', id));
  if (!song) return null;
  song.favorite = !song.favorite;
  await db.put('songs', song);
  return song;
}

export async function deleteCompletely(id) {
  const db = await getDB();
  // Delete the song itself
  await db.delete('songs', id);
  // Remove from recently played
  try { await db.delete('recentlyPlayed', id); } catch {}
  // Remove from all playlists
  const playlists = await db.getAll('playlists');
  const tx = db.transaction('playlists', 'readwrite');
  for (const pl of playlists) {
    if (pl.songIds.includes(id)) {
      pl.songIds = pl.songIds.filter(sid => sid !== id);
      tx.store.put(pl);
    }
  }
  await tx.done;
}

export async function bulkUpdateSongs(songs) {
  const db = await getDB();
  const tx = db.transaction('songs', 'readwrite');
  for (const song of songs) {
    tx.store.put(song);
  }
  await tx.done;
}

// Folders
// folder: { id, name, parentId (null = root), type ('music'|'sfx'|'all'), color, createdAt }
export async function createFolder(folder) {
  const db = await getDB();
  await db.put('folders', folder);
}

export async function getAllFolders() {
  const db = await getDB();
  return db.getAll('folders');
}

export async function getFolder(id) {
  const db = await getDB();
  return db.get('folders', id);
}

export async function updateFolder(folder) {
  const db = await getDB();
  await db.put('folders', folder);
}

export async function deleteFolder(id) {
  const db = await getDB();
  // Move songs in this folder to root
  const songs = await getAllSongs();
  const tx = db.transaction('songs', 'readwrite');
  for (const s of songs) {
    if (s.folderId === id) {
      s.folderId = null;
      tx.store.put(s);
    }
  }
  await tx.done;
  await db.delete('folders', id);
}

// Playlists
export async function createPlaylist(playlist) {
  const db = await getDB();
  await db.put('playlists', playlist);
}

export async function getAllPlaylists() {
  const db = await getDB();
  return db.getAll('playlists');
}

export async function getPlaylist(id) {
  const db = await getDB();
  return db.get('playlists', id);
}

export async function updatePlaylist(playlist) {
  const db = await getDB();
  await db.put('playlists', playlist);
}

export async function deletePlaylist(id) {
  const db = await getDB();
  await db.delete('playlists', id);
}

// Tags
export async function getAllTags() {
  const db = await getDB();
  return db.getAll('tags');
}

export async function createTag(tag) {
  const db = await getDB();
  await db.put('tags', tag);
}

export async function deleteTag(id) {
  const db = await getDB();
  await db.delete('tags', id);
}

// Recently Played
export async function addToRecentlyPlayed(songId) {
  const db = await getDB();
  const entry = { id: songId, playedAt: Date.now() };
  await db.put('recentlyPlayed', entry);
}

export async function getRecentlyPlayed() {
  const db = await getDB();
  const entries = await db.getAll('recentlyPlayed');
  return entries.sort((a, b) => b.playedAt - a.playedAt).slice(0, 20);
}
