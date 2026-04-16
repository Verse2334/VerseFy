import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { IoMusicalNote } from 'react-icons/io5';
import './SongToast.css';

export default function SongToast() {
  const { currentSong, isPlaying } = usePlayer();
  const [visible, setVisible] = useState(false);
  const [song, setSong] = useState(null);
  const timerRef = useRef(null);
  const lastIdRef = useRef(null);

  useEffect(() => {
    if (localStorage.getItem('versefy-song-toast') === 'false') return;
    if (!currentSong || currentSong.id === lastIdRef.current) return;
    lastIdRef.current = currentSong.id;

    setSong(currentSong);
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentSong]);

  if (!visible || !song) return null;

  return (
    <div className={`song-toast ${visible ? 'show' : ''}`}>
      <div className="song-toast-art">
        {song.artwork ? (
          <img src={song.artwork} alt="" />
        ) : (
          <div className="song-toast-art-placeholder"><IoMusicalNote /></div>
        )}
      </div>
      <div className="song-toast-info">
        <span className="song-toast-label">Now Playing</span>
        <span className="song-toast-title">{song.title}</span>
        <span className="song-toast-artist">{song.artist || 'Unknown Artist'}</span>
      </div>
    </div>
  );
}
