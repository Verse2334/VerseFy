import { useEffect, useState, useMemo } from 'react';
import { getAllSongs, getAllPlaylists, getPlaylist, updatePlaylist } from '../utils/db';
import SongList from '../components/SongList';
import { IoSearch } from 'react-icons/io5';
import './Pages.css';

export default function Search() {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([getAllSongs(), getAllPlaylists()]).then(([s, p]) => {
      setSongs(s);
      setPlaylists(p);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return songs;
    const q = query.toLowerCase();
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.artist && s.artist.toLowerCase().includes(q))
    );
  }, [songs, query]);

  async function handleAddToPlaylist(playlistId, songId) {
    const pl = await getPlaylist(playlistId);
    if (pl && !pl.songIds.includes(songId)) {
      pl.songIds.push(songId);
      await updatePlaylist(pl);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Search</h1>
      </div>

      <div className="search-bar">
        <IoSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search songs, artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
          autoFocus
        />
      </div>

      <div className="search-results">
        {query.trim() && (
          <p className="results-count">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
        <SongList
          songs={filtered}
          playlists={playlists}
          onAddToPlaylist={handleAddToPlaylist}
        />
      </div>
    </div>
  );
}
