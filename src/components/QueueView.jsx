import { usePlayer } from '../context/PlayerContext';
import { IoClose, IoMusicalNotes, IoPlaySharp } from 'react-icons/io5';
import './QueueView.css';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueueView({ isOpen, onClose }) {
  const {
    queue, currentIndex, currentSong, isPlaying, isShuffled, shuffleOrder, playSong,
  } = usePlayer();

  const displayQueue = isShuffled
    ? shuffleOrder.map(i => queue[i]).filter(Boolean)
    : queue;

  const currentRealIndex = isShuffled
    ? (shuffleOrder[currentIndex] ?? -1)
    : currentIndex;

  function handleSongClick(displayIndex) {
    const song = displayQueue[displayIndex];
    if (!song) return;
    const realIndex = isShuffled
      ? shuffleOrder[displayIndex]
      : displayIndex;
    playSong(queue, realIndex);
  }

  return (
    <div className={`queue-panel ${isOpen ? 'open' : ''}`}>
      <div className="queue-header">
        <h2 className="queue-title">Queue</h2>
        <button className="queue-close-btn" onClick={onClose} title="Close">
          <IoClose />
        </button>
      </div>

      {currentSong && (
        <div className="queue-now-playing">
          <span className="queue-section-label">Now Playing</span>
          <div className="queue-song current">
            <div className="queue-song-index">
              {isPlaying ? <IoPlaySharp className="queue-playing-icon" /> : <IoMusicalNotes />}
            </div>
            <div className="queue-song-info">
              <span className="queue-song-title">{currentSong.title}</span>
              <span className="queue-song-artist">{currentSong.artist || 'Unknown Artist'}</span>
            </div>
            <span className="queue-song-duration">{formatTime(currentSong.duration)}</span>
          </div>
        </div>
      )}

      <div className="queue-upcoming">
        <span className="queue-section-label">
          {displayQueue.length > 0 ? `Next Up (${Math.max(0, displayQueue.length - 1)})` : 'Queue is empty'}
        </span>
        <div className="queue-list">
          {displayQueue.map((song, i) => {
            const realIdx = isShuffled ? shuffleOrder[i] : i;
            if (realIdx === currentRealIndex) return null;
            return (
              <div
                key={`${song.id}-${i}`}
                className="queue-song"
                onClick={() => handleSongClick(i)}
              >
                <div className="queue-song-index">{i + 1}</div>
                <div className="queue-song-info">
                  <span className="queue-song-title">{song.title}</span>
                  <span className="queue-song-artist">{song.artist || 'Unknown Artist'}</span>
                </div>
                <span className="queue-song-duration">{formatTime(song.duration)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
