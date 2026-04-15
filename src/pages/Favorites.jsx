import { useEffect, useState } from 'react';
import { getAllSongs, deleteCompletely } from '../utils/db';
import SongList from '../components/SongList';
import { IoHeart } from 'react-icons/io5';
import './Pages.css';

export default function Favorites() {
  const [songs, setSongs] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const all = await getAllSongs();
    setSongs(all.filter(s => s.favorite));
  }

  async function handleDelete(id) {
    await deleteCompletely(id);
    setSongs(prev => prev.filter(s => s.id !== id));
  }

  function handleSongUpdated(updated) {
    if (!updated.favorite) {
      setSongs(prev => prev.filter(s => s.id !== updated.id));
    } else {
      setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1><IoHeart style={{ color: '#ec4899', marginRight: 10 }} />Favorites</h1>
        <p className="subtitle">{songs.length} favorite{songs.length !== 1 ? 's' : ''}</p>
      </div>
      <SongList songs={songs} onDelete={handleDelete} onSongUpdated={handleSongUpdated} showTags />
    </div>
  );
}
