import { useEffect, useState, useRef } from 'react';
import { getAllSongs, getAllPlaylists, createPlaylist, updatePlaylist } from '../utils/db';
import { usePlayer } from '../context/PlayerContext';
import { IoPlay, IoTrophy, IoTime, IoMusicalNote, IoRibbon, IoImage, IoList, IoTimer, IoSparkles, IoCalendar } from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import { getLifetimeSec, migrateLegacyListening, getWrappedWindowStatus } from '../utils/listening';
import Wrapped from '../components/Wrapped';
import './Pages.css';
import './Stats.css';

const ACHIEVEMENTS = [
  { id: 'first_play', name: 'First Beat', desc: 'Play your first song', icon: '🎵', check: (s) => s.totalPlays >= 1 },
  { id: 'plays_50', name: 'Getting Started', desc: 'Reach 50 total plays', icon: '🎶', check: (s) => s.totalPlays >= 50 },
  { id: 'plays_100', name: 'Centurion', desc: 'Reach 100 total plays', icon: '💯', check: (s) => s.totalPlays >= 100 },
  { id: 'plays_500', name: 'Dedicated Listener', desc: 'Reach 500 total plays', icon: '🔥', check: (s) => s.totalPlays >= 500 },
  { id: 'plays_1000', name: 'Thousand Club', desc: 'Reach 1,000 total plays', icon: '👑', check: (s) => s.totalPlays >= 1000 },
  { id: 'hour_1', name: 'One Hour In', desc: 'Listen for 1 hour total', icon: '⏰', check: (s) => s.totalMinutes >= 60 },
  { id: 'hour_10', name: 'Marathon Listener', desc: 'Listen for 10 hours total', icon: '🎧', check: (s) => s.totalMinutes >= 600 },
  { id: 'hour_24', name: 'Full Day', desc: 'Listen for 24 hours total', icon: '🌟', check: (s) => s.totalMinutes >= 1440 },
  { id: 'hour_100', name: 'Obsessed', desc: 'Listen for 100 hours total', icon: '💎', check: (s) => s.totalMinutes >= 6000 },
  { id: 'songs_10', name: 'Collector', desc: 'Have 10 songs in library', icon: '📀', check: (s) => s.totalSongs >= 10 },
  { id: 'songs_50', name: 'Hoarder', desc: 'Have 50 songs in library', icon: '📚', check: (s) => s.totalSongs >= 50 },
  { id: 'songs_100', name: 'Music Library', desc: 'Have 100 songs in library', icon: '🏛️', check: (s) => s.totalSongs >= 100 },
  { id: 'fav_10', name: 'Picky Listener', desc: 'Favorite 10 songs', icon: '❤️', check: (s) => s.favorites >= 10 },
  { id: 'rated_20', name: 'Critic', desc: 'Rate 20 songs', icon: '⭐', check: (s) => s.rated >= 20 },
  { id: 'one_song_50', name: 'On Repeat', desc: 'Play one song 50 times', icon: '🔁', check: (s) => s.maxSinglePlays >= 50 },
];

