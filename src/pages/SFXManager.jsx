import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getAllSongsFull, deleteCompletely, updateSong, getAllFolders, createFolder, deleteFolder, updateFolder, bulkUpdateSongs } from '../utils/db';
import { usePlayer } from '../context/PlayerContext';
import EditSongModal from '../components/EditSongModal';
import SFXEditor from '../components/SFXEditor';
import {
  IoPlaySharp, IoPauseSharp, IoSearch, IoGrid, IoList,
  IoPricetag, IoTrash, IoVolumeHigh, IoStopSharp,
  IoFolderOpen, IoFolder, IoAdd, IoChevronForward,
  IoDownload, IoMove, IoClose, IoPencil, IoHome,
  IoArrowUp, IoCut
} from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './Pages.css';
import './SFXManager.css';

const FOLDER_COLORS = ['#1db954', '#ff9800', '#e91e63', '#3b82f6', '#8b5cf6', '#06b6d4', '#f43f5e', '#eab308'];

export default function SFXManager() {
  const [songs, setSongs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [editingSong, setEditingSong] = useState(null);
  const [sfxEditing, setSfxEditing] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [movingSong, setMovingSong] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  // Drag state
  const [draggingIds, setDraggingIds] = useState([]);
  const [dropTargetId, setDropTargetId] = useState(null); // folder id or '__parent__' for go-up
  const [selectedIds, setSelectedIds] = useState(new Set());
  const audioRef = useRef(new Audio());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allSongs, allFolders] = await Promise.all([getAllSongsFull(), getAllFolders()]);
    setSongs(allSongs.filter(s => s.type === 'sfx'));
    setFolders(allFolders.filter(f => f.type === 'sfx' || f.type === 'all'));
  }

  const currentFolders = useMemo(() =>
    folders.filter(f => f.parentId === currentFolderId),
    [folders, currentFolderId]
  );

  const currentSongs = useMemo(() => {
    let list = songs.filter(s => s.folderId === currentFolderId);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.artist && s.artist.toLowerCase().includes(q)) ||
        (s.tags || []).some(t => t.includes(q))
      );
    }
    if (filterTag) list = list.filter(s => (s.tags || []).includes(filterTag));
    if (filterCategory) list = list.filter(s => s.category === filterCategory);
    return list;
  }, [songs, currentFolderId, query, filterTag, filterCategory]);

  const breadcrumb = useMemo(() => {
    const path = [];
    let id = currentFolderId;
    while (id) {
      const f = folders.find(f => f.id === id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId;
    }
    return path;
  }, [currentFolderId, folders]);

  // Parent folder id for "go up" drop target
  const parentFolderId = useMemo(() => {
    if (currentFolderId === null) return null;
    const cur = folders.find(f => f.id === currentFolderId);
    return cur ? cur.parentId : null;
  }, [currentFolderId, folders]);

  const allTags = useMemo(() => {
    const set = new Set();
    songs.forEach(s => (s.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [songs]);

  const allCategories = useMemo(() => {
    const set = new Set();
    songs.forEach(s => s.category && set.add(s.category));
    return [...set].sort();
  }, [songs]);

  // ---- Drag and Drop ----
  function getDragIds(songId) {
    // If the dragged item is in the selection, drag all selected; otherwise just this one
    if (selectedIds.has(songId)) return [...selectedIds];
    return [songId];
  }

  function handleDragStart(e, songId) {
    const ids = getDragIds(songId);
    setDraggingIds(ids);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(ids));
    // Custom drag image
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = ids.length > 1 ? `${ids.length} sounds` : songs.find(s => s.id === songId)?.title || 'Sound';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => ghost.remove());
  }

  function handleDragEnd() {
    setDraggingIds([]);
    setDropTargetId(null);
  }

  function handleFolderDragOver(e, folderId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(folderId);
  }

  function handleFolderDragLeave(e, folderId) {
    // Only clear if we're actually leaving this element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dropTargetId === folderId) setDropTargetId(null);
    }
  }

  async function handleFolderDrop(e, targetFolderId) {
    e.preventDefault();
    setDropTargetId(null);
    let ids;
    try {
      ids = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch {
      ids = draggingIds;
    }
    if (!ids || ids.length === 0) return;

    const toUpdate = ids
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean)
      .map(s => ({ ...s, folderId: targetFolderId }));

    if (toUpdate.length > 0) {
      await bulkUpdateSongs(toUpdate);
      loadData();
    }
    setDraggingIds([]);
    setSelectedIds(new Set());
  }

  // Toggle selection (ctrl/cmd click)
  function toggleSelect(songId, e) {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }

  function quickPlay(song) {
    if (playingId === song.id) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      return;
    }
    audioRef.current.src = song.audioUrl;
    audioRef.current.play().catch(() => {});
    setPlayingId(song.id);
    audioRef.current.onended = () => setPlayingId(null);
  }

  function stopAll() {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlayingId(null);
  }

  async function handleDelete(id) {
    await deleteCompletely(id);
    setSongs(prev => prev.filter(s => s.id !== id));
    if (playingId === id) stopAll();
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim() || `Folder ${folders.length + 1}`;
    await createFolder({
      id: uuidv4(), name, parentId: currentFolderId, type: 'sfx',
      color: newFolderColor, createdAt: Date.now(),
    });
    setNewFolderName('');
    setShowNewFolder(false);
    loadData();
  }

  async function handleDeleteFolder(id) {
    await deleteFolder(id);
    loadData();
  }

  async function handleRenameFolder(id) {
    const f = folders.find(f => f.id === id);
    if (f) {
      await updateFolder({ ...f, name: renameValue.trim() || f.name });
      setRenamingFolder(null);
      loadData();
    }
  }

  async function handleMoveSong(songId, targetFolderId) {
    const song = songs.find(s => s.id === songId);
    if (song) {
      await updateSong({ ...song, folderId: targetFolderId });
      setMovingSong(null);
      loadData();
    }
  }

  async function handleRedownload(song) {
    if (window.electronAPI?.saveFile) {
      const ext = song.audioUrl.match(/data:audio\/(\w+)/)?.[1] || 'mp3';
      await window.electronAPI.saveFile(song.audioUrl, `${song.title}.${ext}`);
    } else {
      const a = document.createElement('a');
      a.href = song.audioUrl;
      a.download = `${song.title}.mp3`;
      a.click();
    }
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const isDragging = draggingIds.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>SFX Manager</h1>
        <p className="subtitle">{songs.length} sound{songs.length !== 1 ? 's' : ''} &middot; Drag sounds onto folders to organize</p>
      </div>

      {/* Breadcrumb */}
      <div className="sfx-breadcrumb">
        <button
          className={`bread-item ${currentFolderId === null ? 'active' : ''}`}
          onClick={() => setCurrentFolderId(null)}
        >
          <IoHome /> All SFX
        </button>
        {breadcrumb.map(f => (
          <span key={f.id} className="bread-sep-group">
            <IoChevronForward className="bread-sep" />
            <button
              className={`bread-item ${currentFolderId === f.id ? 'active' : ''}`}
              onClick={() => setCurrentFolderId(f.id)}
            >
              <IoFolder style={{ color: f.color }} /> {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* Controls bar */}
      <div className="sfx-controls">
        <div className="sfx-search">
          <IoSearch className="sfx-search-icon" />
          <input type="text" placeholder="Search sounds..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="sfx-filters">
          {allCategories.length > 0 && (
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="sfx-select">
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {allTags.length > 0 && (
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="sfx-select">
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <div className="sfx-view-toggle">
          {playingId && (
            <button className="sfx-stop-btn" onClick={stopAll}><IoStopSharp /> Stop</button>
          )}
          {selectedIds.size > 0 && (
            <button className="toolbar-btn" onClick={() => setSelectedIds(new Set())}>
              Clear ({selectedIds.size})
            </button>
          )}
          <button className="toolbar-btn accent" onClick={() => setShowNewFolder(true)}>
            <IoAdd /> New Folder
          </button>
          <button className={`view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}><IoGrid /></button>
          <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><IoList /></button>
        </div>
      </div>

      {/* New folder bar */}
      {showNewFolder && (
        <div className="new-folder-bar">
          <input className="input" placeholder="Folder name..." value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} autoFocus />
          <div className="folder-colors">
            {FOLDER_COLORS.map(c => (
              <button key={c} className={`color-dot ${newFolderColor === c ? 'active' : ''}`}
                style={{ background: c }} onClick={() => setNewFolderColor(c)} />
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleCreateFolder}>Create</button>
          <button className="btn modal-btn-cancel" onClick={() => setShowNewFolder(false)}>Cancel</button>
        </div>
      )}

      {/* "Go up" drop zone when inside a folder and dragging */}
      {isDragging && currentFolderId !== null && (
        <div
          className={`drop-zone-up ${dropTargetId === '__parent__' ? 'drop-hover' : ''}`}
          onDragOver={e => handleFolderDragOver(e, '__parent__')}
          onDragLeave={e => handleFolderDragLeave(e, '__parent__')}
          onDrop={e => handleFolderDrop(e, parentFolderId)}
        >
          <IoArrowUp /> Drop here to move up one level
        </div>
      )}

      {/* Folders - act as drop targets */}
      {currentFolders.length > 0 && (
        <div className={`sfx-folders ${isDragging ? 'is-dragging' : ''}`}>
          {currentFolders.map(f => (
            <div
              key={f.id}
              className={`folder-card ${dropTargetId === f.id ? 'drop-hover' : ''}`}
              onClick={() => !isDragging && setCurrentFolderId(f.id)}
              onDragOver={e => handleFolderDragOver(e, f.id)}
              onDragLeave={e => handleFolderDragLeave(e, f.id)}
              onDrop={e => handleFolderDrop(e, f.id)}
            >
              <IoFolderOpen className="folder-card-icon" style={{ color: f.color }} />
              <div className="folder-card-info">
                {renamingFolder === f.id ? (
                  <input className="input input-sm" value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameFolder(f.id)}
                    onBlur={() => handleRenameFolder(f.id)}
                    onClick={e => e.stopPropagation()} autoFocus />
                ) : (
                  <span className="folder-card-name">{f.name}</span>
                )}
                <span className="folder-card-count">
                  {songs.filter(s => s.folderId === f.id).length} sounds
                </span>
              </div>
              {!isDragging && (
                <div className="folder-card-actions" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRenamingFolder(f.id); setRenameValue(f.name); }}><IoPencil /></button>
                  <button onClick={() => handleDeleteFolder(f.id)}><IoTrash /></button>
                </div>
              )}
              {isDragging && dropTargetId === f.id && (
                <span className="drop-badge">Drop here</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Songs */}
      {currentSongs.length === 0 && currentFolders.length === 0 ? (
        <div className="empty-state">
          <IoVolumeHigh className="empty-icon" />
          <p>{songs.length === 0
            ? 'No SFX yet. Go to Upload and mark files as SFX!'
            : currentFolderId
              ? 'This folder is empty. Drag some sounds in here!'
              : 'No sounds match your search.'
          }</p>
        </div>
      ) : view === 'grid' ? (
        <div className="sfx-grid">
          {currentSongs.map(song => {
            const isSelected = selectedIds.has(song.id);
            const isBeingDragged = draggingIds.includes(song.id);
            return (
              <div
                key={song.id}
                className={`sfx-card ${playingId === song.id ? 'playing' : ''} ${isSelected ? 'selected' : ''} ${isBeingDragged ? 'dragging' : ''}`}
                draggable
                onDragStart={e => handleDragStart(e, song.id)}
                onDragEnd={handleDragEnd}
                onClick={e => { if (e.ctrlKey || e.metaKey) toggleSelect(song.id, e); }}
              >
                <button className="sfx-play-btn" onClick={e => { e.stopPropagation(); quickPlay(song); }}>
                  {playingId === song.id ? <IoPauseSharp /> : <IoPlaySharp />}
                </button>
                <div className="sfx-card-info">
                  <span className="sfx-card-title">{song.title}</span>
                  <span className="sfx-card-meta">
                    {formatDuration(song.duration)}
                    {song.category && <span className="sfx-card-cat">{song.category}</span>}
                  </span>
                  <div className="sfx-card-tags">
                    {(song.tags || []).map(t => <span key={t} className="sfx-tag">{t}</span>)}
                  </div>
                </div>
                <div className="sfx-card-actions">
                  <button onClick={e => { e.stopPropagation(); setSfxEditing(song); }} title="Edit audio"><IoCut /></button>
                  <button onClick={e => { e.stopPropagation(); handleRedownload(song); }} title="Save to disk"><IoDownload /></button>
                  <button onClick={e => { e.stopPropagation(); setMovingSong(song); }} title="Move to folder"><IoMove /></button>
                  <button onClick={e => { e.stopPropagation(); setEditingSong(song); }} title="Edit details"><IoPricetag /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(song.id); }} title="Delete"><IoTrash /></button>
                </div>
                {isSelected && <div className="selected-badge" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sfx-list">
          {currentSongs.map(song => {
            const isSelected = selectedIds.has(song.id);
            const isBeingDragged = draggingIds.includes(song.id);
            return (
              <div
                key={song.id}
                className={`sfx-list-row ${playingId === song.id ? 'playing' : ''} ${isSelected ? 'selected' : ''} ${isBeingDragged ? 'dragging' : ''}`}
                draggable
                onDragStart={e => handleDragStart(e, song.id)}
                onDragEnd={handleDragEnd}
                onClick={e => { if (e.ctrlKey || e.metaKey) toggleSelect(song.id, e); }}
              >
                <button className="sfx-list-play" onClick={e => { e.stopPropagation(); quickPlay(song); }}>
                  {playingId === song.id ? <IoPauseSharp /> : <IoPlaySharp />}
                </button>
                <span className="sfx-list-title">{song.title}</span>
                <span className="sfx-list-cat">{song.category || '--'}</span>
                <div className="sfx-list-tags">
                  {(song.tags || []).map(t => <span key={t} className="sfx-tag">{t}</span>)}
                </div>
                <span className="sfx-list-dur">{formatDuration(song.duration)}</span>
                <div className="sfx-list-actions">
                  <button onClick={e => { e.stopPropagation(); setSfxEditing(song); }} title="Edit audio"><IoCut /></button>
                  <button onClick={e => { e.stopPropagation(); handleRedownload(song); }} title="Save"><IoDownload /></button>
                  <button onClick={e => { e.stopPropagation(); setMovingSong(song); }} title="Move"><IoMove /></button>
                  <button onClick={e => { e.stopPropagation(); setEditingSong(song); }} title="Edit"><IoPricetag /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(song.id); }} title="Delete"><IoTrash /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drag hint */}
      {selectedIds.size > 0 && !isDragging && (
        <div className="drag-hint">
          {selectedIds.size} selected &mdash; drag to a folder, or Ctrl+click more
        </div>
      )}

      {/* Move to folder modal */}
      {movingSong && (
        <div className="modal-overlay" onClick={() => setMovingSong(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Move "{movingSong.title}"</h3>
              <button className="modal-close" onClick={() => setMovingSong(null)}><IoClose /></button>
            </div>
            <div className="modal-list">
              <button className={`modal-playlist-row ${movingSong.folderId === null ? 'added' : ''}`}
                onClick={() => handleMoveSong(movingSong.id, null)}>
                <div className="modal-pl-icon"><IoHome /></div>
                <div className="modal-pl-info"><span className="modal-pl-name">Root (no folder)</span></div>
              </button>
              {folders.filter(f => f.type === 'sfx' || f.type === 'all').map(f => (
                <button key={f.id} className={`modal-playlist-row ${movingSong.folderId === f.id ? 'added' : ''}`}
                  onClick={() => handleMoveSong(movingSong.id, f.id)}>
                  <div className="modal-pl-icon"><IoFolder style={{ color: f.color }} /></div>
                  <div className="modal-pl-info">
                    <span className="modal-pl-name">{f.name}</span>
                    <span className="modal-pl-count">{songs.filter(s => s.folderId === f.id).length} sounds</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingSong && (
        <EditSongModal song={editingSong} onClose={() => setEditingSong(null)} onSaved={() => loadData()} />
      )}

      {sfxEditing && (
        <SFXEditor song={sfxEditing} onClose={() => setSfxEditing(null)} onSaved={() => { setSfxEditing(null); loadData(); }} />
      )}
    </div>
  );
}
