import { useEffect, useState, useRef } from 'react';
import { getAllPlaylists, createPlaylist, deletePlaylist, updatePlaylist, getPlaylist, getAllSongs } from '../utils/db';
import SongList from '../components/SongList';
import { IoAdd, IoTrash, IoPencil, IoChevronBack, IoMusicalNotes, IoClose, IoCheckmarkCircle, IoImage } from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './Pages.css';

const PRESET_ICONS = [
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'thunder', emoji: '⚡', label: 'Thunder' },
  { id: 'rain', emoji: '🌧️', label: 'Rain' },
  { id: 'skull', emoji: '💀', label: 'Skull' },
  { id: 'ghost', emoji: '👻', label: 'Ghost' },
  { id: 'alien', emoji: '👽', label: 'Alien' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'gem', emoji: '💎', label: 'Gem' },
  { id: 'crown', emoji: '👑', label: 'Crown' },
  { id: 'music', emoji: '🎵', label: 'Music' },
  { id: 'headphone', emoji: '🎧', label: 'Headphones' },
  { id: 'guitar', emoji: '🎸', label: 'Guitar' },
  { id: 'mic', emoji: '🎤', label: 'Mic' },
  { id: 'wave', emoji: '🌊', label: 'Wave' },
  { id: 'sunset', emoji: '🌅', label: 'Sunset' },
  { id: 'night', emoji: '🌃', label: 'Night' },
  { id: 'sparkle', emoji: '✨', label: 'Sparkle' },
  { id: 'rose', emoji: '🌹', label: 'Rose' },
  { id: 'crystal', emoji: '🔮', label: 'Crystal Ball' },
  { id: 'peace', emoji: '☮️', label: 'Peace' },
  { id: 'cloud', emoji: '☁️', label: 'Cloud' },
];

