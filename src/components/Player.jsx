import { useRef, useCallback, useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { toggleFavorite } from '../utils/db';
import { useNavigate } from 'react-router-dom';
import {
  IoPlaySharp, IoPauseSharp, IoPlaySkipForwardSharp, IoPlaySkipBackSharp,
  IoRepeat, IoShuffle, IoVolumeHigh, IoVolumeMute, IoVolumeMedium, IoVolumeLow,
  IoExpand, IoSpeedometer, IoHeart, IoHeartOutline, IoList, IoOptions, IoLeaf
} from 'react-icons/io5';
import { TbRepeatOnce } from 'react-icons/tb';
import AmbientMixer from './AmbientMixer';
import MiniWaveform from './MiniWaveform';
import QueueView from './QueueView';
import Equalizer from './Equalizer';
import './Player.css';

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function useSlider(onChange) {
  const dragging = useRef(false);
  const calc = useCallback((e, el) => {
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);
  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    const el = e.currentTarget;
    onChange(calc(e, el));
    const onMove = (e2) => { if (dragging.current) onChange(calc(e2, el)); };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onChange, calc]);
  return { onMouseDown };
}

const EFFECT_LABELS = { normal: 'Normal', nightcore: 'Nightcore', slowed: 'Slowed + Reverb' };
const EFFECT_CYCLE = ['normal', 'nightcore', 'slowed'];

