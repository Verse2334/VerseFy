import { useEffect, useMemo, useState, useRef } from 'react';
import { IoClose, IoChevronBack, IoChevronForward, IoShare, IoPlaySharp } from 'react-icons/io5';
import { getAllSongs } from '../utils/db';
import { getTopSongsForMonth, getTopArtistsForMonth, formatListenTime } from '../utils/listening';
import './Wrapped.css';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LONG_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Cycle background color themes per scene
const SCENE_COLORS = [
  { c1: '#8b5cf6', c2: '#ec4899', c3: '#3b82f6' },
  { c1: '#f59e0b', c2: '#ec4899', c3: '#8b5cf6' },
  { c1: '#06b6d4', c2: '#8b5cf6', c3: '#3b82f6' },
  { c1: '#22c55e', c2: '#06b6d4', c3: '#8b5cf6' },
  { c1: '#ec4899', c2: '#f59e0b', c3: '#8b5cf6' },
  { c1: '#8b5cf6', c2: '#3b82f6', c3: '#ec4899' },
];

export default function Wrapped({ stats, year, month, onClose }) {
  const [scene, setScene] = useState(0);
  const [songsById, setSongsById] = useState({});
  const totalScenes = 6;
  const rootRef = useRef(null);

  useEffect(() => {
    getAllSongs().then(list => {
      const m = {};
      for (const s of list) m[s.id] = s;
      setSongsById(m);
    });
  }, []);

  const totalSec = stats?.totalSec || 0;
  const totalMin = Math.round(totalSec / 60);
  const totalHours = Math.round((totalSec / 3600) * 10) / 10;
  const songsPlayed = stats?.songs ? Object.keys(stats.songs).length : 0;
  const sessions = stats?.sessions || 0;

  const topSongs = useMemo(() => getTopSongsForMonth(stats, songsById, 5), [stats, songsById]);
  const topArtists = useMemo(() => getTopArtistsForMonth(stats, 5), [stats]);
  const topSong = topSongs[0];
  const topArtist = topArtists[0];

  // Derive a "vibe" based on avg energy proxy (play duration / play count)
  const vibe = useMemo(() => {
    if (!stats?.days) return 'Listener';
    const dayValues = Object.values(stats.days);
    if (!dayValues.length) return 'Listener';
    const avgPerDay = dayValues.reduce((a, b) => a + b, 0) / dayValues.length;
    if (avgPerDay > 7200) return 'Music Obsessed';
    if (avgPerDay > 3600) return 'Deep Listener';
    if (avgPerDay > 1800) return 'Daily Vibes';
    if (avgPerDay > 600) return 'Casual Cruiser';
    return 'Quiet Fan';
  }, [stats]);

  // Auto-advance scenes every 6s
  useEffect(() => {
    const t = setTimeout(() => {
      if (scene < totalScenes - 1) setScene(scene + 1);
    }, 6000);
    return () => clearTimeout(t);
  }, [scene]);

  // Apply scene colors as CSS vars
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const c = SCENE_COLORS[scene % SCENE_COLORS.length];
    el.style.setProperty('--wr-c1', c.c1);
    el.style.setProperty('--wr-c2', c.c2);
    el.style.setProperty('--wr-c3', c.c3);
  }, [scene]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') setScene(s => Math.min(totalScenes - 1, s + 1));
      else if (e.key === 'ArrowLeft') setScene(s => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasData = totalSec > 0;
  const monthLabel = LONG_MONTH_NAMES[month - 1] + ' ' + year;

  // Particle seeds
  const particles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 10,
    dur: 8 + Math.random() * 12,
    size: 2 + Math.random() * 3,
    key: i,
  })), []);

  return (
    <div className="wrapped-overlay" ref={rootRef}>
      <div className="wrapped-bg" />
      <div className="wrapped-particles">
        {particles.map(p => (
          <div
            key={p.key}
            className="wrapped-particle"
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="wrapped-progress">
        {Array.from({ length: totalScenes }).map((_, i) => (
          <div
            key={i}
            className={`wrapped-progress-seg ${i < scene ? 'done' : i === scene ? 'active' : ''}`}
          />
        ))}
      </div>

      <button className="wrapped-close" onClick={onClose}><IoClose /></button>

      {/* Scene key forces fresh animation on change */}
      <div className="wrapped-scene" key={scene}>
        {!hasData && (
          <div className="wr-empty">
            <span className="wr-label">Not enough data yet</span>
            <p style={{ maxWidth: 400 }}>
              Keep listening this month and come back here at the end of {LONG_MONTH_NAMES[month - 1]}
              to see your Wrapped.
            </p>
          </div>
        )}

        {hasData && scene === 0 && (
          <>
            <h1 className="wr-intro-title">{monthLabel}</h1>
            <p className="wr-intro-sub">Your month in music, wrapped.</p>
            <div className="wr-caption">Here's what you listened to, who you loved, and the vibes you lived in.</div>
          </>
        )}

        {hasData && scene === 1 && (
          <>
            <div className="wr-label">You listened for</div>
            <div className="wr-big-num">{totalHours < 1 ? totalMin : totalHours}</div>
            <div className="wr-big-sub">{totalHours < 1 ? 'minutes' : `hours${totalHours >= 10 ? '' : ''}`}</div>
            <div className="wr-caption">
              Across {sessions || 1} listening session{(sessions || 1) === 1 ? '' : 's'}, you spent {formatListenTime(totalSec)} with your music.
            </div>
          </>
        )}

        {hasData && scene === 2 && topSong && (
          <>
            <div className="wr-label">Your top song</div>
            <div className="wr-top-song">
              <div className="wr-top-artwork">
                {topSong.song.artwork ? (
                  <img src={topSong.song.artwork} alt="" />
                ) : (
                  <div className="wr-top-artwork-placeholder"><IoPlaySharp /></div>
                )}
              </div>
              <h2 className="wr-top-title">{topSong.song.title}</h2>
              <p className="wr-top-artist">{topSong.song.artist || 'Unknown Artist'}</p>
              <div className="wr-top-plays">{formatListenTime(topSong.sec)} on repeat</div>
            </div>
          </>
        )}

        {hasData && scene === 3 && (
          <>
            <div className="wr-label">Top 5 songs</div>
            <ol className="wr-list">
              {topSongs.map((t, i) => (
                <li key={t.song.id}>
                  <div className="wr-rank">{i + 1}</div>
                  <div className="wr-li-art">
                    {t.song.artwork ? <img src={t.song.artwork} alt="" /> : <div className="wr-li-art-ph" />}
                  </div>
                  <div className="wr-li-info">
                    <div className="wr-li-title">{t.song.title}</div>
                    <div className="wr-li-artist">{t.song.artist || 'Unknown'}</div>
                  </div>
                  <div className="wr-li-meta">{formatListenTime(t.sec)}</div>
                </li>
              ))}
            </ol>
          </>
        )}

        {hasData && scene === 4 && (
          <>
            <div className="wr-label">Your top artists</div>
            <ol className="wr-list">
              {topArtists.map((a, i) => (
                <li key={a.name}>
                  <div className="wr-rank">{i + 1}</div>
                  <div className="wr-li-art"><div className="wr-li-art-ph" /></div>
                  <div className="wr-li-info">
                    <div className="wr-li-title">{a.name}</div>
                    <div className="wr-li-artist">{formatListenTime(a.sec)} listened</div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {hasData && scene === 5 && (
          <>
            <div className="wr-label">Your {monthLabel} vibe</div>
            <h1 className="wr-intro-title">{vibe}</h1>
            <div className="wr-share-card">
              <div className="wr-share-stat">
                <strong>{totalHours < 1 ? totalMin + 'm' : totalHours + 'h'}</strong>
                <span>Listened</span>
              </div>
              <div className="wr-share-stat">
                <strong>{songsPlayed}</strong>
                <span>Songs</span>
              </div>
              <div className="wr-share-stat">
                <strong>{topArtist?.name ? topArtist.name.slice(0, 12) : '—'}</strong>
                <span>Top Artist</span>
              </div>
            </div>
            <p className="wr-caption">Thanks for spending {monthLabel} with Versefy.</p>
          </>
        )}
      </div>

      <div className="wrapped-nav">
        <button className="wrapped-nav-btn" disabled={scene === 0} onClick={() => setScene(s => Math.max(0, s - 1))}>
          <IoChevronBack /> Back
        </button>
        {scene < totalScenes - 1 ? (
          <button className="wrapped-nav-btn primary" onClick={() => setScene(s => Math.min(totalScenes - 1, s + 1))}>
            Next <IoChevronForward />
          </button>
        ) : (
          <button className="wrapped-nav-btn primary" onClick={onClose}>Done</button>
        )}
      </div>
    </div>
  );
}