export default function Stats() {
  const [songs, setSongs] = useState([]);
  const { playSong } = usePlayer();
  const canvasRef = useRef(null);
  const [wrapped, setWrapped] = useState(null); // { stats, year, month } or null

  useEffect(() => {
    getAllSongs().then(list => {
      setSongs(list);
      // One-time migration: seed legacy listening from old playCount × duration
      migrateLegacyListening(list);
    });
  }, []);

  const totalPlays = songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
  const safeDur = (d) => (d && isFinite(d) && d > 0) ? d : 0;
  // Real listen time (only counted while playing) — lifetime across all months
  const lifetimeSec = getLifetimeSec();
  const totalMinutes = Math.round(lifetimeSec / 60);
  const wrappedWindow = getWrappedWindowStatus();
  const topSongs = [...songs].filter(s => s.playCount > 0).sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 15);
  const topArtists = {};
  songs.forEach(s => {
    const artist = s.artist || 'Unknown';
    topArtists[artist] = (topArtists[artist] || 0) + (s.playCount || 0);
  });
  const artistList = Object.entries(topArtists).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxPlays = topSongs[0]?.playCount || 1;

  // Achievement stats
  const achStats = {
    totalPlays,
    totalMinutes,
    totalSongs: songs.length,
    favorites: songs.filter(s => s.favorite).length,
    rated: songs.filter(s => (s.rating || 0) > 0).length,
    maxSinglePlays: Math.max(0, ...songs.map(s => s.playCount || 0)),
  };
  const unlocked = ACHIEVEMENTS.filter(a => a.check(achStats));
  const locked = ACHIEVEMENTS.filter(a => !a.check(achStats));

  function formatTime(date) {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  function formatDuration(sec) {
    if (!sec) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  // Auto-playlist generation
  async function generateAutoPlaylist(type) {
    let name, songIds;
    if (type === 'most-played') {
      name = 'Most Played';
      songIds = [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 25).map(s => s.id);
    } else if (type === 'recently-added') {
      name = 'Recently Added';
      songIds = [...songs].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 25).map(s => s.id);
    } else if (type === 'top-rated') {
      name = 'Top Rated';
      songIds = [...songs].filter(s => (s.rating || 0) >= 4).sort((a, b) => (b.rating || 0) - (a.rating || 0)).map(s => s.id);
    } else if (type === 'unplayed') {
      name = 'Unplayed';
      songIds = songs.filter(s => !s.playCount || s.playCount === 0).map(s => s.id);
    } else if (type === 'favorites') {
      name = 'All Favorites';
      songIds = songs.filter(s => s.favorite).map(s => s.id);
    }
    if (!songIds || songIds.length === 0) { alert('No songs match this criteria'); return; }

    // Check if playlist exists, update it; otherwise create
    const playlists = await getAllPlaylists();
    const existing = playlists.find(p => p.name === name);
    if (existing) {
      existing.songIds = songIds;
      await updatePlaylist(existing);
    } else {
      await createPlaylist({ id: uuidv4(), name, songIds, createdAt: Date.now() });
    }
    alert(`"${name}" playlist created with ${songIds.length} songs!`);
  }

  // Profile card export
  async function exportProfileCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 500, H = 300;
    canvas.width = W; canvas.height = H;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f0520');
    grad.addColorStop(0.5, '#1a0a30');
    grad.addColorStop(1, '#0a0515');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, W - 8, H - 8, 16);
    ctx.stroke();

    const name = localStorage.getItem('versefy-username') || 'User';

    // Title
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText(name, 24, 44);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.8)'; ctx.font = '12px Inter, sans-serif';
    ctx.fillText('VERSEFY PROFILE', 24, 62);

    // Stats
    ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText(String(totalPlays), 24, 110);
    ctx.fillStyle = '#888'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText('PLAYS', 24, 126);

    const hours = Math.floor(totalMinutes / 60);
    ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText(`${hours}h`, 160, 110);
    ctx.fillStyle = '#888'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText('LISTENED', 160, 126);

    ctx.fillStyle = '#c4b5fd'; ctx.font = 'bold 32px Inter, sans-serif';
    ctx.fillText(String(songs.length), 280, 110);
    ctx.fillStyle = '#888'; ctx.font = '11px Inter, sans-serif';
    ctx.fillText('SONGS', 280, 126);

    // Top 5 songs
    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('TOP SONGS', 24, 160);
    topSongs.slice(0, 5).forEach((s, i) => {
      ctx.fillStyle = '#ddd'; ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`${i + 1}. ${s.title.slice(0, 35)}`, 24, 180 + i * 18);
      ctx.fillStyle = '#666';
      ctx.fillText(`${s.playCount} plays`, 380, 180 + i * 18);
    });

    // Achievements count
    ctx.fillStyle = '#4ade80'; ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(`${unlocked.length}/${ACHIEVEMENTS.length} ACHIEVEMENTS`, 24, 285);

    // Watermark
    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)'; ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('versefy', W - 16, H - 10);
    ctx.textAlign = 'left';

    // Download
    const link = document.createElement('a');
    link.download = `versefy-profile-${name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Stats</h1>
        <p className="subtitle">Your listening stats</p>
      </div>

      {/* Monthly Wrapped — only viewable within 3 days before/after month-end */}
      {wrappedWindow.open && (
        <section className="stats-section wrapped-launcher-sec">
          <h2><IoSparkles style={{ color: '#fbbf24' }} /> Monthly Wrapped</h2>
          <p className="stats-section-desc">
            {wrappedWindow.kind === 'preview'
              ? 'Your month is wrapping up — here\'s an early look at your Wrapped.'
              : 'Your Wrapped for last month is ready! Available for a few days only.'}
          </p>
          <div className="wrapped-launchers">
            <button
              className="wrapped-launch-btn primary"
              onClick={() => setWrapped({ stats: wrappedWindow.stats, year: wrappedWindow.year, month: wrappedWindow.month })}
              disabled={!wrappedWindow.stats?.totalSec}
            >
              <IoSparkles /> Open {wrappedWindow.kind === 'preview' ? 'this' : 'last'} month's Wrapped
            </button>
          </div>
          <p className="wrapped-window-hint">
            <IoCalendar /> Viewable only from the last 3 days of a month through the first 3 days of the next.
          </p>
        </section>
      )}

      <div className="stats-cards">
        <div className="stats-card">
          <IoPlay className="stats-card-icon" />
          <div className="stats-card-num">{totalPlays}</div>
          <div className="stats-card-label">Total Plays</div>
        </div>
        <div className="stats-card">
          <IoTime className="stats-card-icon time" />
          <div className="stats-card-num">{totalMinutes < 60 ? `${totalMinutes}m` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}</div>
          <div className="stats-card-label">Time Listened</div>
        </div>
        <div className="stats-card">
          <IoMusicalNote className="stats-card-icon songs" />
          <div className="stats-card-num">{songs.filter(s => s.playCount > 0).length}</div>
          <div className="stats-card-label">Songs Played</div>
        </div>
      </div>

      {/* Auto-Playlists */}
      <section className="stats-section">
        <h2><IoList /> Auto-Playlists</h2>
        <p className="stats-section-desc">Generate playlists automatically from your listening data</p>
        <div className="auto-playlist-grid">
          <button className="auto-playlist-btn" onClick={() => generateAutoPlaylist('most-played')}>Most Played</button>
          <button className="auto-playlist-btn" onClick={() => generateAutoPlaylist('recently-added')}>Recently Added</button>
          <button className="auto-playlist-btn" onClick={() => generateAutoPlaylist('top-rated')}>Top Rated</button>
          <button className="auto-playlist-btn" onClick={() => generateAutoPlaylist('unplayed')}>Unplayed</button>
          <button className="auto-playlist-btn" onClick={() => generateAutoPlaylist('favorites')}>All Favorites</button>
        </div>
      </section>

      {/* Achievements */}
      <section className="stats-section">
        <h2><IoRibbon style={{ color: '#fbbf24' }} /> Achievements ({unlocked.length}/{ACHIEVEMENTS.length})</h2>
        <div className="achievements-grid">
          {unlocked.map(a => (
            <div key={a.id} className="achievement unlocked">
              <span className="achievement-icon">{a.icon}</span>
              <div className="achievement-info">
                <span className="achievement-name">{a.name}</span>
                <span className="achievement-desc">{a.desc}</span>
              </div>
            </div>
          ))}
          {locked.map(a => (
            <div key={a.id} className="achievement locked">
              <span className="achievement-icon locked-icon">🔒</span>
              <div className="achievement-info">
                <span className="achievement-name">{a.name}</span>
                <span className="achievement-desc">{a.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Profile Card Export */}
      <section className="stats-section">
        <h2><IoImage /> Profile Card</h2>
        <p className="stats-section-desc">Export a shareable image of your stats</p>
        <button className="auto-playlist-btn" onClick={exportProfileCard}><IoImage /> Export Profile Card</button>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </section>

      {/* Song Timer — per-song listen time */}
      {topSongs.length > 0 && (
        <section className="stats-section">
          <h2><IoTimer /> Song Timer</h2>
          <p className="stats-section-desc">Total time spent on each song</p>
          <div className="stats-list">
            {topSongs.map((song, i) => {
              const totalSec = (song.playCount || 0) * safeDur(song.duration);
              return (
                <div key={song.id} className="stats-row" onClick={() => {
                  const idx = songs.findIndex(s => s.id === song.id);
                  if (idx >= 0) playSong(songs, idx);
                }}>
                  <span className="stats-rank">#{i + 1}</span>
                  <div className="stats-bar-wrap">
                    <div className="stats-bar" style={{ width: `${(song.playCount / maxPlays) * 100}%` }} />
                    <div className="stats-row-info">
                      <span className="stats-row-title">{song.title}</span>
                      <span className="stats-row-artist">{song.artist || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="stats-row-meta">
                    <span className="stats-row-count">{formatDuration(totalSec)}</span>
                    <span className="stats-row-last">{song.playCount} plays</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Most Played (original) */}
      {topSongs.length > 0 && (
        <section className="stats-section">
          <h2><IoTrophy style={{ color: '#eab308' }} /> Most Played Songs</h2>
          <div className="stats-list">
            {topSongs.map((song, i) => (
              <div key={song.id} className="stats-row" onClick={() => {
                const idx = songs.findIndex(s => s.id === song.id);
                if (idx >= 0) playSong(songs, idx);
              }}>
                <span className="stats-rank">#{i + 1}</span>
                <div className="stats-bar-wrap">
                  <div className="stats-bar" style={{ width: `${(song.playCount / maxPlays) * 100}%` }} />
                  <div className="stats-row-info">
                    <span className="stats-row-title">{song.title}</span>
                    <span className="stats-row-artist">{song.artist || 'Unknown'}</span>
                  </div>
                </div>
                <div className="stats-row-meta">
                  <span className="stats-row-count">{song.playCount} plays</span>
                  <span className="stats-row-last">{formatTime(song.lastPlayed)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {artistList.length > 0 && (
        <section className="stats-section">
          <h2>Top Artists</h2>
          <div className="stats-artist-list">
            {artistList.map(([name, count], i) => (
              <div key={name} className="stats-artist-row">
                <span className="stats-rank">#{i + 1}</span>
                <span className="stats-artist-name">{name}</span>
                <span className="stats-artist-count">{count} plays</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {topSongs.length === 0 && (
        <div className="empty-state">
          <IoPlay className="empty-icon" />
          <p>No play data yet. Start listening to see your stats!</p>
        </div>
      )}

      {wrapped && (
        <Wrapped
          stats={wrapped.stats}
          year={wrapped.year}
          month={wrapped.month}
          onClose={() => setWrapped(null)}
        />
      )}
    </div>
  );
}