const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #2d1b69 0%, #6b21a8 50%, #a855f7 100%)',
  'linear-gradient(135deg, #1e3a5f 0%, #0ea5e9 50%, #38bdf8 100%)',
  'linear-gradient(135deg, #4a1942 0%, #ec4899 50%, #f472b6 100%)',
  'linear-gradient(135deg, #1a2e05 0%, #22c55e 50%, #4ade80 100%)',
  'linear-gradient(135deg, #3b0e0e 0%, #ef4444 50%, #f87171 100%)',
  'linear-gradient(135deg, #3d2b00 0%, #f59e0b 50%, #fbbf24 100%)',
  'linear-gradient(135deg, #0a0a0a 0%, #404040 50%, #737373 100%)',
];

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [allSongs, setAllSongs] = useState([]);
  const [iconPickerId, setIconPickerId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    const pls = await getAllPlaylists();
    setPlaylists(pls);
  }

  async function handleCreate() {
    const name = newName.trim() || `Playlist #${playlists.length + 1}`;
    const pl = { id: uuidv4(), name, songIds: [], createdAt: Date.now() };
    await createPlaylist(pl);
    setNewName('');
    loadPlaylists();
  }

  async function handleDelete(id) {
    await deletePlaylist(id);
    if (selected?.id === id) setSelected(null);
    loadPlaylists();
  }

  async function handleRename(id) {
    const pl = await getPlaylist(id);
    if (pl) {
      pl.name = editName.trim() || pl.name;
      await updatePlaylist(pl);
      setEditingId(null);
      loadPlaylists();
      if (selected?.id === id) setSelected(pl);
    }
  }

  async function selectPlaylist(pl) {
    setSelected(pl);
    const songs = await getAllSongs();
    setAllSongs(songs);
    const filtered = pl.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
    setPlaylistSongs(filtered);
  }

  async function handleRemoveFromPlaylist(songId) {
    if (!selected) return;
    const pl = await getPlaylist(selected.id);
    pl.songIds = pl.songIds.filter(id => id !== songId);
    await updatePlaylist(pl);
    setSelected(pl);
    setPlaylistSongs(prev => prev.filter(s => s.id !== songId));
    loadPlaylists();
  }

  async function handleAddSongToPlaylist(songId) {
    if (!selected) return;
    const pl = await getPlaylist(selected.id);
    if (!pl.songIds.includes(songId)) {
      pl.songIds.push(songId);
      await updatePlaylist(pl);
      setSelected(pl);
      const songs = await getAllSongs();
      setPlaylistSongs(pl.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean));
      loadPlaylists();
    }
  }

  async function handleSetPresetIcon(plId, preset) {
    const pl = await getPlaylist(plId);
    if (pl) {
      pl.icon = { type: 'preset', value: preset.emoji };
      pl.gradient = pl.gradient || PRESET_GRADIENTS[0];
      await updatePlaylist(pl);
      loadPlaylists();
      if (selected?.id === plId) setSelected({ ...pl });
    }
  }

  async function handleSetGradient(plId, gradient) {
    const pl = await getPlaylist(plId);
    if (pl) {
      pl.gradient = gradient;
      await updatePlaylist(pl);
      loadPlaylists();
      if (selected?.id === plId) setSelected({ ...pl });
    }
  }

  async function handleUploadIcon(plId, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return; // 2MB max
    const reader = new FileReader();
    reader.onload = async () => {
      const pl = await getPlaylist(plId);
      if (pl) {
        pl.icon = { type: 'image', value: reader.result };
        await updatePlaylist(pl);
        loadPlaylists();
        if (selected?.id === plId) setSelected({ ...pl });
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleClearIcon(plId) {
    const pl = await getPlaylist(plId);
    if (pl) {
      delete pl.icon;
      delete pl.gradient;
      await updatePlaylist(pl);
      loadPlaylists();
      if (selected?.id === plId) setSelected({ ...pl });
    }
  }

  function renderPlaylistArt(pl, large = false) {
    const grad = pl.gradient || PRESET_GRADIENTS[0];
    const sizeClass = large ? 'playlist-card-art large' : 'playlist-card-art';
    if (pl.icon?.type === 'image') {
      return (
        <div className={sizeClass} style={{ background: grad }}>
          <img src={pl.icon.value} alt="" className="playlist-icon-img" />
        </div>
      );
    }
    if (pl.icon?.type === 'preset') {
      return (
        <div className={sizeClass} style={{ background: grad }}>
          <span className="playlist-icon-emoji">{pl.icon.value}</span>
        </div>
      );
    }
    return (
      <div className={sizeClass} style={{ background: grad }}>
        <IoMusicalNotes />
      </div>
    );
  }

  // Playlist detail view
  if (selected) {
    const availableSongs = allSongs.filter(s => !selected.songIds.includes(s.id));

    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => { setSelected(null); setShowAddSongs(false); setIconPickerId(null); }}>
            <IoChevronBack /> Back
          </button>
          <div className="playlist-detail-header">
            <div className="playlist-detail-art-wrap" onClick={() => setIconPickerId(iconPickerId === selected.id ? null : selected.id)}>
              {renderPlaylistArt(selected, true)}
              <div className="playlist-art-overlay"><IoImage /></div>
            </div>
            <div>
              <h1>{selected.name}</h1>
              <p className="subtitle">{playlistSongs.length} song{playlistSongs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {iconPickerId === selected.id && (
          <div className="icon-picker">
            <div className="icon-picker-section">
              <span className="icon-picker-label">Upload Image</span>
              <div className="icon-picker-upload">
                <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
                  <IoImage /> Choose File
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleUploadIcon(selected.id, e)} />
                {selected.icon && (
                  <button className="btn btn-sm btn-ghost" onClick={() => handleClearIcon(selected.id)}>
                    <IoClose /> Clear
                  </button>
                )}
              </div>
            </div>
            <div className="icon-picker-section">
              <span className="icon-picker-label">Preset Icons</span>
              <div className="icon-picker-presets">
                {PRESET_ICONS.map(p => (
                  <button key={p.id} className={`icon-preset-btn ${selected.icon?.value === p.emoji ? 'active' : ''}`}
                    onClick={() => handleSetPresetIcon(selected.id, p)} title={p.label}>
                    {p.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="icon-picker-section">
              <span className="icon-picker-label">Background</span>
              <div className="icon-picker-gradients">
                {PRESET_GRADIENTS.map((g, i) => (
                  <button key={i} className={`gradient-btn ${(selected.gradient || PRESET_GRADIENTS[0]) === g ? 'active' : ''}`}
                    style={{ background: g }} onClick={() => handleSetGradient(selected.id, g)} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="playlist-actions-bar">
          <button className="btn btn-primary" onClick={() => setShowAddSongs(!showAddSongs)}>
            {showAddSongs ? <><IoClose /> Done</> : <><IoAdd /> Add Songs</>}
          </button>
        </div>

        {showAddSongs && (
          <div className="add-songs-panel">
            <h3>Add songs to "{selected.name}"</h3>
            {availableSongs.length === 0 ? (
              <p className="add-songs-empty">All songs are already in this playlist!</p>
            ) : (
              <div className="add-songs-list">
                {availableSongs.map(song => (
                  <div key={song.id} className="add-song-row">
                    <div className="add-song-info">
                      <span className="add-song-title">{song.title}</span>
                      <span className="add-song-artist">{song.artist || 'Unknown'}</span>
                    </div>
                    <button
                      className="add-song-btn"
                      onClick={() => handleAddSongToPlaylist(song.id)}
                    >
                      <IoAdd /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <SongList
          songs={playlistSongs}
          onDelete={handleRemoveFromPlaylist}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Playlists</h1>
        <p className="subtitle">Organize your music</p>
      </div>

      <div className="create-playlist">
        <input
          type="text"
          placeholder="New playlist name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          className="input"
        />
        <button className="btn btn-primary" onClick={handleCreate}>
          <IoAdd /> Create
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="empty-state">
          <IoMusicalNotes className="empty-icon" />
          <p>No playlists yet. Create one above!</p>
        </div>
      ) : (
        <div className="playlists-grid">
          {playlists.map(pl => (
            <div key={pl.id} className="playlist-card" onClick={() => selectPlaylist(pl)}>
              {renderPlaylistArt(pl)}
              <div className="playlist-card-info">
                {editingId === pl.id ? (
                  <input
                    className="input input-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(pl.id)}
                    onBlur={() => handleRename(pl.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="playlist-name">{pl.name}</span>
                )}
                <span className="playlist-count">{pl.songIds.length} songs</span>
              </div>
              <div className="playlist-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  onClick={() => { setEditingId(pl.id); setEditName(pl.name); }}
                >
                  <IoPencil />
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(pl.id)}>
                  <IoTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
