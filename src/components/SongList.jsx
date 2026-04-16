import { IoPlaySharp, IoEllipsisHorizontal, IoTrash, IoAdd, IoPricetag, IoMusicalNotes, IoCheckbox, IoSquareOutline, IoDownload, IoSpeedometer, IoPencil, IoHeart, IoHeartOutline, IoShareSocial, IoStar, IoStarOutline, IoPulse } from 'react-icons/io5';
import { usePlayer } from '../context/PlayerContext';
import { updateSong, toggleFavorite, rateSong } from '../utils/db';
import { useState, useRef, useEffect } from 'react';
import AddToPlaylistModal from './AddToPlaylistModal';
import EditSongModal from './EditSongModal';
import './SongList.css';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongList({ songs, onDelete, onSongUpdated, showIndex = true, showTags = false, compact = false }) {
  const { playSong, currentSong, isPlaying, setEffectMode } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const menuRef = useRef(null);
  const renameRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === songs.length) setSelected(new Set());
    else setSelected(new Set(songs.map(s => s.id)));
  }

  async function handleRename(song) {
    const newTitle = renameValue.trim();
    if (newTitle && newTitle !== song.title) {
      const updated = { ...song, title: newTitle };
      await updateSong(updated);
      onSongUpdated?.(updated);
    }
    setRenamingId(null);
    setRenameValue('');
  }

  async function exportWaveform(song) {
    try {
      const resp = await fetch(song.audioUrl);
      const buf = await resp.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(buf);
      ctx.close();
      const data = decoded.getChannelData(0);

      const W = 1200, H = 300;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const c = canvas.getContext('2d');

      // Background
      c.fillStyle = '#0a0a14';
      c.fillRect(0, 0, W, H);

      // Waveform
      const step = Math.ceil(data.length / W);
      const mid = H / 2;
      for (let i = 0; i < W; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step && i * step + j < data.length; j++) {
          const v = data[i * step + j];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const hue = 270 + (i / W) * 60;
        c.fillStyle = `hsl(${hue}, 80%, 65%)`;
        const top = mid + min * mid * 0.85;
        const bottom = mid + max * mid * 0.85;
        c.fillRect(i, top, 1, bottom - top || 1);
      }

      // Song info
      c.fillStyle = '#fff'; c.font = 'bold 18px Inter, sans-serif';
      c.fillText(song.title, 16, 28);
      c.fillStyle = '#888'; c.font = '13px Inter, sans-serif';
      c.fillText(song.artist || 'Unknown Artist', 16, 48);
      c.fillStyle = 'rgba(139,92,246,0.4)'; c.font = '10px Inter, sans-serif';
      c.textAlign = 'right'; c.fillText('versefy', W - 12, H - 10); c.textAlign = 'left';

      const link = document.createElement('a');
      link.download = `${song.title}-waveform.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('Could not export waveform: ' + e.message);
    }
  }

  function playWithEffect(songsList, idx, effect) {
    setEffectMode(effect);
    playSong(songsList, idx);
    setMenuOpen(null);
  }

  if (!songs || songs.length === 0) {
    return <div className="song-list-empty">No songs yet. Upload some music to get started!</div>;
  }

  return (
    <div className="song-list">
      {/* Bulk actions bar */}
      {songs.length > 0 && (
        <div className="song-list-toolbar">
          <button
            className={`toolbar-btn ${selectMode ? 'active' : ''}`}
            onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
          >
            {selectMode ? <IoCheckbox /> : <IoSquareOutline />}
            <span>Select</span>
          </button>
          {selectMode && selected.size > 0 && (
            <>
              <button className="toolbar-btn" onClick={selectAll}>
                {selected.size === songs.length ? 'Deselect all' : 'Select all'}
              </button>
              <button className="toolbar-btn accent" onClick={() => setShowPlaylistModal(true)}>
                <IoAdd /> Add {selected.size} to playlist
              </button>
              {onDelete && (
                <button className="toolbar-btn danger"
                  onClick={() => { selected.forEach(id => onDelete(id)); setSelected(new Set()); setSelectMode(false); }}>
                  <IoTrash /> Delete {selected.size}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="song-list-header">
        {showIndex && <span className="col-index">#</span>}
        <span className="col-title">Title</span>
        {!compact && <span className="col-artist">Artist</span>}
        {showTags && <span className="col-tags">Tags</span>}
        <span className="col-duration">Duration</span>
        <span className="col-actions" />
      </div>

      {songs.map((song, idx) => {
        const isCurrent = currentSong?.id === song.id;
        const isSelected = selected.has(song.id);
        const isRenaming = renamingId === song.id;
        return (
          <div
            key={song.id}
            className={`song-row ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''}`}
            onDoubleClick={() => !isRenaming && playSong(songs, idx)}
            onClick={() => selectMode && toggleSelect(song.id)}
          >
            {showIndex && (
              <span className="col-index">
                {selectMode ? (
                  <span className={`select-check ${isSelected ? 'checked' : ''}`}>
                    {isSelected ? <IoCheckbox /> : <IoSquareOutline />}
                  </span>
                ) : (
                  <>
                    {isCurrent && isPlaying ? (
                      <span className="playing-indicator"><span /><span /><span /></span>
                    ) : (
                      <span className="row-number">{idx + 1}</span>
                    )}
                    <button className="play-overlay" onClick={() => playSong(songs, idx)}><IoPlaySharp /></button>
                  </>
                )}
              </span>
            )}
            <span className="col-title">
              <div className="song-title-wrap">
                {song.artwork ? (
                  <img src={song.artwork} alt="" className="song-thumb" />
                ) : (
                  <div className="song-thumb-placeholder">
                    {song.type === 'sfx' ? <IoMusicalNotes className="thumb-icon" /> : null}
                  </div>
                )}
                <div className="song-title-text">
                  {isRenaming ? (
                    <input
                      ref={renameRef}
                      className="inline-rename"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(song);
                        if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                      }}
                      onBlur={() => handleRename(song)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`song-name ${isCurrent ? 'active' : ''}`}>{song.title}</span>
                  )}
                  {compact && <span className="song-artist-sub">{song.artist || 'Unknown'}</span>}
                </div>
              </div>
            </span>
            {!compact && <span className="col-artist">{song.artist || 'Unknown'}</span>}
            {showTags && (
              <span className="col-tags">
                {song.category && <span className="tag-pill category">{song.category}</span>}
                {(song.tags || []).slice(0, 2).map(t => <span key={t} className="tag-pill">{t}</span>)}
                {(song.tags || []).length > 2 && <span className="tag-pill more">+{song.tags.length - 2}</span>}
              </span>
            )}
            <span className="col-duration">{formatDuration(song.duration)}</span>
            <span className="col-actions">
              {!selectMode && (
                <>
                  <button className="action-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === song.id ? null : song.id); }}>
                    <IoEllipsisHorizontal />
                  </button>
                  {menuOpen === song.id && (
                    <div className="context-menu" ref={menuRef}>
                      <button onClick={() => { setRenamingId(song.id); setRenameValue(song.title); setMenuOpen(null); }}>
                        <IoPencil /> Rename
                      </button>
                      <button onClick={async () => { const u = await toggleFavorite(song.id); if (u) onSongUpdated?.(u); setMenuOpen(null); }}>
                        {song.favorite ? <IoHeart style={{color:'#ec4899'}} /> : <IoHeartOutline />}
                        {song.favorite ? 'Unfavorite' : 'Favorite'}
                      </button>
                      <div className="context-rating" onClick={e => e.stopPropagation()}>
                        <span className="context-rating-label">Rating</span>
                        <div className="star-row">
                          {[1,2,3,4,5].map(star => (
                            <button key={star} className={`star-btn ${(song.rating || 0) >= star ? 'active' : ''}`}
                              onClick={async () => { const u = await rateSong(song.id, (song.rating || 0) === star ? 0 : star); if (u) onSongUpdated?.(u); }}>
                              {(song.rating || 0) >= star ? <IoStar /> : <IoStarOutline />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => { setShowPlaylistModal(true); setSelected(new Set([song.id])); setMenuOpen(null); }}>
                        <IoAdd /> Add to playlist
                      </button>
                      <button onClick={() => { setEditingSong(song); setMenuOpen(null); }}>
                        <IoPricetag /> Edit details
                      </button>
                      <div className="context-divider" />
                      <div className="context-label">Play as...</div>
                      <button onClick={() => playWithEffect(songs, idx, 'normal')}>
                        <IoPlaySharp /> Normal
                      </button>
                      <button onClick={() => playWithEffect(songs, idx, 'nightcore')}>
                        <IoSpeedometer /> Nightcore
                      </button>
                      <button onClick={() => playWithEffect(songs, idx, 'slowed')}>
                        <IoSpeedometer /> Slowed + Reverb
                      </button>
                      <div className="context-divider" />
                      <button onClick={() => {
                        const a = document.createElement('a');
                        a.href = song.audioUrl;
                        a.download = `${song.title}.mp3`;
                        a.click();
                        setMenuOpen(null);
                      }}>
                        <IoDownload /> Save to disk
                      </button>
                      <button onClick={() => { exportWaveform(song); setMenuOpen(null); }}>
                        <IoPulse /> Export Waveform
                      </button>
                      <button onClick={async () => {
                        if (window.electronAPI?.share) {
                          const { url } = await window.electronAPI.share.start({ title: song.title, audioUrl: song.audioUrl });
                          navigator.clipboard.writeText(url).catch(() => {});
                          alert(`Share link copied!\n\n${url}\n\nAnyone on your network can open this to listen.`);
                        }
                        setMenuOpen(null);
                      }}>
                        <IoShareSocial /> Share
                      </button>
                      {onDelete && (
                        <button onClick={() => { onDelete(song.id); setMenuOpen(null); }}>
                          <IoTrash /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </span>
          </div>
        );
      })}

      {showPlaylistModal && selected.size > 0 && (
        <AddToPlaylistModal
          songIds={[...selected]}
          onClose={() => { setShowPlaylistModal(false); setSelected(new Set()); setSelectMode(false); }}
        />
      )}

      {editingSong && (
        <EditSongModal
          song={editingSong}
          onClose={() => setEditingSong(null)}
          onSaved={(updated) => onSongUpdated?.(updated)}
        />
      )}
    </div>
  );
}
