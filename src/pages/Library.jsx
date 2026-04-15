import { useEffect, useState, useMemo } from 'react';
import { getAllSongs, deleteCompletely, getAllFolders, createFolder, deleteFolder, updateFolder, updateSong } from '../utils/db';
import SongList from '../components/SongList';
import {
  IoSwapVertical, IoFolderOpen, IoFolder, IoAdd,
  IoChevronForward, IoPencil, IoTrash, IoHome
} from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './Pages.css';

const FOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#1db954', '#ff9800', '#e91e63', '#06b6d4', '#f43f5e', '#eab308'];

export default function Library() {
  const [songs, setSongs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [sortBy, setSortBy] = useState('addedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allSongs, allFolders] = await Promise.all([getAllSongs(), getAllFolders()]);
    setSongs(allSongs);
    setFolders(allFolders.filter(f => f.type === 'music' || f.type === 'all'));
  }

  async function handleDelete(id) {
    await deleteCompletely(id);
    setSongs(prev => prev.filter(s => s.id !== id));
  }

  function handleSongUpdated(updated) {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim() || `Folder ${folders.length + 1}`;
    await createFolder({
      id: uuidv4(),
      name,
      parentId: currentFolderId,
      type: 'music',
      color: newFolderColor,
      createdAt: Date.now(),
    });
    setNewFolderName('');
    setShowNewFolder(false);
    loadData();
  }

  async function handleDeleteFolder(id) {
    await deleteFolder(id);
    if (currentFolderId === id) setCurrentFolderId(null);
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

  const currentFolders = useMemo(() =>
    folders.filter(f => f.parentId === currentFolderId),
    [folders, currentFolderId]
  );

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

  const categories = useMemo(() => {
    const set = new Set();
    songs.forEach(s => s.category && set.add(s.category));
    return [...set].sort();
  }, [songs]);

  const filtered = useMemo(() => {
    let list = songs.filter(s => s.folderId === currentFolderId);
    if (filterType !== 'all') list = list.filter(s => s.type === filterType);
    if (filterCategory) list = list.filter(s => s.category === filterCategory);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title') cmp = (a.title || '').localeCompare(b.title || '');
      else if (sortBy === 'artist') cmp = (a.artist || '').localeCompare(b.artist || '');
      else if (sortBy === 'duration') cmp = (a.duration || 0) - (b.duration || 0);
      else cmp = (a.addedAt || 0) - (b.addedAt || 0);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [songs, currentFolderId, filterType, filterCategory, sortBy, sortDir]);

  const totalInFolder = songs.filter(s => s.folderId === currentFolderId).length;
  const musicCount = songs.filter(s => s.type !== 'sfx').length;
  const sfxCount = songs.filter(s => s.type === 'sfx').length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your Library</h1>
        <p className="subtitle">
          {songs.length} total &middot; {musicCount} music &middot; {sfxCount} SFX
        </p>
      </div>

      {/* Breadcrumb */}
      <div className="sfx-breadcrumb">
        <button
          className={`bread-item ${currentFolderId === null ? 'active' : ''}`}
          onClick={() => setCurrentFolderId(null)}
        >
          <IoHome /> All Files
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

      {/* Filters & Sort */}
      <div className="library-controls">
        <div className="library-filters">
          <button className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All</button>
          <button className={`filter-chip ${filterType === 'music' ? 'active' : ''}`} onClick={() => setFilterType('music')}>Music</button>
          <button className={`filter-chip ${filterType === 'sfx' ? 'active' : ''}`} onClick={() => setFilterType('sfx')}>SFX</button>

          {categories.length > 0 && (
            <select className="library-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <button className="toolbar-btn accent" onClick={() => setShowNewFolder(true)}>
            <IoAdd /> New Folder
          </button>
        </div>

        <div className="library-sort">
          <IoSwapVertical />
          <select className="library-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="addedAt">Date Added</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="duration">Duration</option>
          </select>
          <button
            className="sort-dir-btn"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* New folder bar */}
      {showNewFolder && (
        <div className="new-folder-bar">
          <input
            className="input"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <div className="folder-colors">
            {FOLDER_COLORS.map(c => (
              <button
                key={c}
                className={`color-dot ${newFolderColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setNewFolderColor(c)}
              />
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleCreateFolder}>Create</button>
          <button className="btn modal-btn-cancel" onClick={() => setShowNewFolder(false)}>Cancel</button>
        </div>
      )}

      {/* Folders */}
      {currentFolders.length > 0 && (
        <div className="sfx-folders">
          {currentFolders.map(f => (
            <div key={f.id} className="folder-card" onClick={() => setCurrentFolderId(f.id)}>
              <IoFolderOpen className="folder-card-icon" style={{ color: f.color }} />
              <div className="folder-card-info">
                {renamingFolder === f.id ? (
                  <input
                    className="input input-sm"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameFolder(f.id)}
                    onBlur={() => handleRenameFolder(f.id)}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="folder-card-name">{f.name}</span>
                )}
                <span className="folder-card-count">
                  {songs.filter(s => s.folderId === f.id).length} items
                </span>
              </div>
              <div className="folder-card-actions" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setRenamingFolder(f.id); setRenameValue(f.name); }}>
                  <IoPencil />
                </button>
                <button onClick={() => handleDeleteFolder(f.id)}>
                  <IoTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SongList
        songs={filtered}
        onDelete={handleDelete}
        onSongUpdated={handleSongUpdated}
        showTags
      />
    </div>
  );
}