export default function Player() {
  const {
    currentSong, isPlaying, duration, currentTime, volume, isMuted,
    repeatMode, isShuffled, effectMode, showQueue, showEQ,
    togglePlay, next, prev, seek, setVolume, toggleMute,
    toggleRepeat, toggleShuffle, setEffectMode,
    toggleQueue, toggleEQ,
    analyserRef, ensureAudioGraph,
  } = usePlayer();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [showAmbient, setShowAmbient] = useState(false);
  const artworkRingRef = useRef(null);
  const pulseAnimRef = useRef(null);

  // Reactive border ring — throttled to 20fps to prevent audio stuttering
  useEffect(() => {
    if (!isPlaying || !currentSong) {
      if (pulseAnimRef.current) { clearInterval(pulseAnimRef.current); pulseAnimRef.current = null; }
      if (artworkRingRef.current) {
        artworkRingRef.current.style.setProperty('--ring-intensity', '0');
        artworkRingRef.current.style.setProperty('--ring-scale', '1');
      }
      return;
    }

    ensureAudioGraph();
    const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 128);

    pulseAnimRef.current = setInterval(() => {
      const el = artworkRingRef.current;
      if (!el || !analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      let bass = 0, energy = 0;
      const len = dataArray.length;
      for (let i = 0; i < len * 0.15; i++) bass += dataArray[i];
      bass = bass / (len * 0.15) / 255;
      for (let i = 0; i < len; i++) energy += dataArray[i];
      energy = energy / len / 255;

      el.style.setProperty('--ring-intensity', Math.min(1, energy * 1.5 + bass * 0.5).toFixed(3));
      el.style.setProperty('--ring-scale', (1 + bass * 0.08).toFixed(4));
      el.style.setProperty('--ring-hue', Math.floor(performance.now() / 30 % 360));
    }, 50); // 20fps instead of 60fps

    return () => { if (pulseAnimRef.current) clearInterval(pulseAnimRef.current); };
  }, [isPlaying, currentSong, analyserRef, ensureAudioGraph]);

  // Sync fav state when song changes
  const lastSongIdRef = useRef(null);
  if (currentSong && currentSong.id !== lastSongIdRef.current) {
    lastSongIdRef.current = currentSong.id;
    setIsFav(!!currentSong.favorite);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressSlider = useSlider(useCallback((pct) => seek(pct * duration), [seek, duration]));
  const volumeSlider = useSlider(useCallback((pct) => setVolume(pct), [setVolume]));

  function cycleEffect() {
    const idx = EFFECT_CYCLE.indexOf(effectMode);
    setEffectMode(EFFECT_CYCLE[(idx + 1) % EFFECT_CYCLE.length]);
  }

  async function handleToggleFav() {
    if (!currentSong) return;
    const updated = await toggleFavorite(currentSong.id);
    if (updated) setIsFav(updated.favorite);
  }

  const VolumeIcon = isMuted || volume === 0
    ? IoVolumeMute
    : volume < 0.33 ? IoVolumeLow
    : volume < 0.66 ? IoVolumeMedium
    : IoVolumeHigh;

  return (
    <>
      <div className={`player ${currentSong ? 'has-song' : ''}`}>
        {/* Song Info */}
        <div className="player-song-info">
          {currentSong ? (
            <>
              <div className={`artwork-ring ${isPlaying ? 'active' : ''}`} ref={artworkRingRef}>
                <div className={`player-artwork ${isPlaying ? 'spinning' : ''}`}>
                  {currentSong.artwork ? (
                    <img src={currentSong.artwork} alt={currentSong.title} />
                  ) : (
                    <div className="player-artwork-placeholder">
                      <IoPlaySharp />
                    </div>
                  )}
                </div>
              </div>
              <div className="player-info-text">
                <div className="player-text">
                  <span className="player-title">{currentSong.title}</span>
                  <span className="player-artist">{currentSong.artist || 'Unknown Artist'}</span>
                </div>
                <div className="player-actions-mini">
                  <button
                    className={`heart-btn ${isFav ? 'active' : ''}`}
                    onClick={handleToggleFav}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFav ? <IoHeart /> : <IoHeartOutline />}
                  </button>
                  <button className="visualizer-btn" onClick={() => navigate('/visualizer')} title="Visualizer">
                    <IoExpand />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="player-text">
              <span className="player-title empty">No song playing</span>
            </div>
          )}
        </div>

        {/* Center: controls + waveform */}
        <div className="player-center">
          <div className="player-controls">
            <div className="player-buttons">
              <button className={`control-btn small ${isShuffled ? 'active' : ''}`} onClick={toggleShuffle} title="Shuffle">
                <IoShuffle />
              </button>
              <button className="control-btn" onClick={prev} title="Previous">
                <IoPlaySkipBackSharp />
              </button>
              <button className="control-btn play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <IoPauseSharp /> : <IoPlaySharp />}
              </button>
              <button className="control-btn" onClick={next} title="Next">
                <IoPlaySkipForwardSharp />
              </button>
              <button className={`control-btn small ${repeatMode !== 'off' ? 'active' : ''}`} onClick={toggleRepeat} title={`Repeat: ${repeatMode}`}>
                {repeatMode === 'one' ? <TbRepeatOnce /> : <IoRepeat />}
              </button>
            </div>

            <div className="player-progress">
              <span className="time">{formatTime(currentTime)}</span>
              <div className="progress-bar" onMouseDown={progressSlider.onMouseDown}>
                <div className="progress-fill" style={{ width: `${progress}%` }}>
                  <div className="progress-thumb" />
                </div>
              </div>
              <span className="time">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Waveform under controls */}
          {currentSong && (
            <div className="player-waveform">
              <MiniWaveform width={200} height={24} />
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="player-right">
          <button
            className={`effect-btn ${effectMode !== 'normal' ? 'active' : ''}`}
            onClick={cycleEffect}
            title={`Effect: ${EFFECT_LABELS[effectMode]}`}
          >
            <IoSpeedometer />
            {effectMode !== 'normal' && (
              <span className="effect-label">{effectMode === 'nightcore' ? 'NC' : 'S+R'}</span>
            )}
          </button>

          <button className={`control-btn small ${showEQ ? 'active' : ''}`} onClick={toggleEQ} title="Equalizer">
            <IoOptions />
          </button>

          <button className={`control-btn small ${showAmbient ? 'active' : ''}`} onClick={() => setShowAmbient(!showAmbient)} title="Ambient Mixer">
            <IoLeaf />
          </button>

          <button className={`control-btn small ${showQueue ? 'active' : ''}`} onClick={toggleQueue} title="Queue">
            <IoList />
          </button>

          <div className="player-volume">
            <button className="control-btn small" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              <VolumeIcon />
            </button>
            <div className="volume-bar" onMouseDown={volumeSlider.onMouseDown}>
              <div className="volume-fill" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}>
                <div className="volume-thumb" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panels */}
      <QueueView isOpen={showQueue} onClose={toggleQueue} />
      {showEQ && <Equalizer />}
      {showAmbient && <AmbientMixer onClose={() => setShowAmbient(false)} />}
    </>
  );
}
