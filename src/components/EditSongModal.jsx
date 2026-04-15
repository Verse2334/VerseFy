import { useState, useEffect } from 'react';
import { updateSong, getAllFolders } from '../utils/db';
import { IoClose, IoAdd } from 'react-icons/io5';
import './AddToPlaylistModal.css';

const CATEGORIES = [
  '', 'Music', 'SFX', 'Ambient', 'Vocal', 'Beat', 'Loop', 'Sample',
  'Notification', 'UI Sound', 'Foley', 'Transition', 'Other',
];

export default function EditSongModal({ song, onClose, onSaved }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist || '');
  const [category, setCategory] = useState(song.category || '');
  const [type, setType] = useState(song.type || 'music');
  const [folderId, setFolderId] = useState(song.folderId || '');
  const [tags, setTags] = useState(song.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    getAllFolders().then(setFolders);
  }, []);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  }

  function removeTag(tag) {
    setTags(tags.filter(t => t !== tag));
  }

  async function handleSave() {
    const updated = { ...song, title, artist, category, type, tags, folderId: folderId || null };
    await updateSong(updated);
    onSaved?.(updated);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Details</h3>
          <button className="modal-close" onClick={onClose}><IoClose /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="modal-field">
            <label>Artist</label>
            <input value={artist} onChange={e => setArtist(e.target.value)} />
          </div>

          <div className="modal-field">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="music">Music</option>
              <option value="sfx">SFX / Sound Effect</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c || '-- None --'}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label>Folder</label>
            <select value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">-- No Folder (Root) --</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label>Tags</label>
            <div className="modal-tags">
              {tags.map(t => (
                <span key={t} className="modal-tag">
                  {t}
                  <button onClick={() => removeTag(t)}><IoClose /></button>
                </span>
              ))}
            </div>
            <div className="modal-tag-input">
              <input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button className="modal-tag-add" onClick={addTag}><IoAdd /> Add</button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
