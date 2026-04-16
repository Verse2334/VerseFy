import { useEffect, useState } from 'react';
import { getAllSongs, getRecentlyPlayed, getAllPlaylists } from '../utils/db';
import { usePlayer } from '../context/PlayerContext';
import SongList from '../components/SongList';
import { useNavigate } from 'react-router-dom';
import { IoPlaySharp, IoTimeOutline, IoCloudUpload, IoMusicalNotes, IoVolumeHigh } from 'react-icons/io5';
import './Pages.css';

export default function Home() {
  const [songs, setSongs] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const { playSong } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [allSongs, recent, pls] = await Promise.all([
      getAllSongs(),
      getRecentlyPlayed(),
      getAllPlaylists(),
    ]);

    setSongs(allSongs);
    setPlaylists(pls);

    const recentIds = recent.map(r => r.id);
    const recents = recentIds
      .map(id => allSongs.find(s => s.id === id))
      .filter(Boolean)
      .slice(0, 8);
    setRecentSongs(recents);
  }

  function handleSongUpdated(updated) {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  const greeting = (() => {
    const h = new Date().getHours();
    const name = localStorage.getItem('versefy-username');
    const suffix = name && name !== 'User' ? `, ${name}` : '';
    if (h < 12) return `Good morning${suffix}`;
    if (h < 18) return `Good afternoon${suffix}`;
    return `Good evening${suffix}`;
  })();

  const musicSongs = songs.filter(s => s.type !== 'sfx');
  const sfxCount = songs.filter(s => s.type === 'sfx').length;

  return (
    <div className="page page-home">
      <div className="page-header">
        <h1>{greeting}</h1>
        <p className="subtitle">Your personal music &amp; sound library</p>
      </div>

      {/* Quick stats */}
      {songs.length > 0 && (
        <div className="home-stats">
          <div className="stat-card" onClick={() => navigate('/library')}>
            <IoMusicalNotes className="stat-icon" />
            <div>
              <span className="stat-number">{musicSongs.length}</span>
              <span className="stat-label">Songs</span>
            </div>
          </div>
          <div className="stat-card" onClick={() => navigate('/sfx')}>
            <IoVolumeHigh className="stat-icon sfx" />
            <div>
              <span className="stat-number">{sfxCount}</span>
              <span className="stat-label">SFX</span>
            </div>
          </div>
          <div className="stat-card" onClick={() => navigate('/playlists')}>
            <IoMusicalNotes className="stat-icon playlist" />
            <div>
              <span className="stat-number">{playlists.length}</span>
              <span className="stat-label">Playlists</span>
            </div>
          </div>
          <div className="stat-card" onClick={() => navigate('/upload')}>
            <IoCloudUpload className="stat-icon upload" />
            <div>
              <span className="stat-label">Upload</span>
            </div>
          </div>
        </div>
      )}

      {recentSongs.length > 0 && (
        <section className="section">
          <h2 className="section-title">
            <IoTimeOutline /> Recently Played
          </h2>
          <div className="quick-play-grid">
            {recentSongs.map((song, idx) => (
              <div
                key={song.id}
                className="quick-play-card"
                onClick={() => playSong(recentSongs, idx)}
              >
                {song.artwork ? (
                  <img src={song.artwork} alt="" className="qp-artwork" />
                ) : (
                  <div className="qp-artwork-placeholder" />
                )}
                <div className="qp-info">
                  <span className="qp-title">{song.title}</span>
                  <span className="qp-artist">{song.artist || 'Unknown'}</span>
                </div>
                <button className="qp-play">
                  <IoPlaySharp />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">All Music</h2>
        <SongList
          songs={musicSongs}
          onSongUpdated={handleSongUpdated}
          showTags
        />
      </section>
    </div>
  );
}
