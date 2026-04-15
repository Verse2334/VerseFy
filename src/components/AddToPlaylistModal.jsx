import { useState, useEffect } from 'react';
import { getAllPlaylists, getPlaylist, updatePlaylist, createPlaylist } from '../utils/db';
import { IoClose, IoAdd, IoCheckmarkCircle, IoMusicalNotes } from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './AddToPlaylistModal.css';

export default function AddToPlaylistModal({ songIds, onClose }) {
  const [playlists, setPlaylists] = useState([]);
  const [newName, setNewName] = useState('');
  const [added, setAdded] = useState({});

  useEffect(() => {
    getAllPlaylists().then(setPlaylists);
  }, []);

  async function handleAdd(plId) {
    const pl = await getPlaylist(plId);
    if (!pl) return;
    let count = 0;
    for (const sid of songIds) {
      if (!pl.songIds.includes(sid)) {
        pl.songIds.push(sid);
        count++;
      }
    }
    await updatePlaylist(pl);
    setAdded(prev => ({ ...prev, [plId]: count }));
    setPlaylists(await getAllPlaylists());
  }

  async function handleCreateAndAdd() {
    const name = newName.trim() || `Playlist #${playlists.length + 1}`;
    const pl = { id: uuidv4(), name, songIds: [...songIds], createdAt: Date.now() };
    await createPlaylist(pl);
    setNewName('');
    setAdded(prev => ({ ...prev, [pl.id]: songIds.length }));
    setPlaylists(await getAllPlaylists());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add to Playlist</h3>
          <span className="modal-badge">{songIds.length} song{songIds.length !== 1 ? 's' : ''}</span>
          <button className="modal-close" onClick={onClose}><IoClose /></button>
        </div>

        <div className="modal-create">
          <input
            type="text"
            placeholder="Create new playlist..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
            className="modal-input"
          />
          <button className="modal-create-btn" onClick={handleCreateAndAdd}>
            <IoAdd />
          </button>
        </div>

        <div className="modal-list">
          {playlists.length === 0 ? (
            <div className="modal-empty">No playlists yet. Create one above!</div>
          ) : (
            playlists.map(pl => (
              <button
                key={pl.id}
                className={`modal-playlist-row ${added[pl.id] ? 'added' : ''}`}
                onClick={() => handleAdd(pl.id)}
              >
                <div className="modal-pl-icon">
                  {added[pl.id] ? <IoCheckmarkCircle /> : <IoMusicalNotes />}
                </div>
                <div className="modal-pl-info">
                  <span className="modal-pl-name">{pl.name}</span>
                  <span className="modal-pl-count">{pl.songIds.length} songs</span>
                </div>
                {added[pl.id] ? (
                  <span className="modal-pl-added">Added {added[pl.id]}</span>
                ) : (
                  <span className="modal-pl-add-label">Add</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
