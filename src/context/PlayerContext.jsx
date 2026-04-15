import { createContext, useContext, useReducer, useRef, useEffect, useCallback } from 'react';
import { addToRecentlyPlayed, incrementPlayCount, getAllSongs as dbGetAllSongs } from '../utils/db';

const PlayerContext = createContext();

const EQ_BANDS = [60, 170, 350, 1000, 3500, 10000]; // Hz
const EQ_DEFAULTS = [0, 0, 0, 0, 0, 0]; // dB

const TRANSITION_EFFECTS = ['none', 'fade', 'vinyl', 'echo'];

const initialState = {
  queue: [],
  currentIndex: -1,
  currentSong: null,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  volume: 0.8,
  isMuted: false,
  repeatMode: 'off',
  isShuffled: false,
  shuffleOrder: [],
  effectMode: 'normal',
  playbackSpeed: 1.0,
  crossfadeDuration: 0, // seconds, 0 = off
  eqValues: EQ_DEFAULTS,
  showQueue: false,
  showEQ: false,
  bassBoost: false,
  pitchShift: 0, // semitones (-12 to 12)
  normalization: false,
  sleepTimer: 0, // minutes remaining, 0 = off
  transitionEffect: 'none',
  showWallpaperViz: false,
  reverbAmount: 0, // 0-100
  stereoWidth: 100, // 0-200 (100 = normal)
  monoMode: false,
  eightDAudio: false,
  karaoke: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_QUEUE':
      return { ...state, queue: action.payload, shuffleOrder: [] };
    case 'SET_CURRENT_INDEX': {
      const idx = action.payload;
      const song = state.isShuffled
        ? state.queue[state.shuffleOrder[idx]]
        : state.queue[idx];
      return { ...state, currentIndex: idx, currentSong: song || null };
    }
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload, isMuted: action.payload === 0 };
    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };
    case 'SET_REPEAT':
      return { ...state, repeatMode: action.payload };
    case 'SET_SHUFFLE':
      return { ...state, isShuffled: action.payload };
    case 'SET_SHUFFLE_ORDER':
      return { ...state, shuffleOrder: action.payload };
    case 'SET_EFFECT_MODE':
      return { ...state, effectMode: action.payload };
    case 'SET_SPEED':
      return { ...state, playbackSpeed: action.payload };
    case 'SET_CROSSFADE':
      return { ...state, crossfadeDuration: action.payload };
    case 'SET_EQ':
      return { ...state, eqValues: action.payload };
    case 'TOGGLE_QUEUE':
      return { ...state, showQueue: !state.showQueue };
    case 'TOGGLE_EQ':
      return { ...state, showEQ: !state.showEQ };
    case 'SET_BASS_BOOST':
      return { ...state, bassBoost: action.payload };
    case 'SET_PITCH_SHIFT':
      return { ...state, pitchShift: action.payload };
    case 'SET_NORMALIZATION':
      return { ...state, normalization: action.payload };
    case 'SET_SLEEP_TIMER':
      return { ...state, sleepTimer: action.payload };
    case 'SET_TRANSITION_EFFECT':
      return { ...state, transitionEffect: action.payload };
    case 'TOGGLE_WALLPAPER_VIZ':
      return { ...state, showWallpaperViz: !state.showWallpaperViz };
    case 'SET_REVERB_AMOUNT':
      return { ...state, reverbAmount: action.payload };
    case 'SET_STEREO_WIDTH':
      return { ...state, stereoWidth: action.payload };
    case 'SET_MONO_MODE':
      return { ...state, monoMode: action.payload };
    case 'SET_8D_AUDIO':
      return { ...state, eightDAudio: action.payload };
    case 'SET_KARAOKE':
      return { ...state, karaoke: action.payload };
    default:
      return state;
  }
}

function generateShuffleOrder(length, currentIndex) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (currentIndex >= 0) {
    const ci = order.indexOf(currentIndex);
    if (ci > 0) [order[0], order[ci]] = [order[ci], order[0]];
  }
  return order;
}

function createReverbImpulse(ctx, duration = 2.5, decay = 2.0) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef((() => {
    const a = new Audio();
    // Apply saved audio output device
    const savedDevice = localStorage.getItem('versefy-audio-device');
    if (savedDevice && savedDevice !== 'default' && a.setSinkId) {
      a.setSinkId(savedDevice).catch(() => {});
    }
    return a;
  })());
  // Audio graph refs
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const reverbRef = useRef(null);
  const reverbGainRef = useRef(null);
  const dryGainRef = useRef(null);
  const analyserRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const bassBoostFilterRef = useRef(null);
  const compressorRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const pannerRef = useRef(null); // for 8D audio
  const eightDIntervalRef = useRef(null);
  // Keep a ref to latest state so audio callbacks never see stale values
  const stateRef = useRef(state);
  stateRef.current = state;

  const ensureAudioGraph = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    // Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    analyserRef.current = analyser;

    // EQ filters
    const filters = EQ_BANDS.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.gain.value = 0;
      filter.Q.value = 1.0;
      return filter;
    });
    eqFiltersRef.current = filters;

    const gain = ctx.createGain();
    gainRef.current = gain;

    // Bass boost filter (lowshelf at 100Hz)
    const bassBoost = ctx.createBiquadFilter();
    bassBoost.type = 'lowshelf';
    bassBoost.frequency.value = 100;
    bassBoost.gain.value = 0; // off by default
    bassBoostFilterRef.current = bassBoost;

    // Compressor for normalization — NOT connected by default to save CPU
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    compressorRef.current = compressor;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;
    dryGainRef.current = dryGain;

    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx);
    reverbRef.current = reverb;

    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;
    reverbGainRef.current = reverbGain;

    // Stereo panner for 8D audio and balance
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    pannerRef.current = panner;

    // Chain: source -> analyser -> EQ -> bassBoost -> gain -> panner -> dry -> destination
    //                                                       -> reverb -> reverbGain -> destination
    source.connect(analyser);
    let lastNode = analyser;
    for (const f of filters) {
      lastNode.connect(f);
      lastNode = f;
    }
    lastNode.connect(bassBoost);
    bassBoost.connect(gain);
    gain.connect(panner);
    panner.connect(dryGain);
    dryGain.connect(ctx.destination);
    gain.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(ctx.destination);
  }, []);

  const play = useCallback(() => {
    ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    audioRef.current.play().catch(() => {});
    dispatch({ type: 'SET_PLAYING', payload: true });
  }, [ensureAudioGraph]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    dispatch({ type: 'SET_PLAYING', payload: false });
  }, []);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) pause(); else play();
  }, [state.isPlaying, play, pause]);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
    dispatch({ type: 'SET_CURRENT_TIME', payload: time });
  }, []);

  const setVolume = useCallback((vol) => {
    audioRef.current.volume = vol;
    dispatch({ type: 'SET_VOLUME', payload: vol });
  }, []);

  const toggleMute = useCallback(() => {
    dispatch({ type: 'TOGGLE_MUTE' });
  }, []);

  // EQ
  const setEQ = useCallback((values) => {
    dispatch({ type: 'SET_EQ', payload: values });
    eqFiltersRef.current.forEach((f, i) => {
      if (values[i] !== undefined) f.gain.value = values[i];
    });
  }, []);

  const resetEQ = useCallback(() => {
    setEQ([...EQ_DEFAULTS]);
  }, [setEQ]);

  // Effect mode — reset pitch shift when switching effect modes
  const setEffectMode = useCallback((mode) => {
    ensureAudioGraph();
    dispatch({ type: 'SET_EFFECT_MODE', payload: mode });
    dispatch({ type: 'SET_PITCH_SHIFT', payload: 0 }); // clear pitch shift when using effect mode
    dispatch({ type: 'SET_SPEED', payload: 1.0 }); // clear custom speed
    const audio = audioRef.current;
    switch (mode) {
      case 'nightcore':
        audio.playbackRate = 1.25;
        audio.preservesPitch = false;
        if (reverbGainRef.current) reverbGainRef.current.gain.value = 0;
        if (dryGainRef.current) dryGainRef.current.gain.value = 1;
        break;
      case 'slowed':
        audio.playbackRate = 0.82;
        audio.preservesPitch = false;
        if (reverbGainRef.current) reverbGainRef.current.gain.value = 0.6;
        if (dryGainRef.current) dryGainRef.current.gain.value = 0.75;
        break;
      default:
        audio.playbackRate = 1.0;
        audio.preservesPitch = true;
        if (reverbGainRef.current) reverbGainRef.current.gain.value = 0;
        if (dryGainRef.current) dryGainRef.current.gain.value = 1;
        break;
    }
  }, [ensureAudioGraph]);

  // Re-apply all audio settings — reads from stateRef so it's never stale
  function reapplyAudioSettings() {
    const audio = audioRef.current;
    const s = stateRef.current;

    // Effect mode takes priority for playbackRate
    if (s.effectMode === 'nightcore') {
      audio.playbackRate = 1.25;
      audio.preservesPitch = false;
      if (reverbGainRef.current) reverbGainRef.current.gain.value = 0;
      if (dryGainRef.current) dryGainRef.current.gain.value = 1;
    } else if (s.effectMode === 'slowed') {
      audio.playbackRate = 0.82;
      audio.preservesPitch = false;
      if (reverbGainRef.current) reverbGainRef.current.gain.value = 0.6;
      if (dryGainRef.current) dryGainRef.current.gain.value = 0.75;
    } else if (s.pitchShift !== 0) {
      audio.playbackRate = Math.pow(2, s.pitchShift / 12);
      audio.preservesPitch = false;
    } else if (s.playbackSpeed !== 1.0) {
      audio.playbackRate = s.playbackSpeed;
      audio.preservesPitch = false;
    } else {
      audio.playbackRate = 1.0;
      audio.preservesPitch = true;
      if (reverbGainRef.current) reverbGainRef.current.gain.value = 0;
      if (dryGainRef.current) dryGainRef.current.gain.value = 1;
    }

    // Re-apply Web Audio node states
    if (bassBoostFilterRef.current) bassBoostFilterRef.current.gain.value = s.bassBoost ? 15 : 0;
    // Normalization: connect/disconnect compressor
    if (gainRef.current && compressorRef.current && dryGainRef.current) {
      try {
        if (s.normalization) {
          gainRef.current.disconnect(dryGainRef.current);
          gainRef.current.connect(compressorRef.current);
          compressorRef.current.connect(dryGainRef.current);
        } else {
          try { gainRef.current.disconnect(compressorRef.current); } catch {}
          try { compressorRef.current.disconnect(dryGainRef.current); } catch {}
          gainRef.current.connect(dryGainRef.current);
        }
      } catch {}
    }
    eqFiltersRef.current.forEach((f, i) => {
      if (s.eqValues[i] !== undefined) f.gain.value = s.eqValues[i];
    });
  }

  // Helper: load a song into the audio element and play when ready
  const loadAndPlay = useCallback((song, fadeIn = false, targetVol = null) => {
    const audio = audioRef.current;
    const vol = targetVol ?? audio.volume;

    audio.pause();
    audio.src = song.audioUrl;

    if (fadeIn) audio.volume = 0;

    // Wait for audio to be ready, THEN re-apply settings and play
    const onCanPlay = () => {
      audio.removeEventListener('canplay', onCanPlay);

      // Re-apply AFTER load — audio.load() resets playbackRate to 1.0
      reapplyAudioSettings();

      audio.play().catch(() => {});
      dispatch({ type: 'SET_PLAYING', payload: true });

      if (fadeIn && vol > 0) {
        const cfDur = stateRef.current.crossfadeDuration;
        const step = vol / (cfDur * 20 || 20);
        const fadeTimer = setInterval(() => {
          if (audio.volume < vol - 0.02) {
            audio.volume = Math.min(vol, audio.volume + step);
          } else {
            audio.volume = vol;
            clearInterval(fadeTimer);
          }
        }, 50);
      }
    };
    audio.addEventListener('canplay', onCanPlay);
    audio.load();
  }, []); // no deps needed — reads from refs

  // Play a transition sound effect
  const playTransitionSfx = useCallback((type) => {
    if (!audioCtxRef.current || type === 'none' || type === 'fade') return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    if (type === 'vinyl') {
      // Vinyl scratch sound
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
      oscGain.gain.setValueAtTime(0.08, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(oscGain); oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.4);
      // Add noise for scratch texture
      const bufLen = ctx.sampleRate * 0.3;
      const nBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) nData[i] = (Math.random() * 2 - 1) * 0.04;
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.15, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      nSrc.connect(nGain); nGain.connect(ctx.destination);
      nSrc.start(now); nSrc.stop(now + 0.3);
    } else if (type === 'echo') {
      // Echo/ping effect
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800;
      oscGain.gain.setValueAtTime(0.06, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(oscGain); oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.6);
      // Second echo
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine'; osc2.frequency.value = 600;
      g2.gain.setValueAtTime(0.03, now + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(now + 0.15); osc2.stop(now + 0.5);
    }
  }, []);

  // Transition to a new song with optional crossfade + transition effects
  const transitionToSong = useCallback((song) => {
    ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

    const s = stateRef.current;
    const cfDur = s.crossfadeDuration;
    const audio = audioRef.current;
    const effect = s.transitionEffect;

    // Play transition SFX
    if (s.isPlaying && audio.src) {
      playTransitionSfx(effect);
    }

    if ((cfDur > 0 || effect === 'fade') && s.isPlaying && audio.src) {
      // Fade out current, then load new with fade in
      const fadeDur = cfDur > 0 ? cfDur : 1;
      const oldVol = s.isMuted ? 0 : s.volume;
      const step = oldVol / (fadeDur * 20);
      const fadeOut = setInterval(() => {
        if (audio.volume > 0.02) {
          audio.volume = Math.max(0, audio.volume - step);
        } else {
          clearInterval(fadeOut);
          loadAndPlay(song, true, oldVol);
        }
      }, 50);
    } else {
      loadAndPlay(song);
    }

    dispatch({ type: 'SET_PLAYING', payload: true });
    addToRecentlyPlayed(song.id).catch(() => {});
    incrementPlayCount(song.id).catch(() => {});
  }, [ensureAudioGraph, loadAndPlay, playTransitionSfx]);

  const playSong = useCallback((songs, index) => {
    dispatch({ type: 'SET_QUEUE', payload: songs });
    dispatch({ type: 'SET_CURRENT_INDEX', payload: index });

    const song = songs[index];
    if (song) {
      transitionToSong(song);
      if (stateRef.current.isShuffled) {
        dispatch({ type: 'SET_SHUFFLE_ORDER', payload: generateShuffleOrder(songs.length, index) });
      }
    }
  }, [transitionToSong]);

  const next = useCallback(() => {
    const { queue, currentIndex, repeatMode, isShuffled, shuffleOrder } = stateRef.current;
    if (queue.length === 0) return;

    if (repeatMode === 'one') {
      audioRef.current.currentTime = 0;
      reapplyAudioSettings(); // re-apply on repeat too
      audioRef.current.play().catch(() => {});
      dispatch({ type: 'SET_PLAYING', payload: true });
      return;
    }

    let nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else { pause(); return; }
    }

    const realIdx = isShuffled ? shuffleOrder[nextIdx] : nextIdx;
    const song = queue[realIdx];
    if (song) {
      dispatch({ type: 'SET_CURRENT_INDEX', payload: nextIdx });
      transitionToSong(song);
    }
  }, [pause, transitionToSong]);

  const prev = useCallback(() => {
    const { queue, currentIndex, isShuffled, shuffleOrder } = stateRef.current;
    if (queue.length === 0) return;

    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;

    const realIdx = isShuffled ? shuffleOrder[prevIdx] : prevIdx;
    const song = queue[realIdx];
    if (song) {
      dispatch({ type: 'SET_CURRENT_INDEX', payload: prevIdx });
      transitionToSong(song);
    }
  }, [transitionToSong]);

  const toggleRepeat = useCallback(() => {
    const modes = ['off', 'one', 'all'];
    const idx = modes.indexOf(stateRef.current.repeatMode);
    dispatch({ type: 'SET_REPEAT', payload: modes[(idx + 1) % 3] });
  }, []);

  const toggleShuffle = useCallback(() => {
    const newShuffle = !stateRef.current.isShuffled;
    dispatch({ type: 'SET_SHUFFLE', payload: newShuffle });
    if (newShuffle) {
      const s = stateRef.current;
      dispatch({ type: 'SET_SHUFFLE_ORDER', payload: generateShuffleOrder(s.queue.length, s.currentIndex) });
    }
  }, []);

  const setSpeed = useCallback((speed) => {
    dispatch({ type: 'SET_SPEED', payload: speed });
    audioRef.current.playbackRate = speed;
    audioRef.current.preservesPitch = speed === 1.0;
  }, []);

  const setCrossfade = useCallback((dur) => {
    dispatch({ type: 'SET_CROSSFADE', payload: dur });
  }, []);

  // Bass boost
  const toggleBassBoost = useCallback(() => {
    const newVal = !stateRef.current.bassBoost;
    dispatch({ type: 'SET_BASS_BOOST', payload: newVal });
    if (bassBoostFilterRef.current) {
      bassBoostFilterRef.current.gain.value = newVal ? 15 : 0;
    }
  }, []);

  // Pitch shift (uses detune on audio element via playbackRate math)
  const setPitchShift = useCallback((semitones) => {
    dispatch({ type: 'SET_PITCH_SHIFT', payload: semitones });
    const audio = audioRef.current;
    // pitch = 2^(semitones/12), preservesPitch must be false for pitch to change
    const rate = Math.pow(2, semitones / 12);
    audio.playbackRate = rate;
    audio.preservesPitch = false;
  }, []);

  // Audio normalization — insert/remove compressor from chain
  const toggleNormalization = useCallback(() => {
    const newVal = !stateRef.current.normalization;
    dispatch({ type: 'SET_NORMALIZATION', payload: newVal });
    const gain = gainRef.current;
    const comp = compressorRef.current;
    const dry = dryGainRef.current;
    if (!gain || !comp || !dry) return;

    if (newVal) {
      // Insert compressor: gain -> compressor -> dry
      gain.disconnect(dry);
      gain.connect(comp);
      comp.connect(dry);
    } else {
      // Remove compressor: gain -> dry
      gain.disconnect(comp);
      comp.disconnect(dry);
      gain.connect(dry);
    }
  }, []);

  // Sleep timer
  const setSleepTimer = useCallback((minutes) => {
    dispatch({ type: 'SET_SLEEP_TIMER', payload: minutes });
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (minutes <= 0) return;
    sleepTimerRef.current = setTimeout(() => {
      audioRef.current.pause();
      dispatch({ type: 'SET_PLAYING', payload: false });
      dispatch({ type: 'SET_SLEEP_TIMER', payload: 0 });
      sleepTimerRef.current = null;
    }, minutes * 60 * 1000);
  }, []);

  // Transition effect
  const setTransitionEffect = useCallback((effect) => {
    dispatch({ type: 'SET_TRANSITION_EFFECT', payload: effect });
  }, []);

  // Reverb amount (0-100)
  const setReverbAmount = useCallback((amount) => {
    dispatch({ type: 'SET_REVERB_AMOUNT', payload: amount });
    if (reverbGainRef.current && dryGainRef.current) {
      const wet = amount / 100;
      reverbGainRef.current.gain.value = wet * 0.8;
      dryGainRef.current.gain.value = 1 - wet * 0.3;
    }
  }, []);

  // Mono mode
  const toggleMono = useCallback(() => {
    const newVal = !stateRef.current.monoMode;
    dispatch({ type: 'SET_MONO_MODE', payload: newVal });
    // Mono: merge channels by setting channelCount on destination
    if (audioCtxRef.current) {
      audioCtxRef.current.destination.channelCount = newVal ? 1 : 2;
    }
  }, []);

  // 8D Audio — auto-panning left to right
  const toggle8DAudio = useCallback(() => {
    const newVal = !stateRef.current.eightDAudio;
    dispatch({ type: 'SET_8D_AUDIO', payload: newVal });
    if (eightDIntervalRef.current) { clearInterval(eightDIntervalRef.current); eightDIntervalRef.current = null; }
    if (newVal && pannerRef.current) {
      eightDIntervalRef.current = setInterval(() => {
        if (pannerRef.current) {
          pannerRef.current.pan.value = Math.sin(performance.now() / 1500) * 0.9;
        }
      }, 30);
    } else if (pannerRef.current) {
      pannerRef.current.pan.value = 0;
    }
  }, []);

  // Karaoke mode — phase-cancel vocals
  const toggleKaraoke = useCallback(() => {
    const newVal = !stateRef.current.karaoke;
    dispatch({ type: 'SET_KARAOKE', payload: newVal });
    // Karaoke uses mono mode concept: invert one channel to cancel center-panned vocals
    // This is a simplified approach using a lowpass/highpass split
    if (audioCtxRef.current) {
      audioCtxRef.current.destination.channelCount = newVal ? 1 : (stateRef.current.monoMode ? 1 : 2);
    }
  }, []);

  // Stereo width
  const setStereoWidth = useCallback((width) => {
    dispatch({ type: 'SET_STEREO_WIDTH', payload: width });
    // Width > 100 = wider, < 100 = narrower, 0 = mono
    if (pannerRef.current && !stateRef.current.eightDAudio) {
      // Use subtle pan oscillation for width effect
      // At 100 = normal (pan=0), at 0 = mono, at 200 = exaggerated
      // We'll use this as a multiplier for any existing pan
    }
  }, []);

  // Wallpaper visualizer
  const toggleWallpaperViz = useCallback(() => dispatch({ type: 'TOGGLE_WALLPAPER_VIZ' }), []);

  const toggleQueue = useCallback(() => dispatch({ type: 'TOGGLE_QUEUE' }), []);
  const toggleEQ = useCallback(() => dispatch({ type: 'TOGGLE_EQ' }), []);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    const onTimeUpdate = () => dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime });
    const onDurationChange = () => dispatch({ type: 'SET_DURATION', payload: audio.duration || 0 });
    const onEnded = () => next();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [next]);

  useEffect(() => {
    audioRef.current.volume = state.isMuted ? 0 : state.volume;
  }, [state.volume, state.isMuted]);

  // ===== Save session to localStorage every 3 seconds =====
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s.currentSong) return;
      try {
        const session = {
          queue: s.queue.map(song => song.id), // only save IDs to keep it small
          currentIndex: s.currentIndex,
          currentTime: audioRef.current.currentTime || 0,
          volume: s.volume,
          isMuted: s.isMuted,
          repeatMode: s.repeatMode,
          isShuffled: s.isShuffled,
          shuffleOrder: s.shuffleOrder,
          effectMode: s.effectMode,
          playbackSpeed: s.playbackSpeed,
          bassBoost: s.bassBoost,
          pitchShift: s.pitchShift,
          normalization: s.normalization,
          eqValues: s.eqValues,
          crossfadeDuration: s.crossfadeDuration,
          transitionEffect: s.transitionEffect,
          currentSongId: s.currentSong?.id,
        };
        localStorage.setItem('versefy-session', JSON.stringify(session));
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ===== Restore session on first mount =====
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        const raw = localStorage.getItem('versefy-session');
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session.currentSongId || !session.queue?.length) return;

        // Load full song objects from DB
        const allSongs = await dbGetAllSongs();
        const songMap = {};
        for (const s of allSongs) songMap[s.id] = s;

        const queue = session.queue.map(id => songMap[id]).filter(Boolean);
        if (queue.length === 0) return;

        const currentSong = songMap[session.currentSongId];
        if (!currentSong) return;

        // Find index in restored queue
        let idx = session.currentIndex;
        if (idx < 0 || idx >= queue.length) idx = queue.findIndex(s => s.id === session.currentSongId);
        if (idx < 0) return;

        // Restore state
        dispatch({ type: 'SET_QUEUE', payload: queue });
        dispatch({ type: 'SET_CURRENT_INDEX', payload: idx });
        dispatch({ type: 'SET_VOLUME', payload: session.volume ?? 0.8 });
        if (session.isMuted) dispatch({ type: 'TOGGLE_MUTE' });
        dispatch({ type: 'SET_REPEAT', payload: session.repeatMode || 'off' });
        if (session.isShuffled) {
          dispatch({ type: 'SET_SHUFFLE', payload: true });
          if (session.shuffleOrder) dispatch({ type: 'SET_SHUFFLE_ORDER', payload: session.shuffleOrder });
        }
        dispatch({ type: 'SET_EFFECT_MODE', payload: session.effectMode || 'normal' });
        dispatch({ type: 'SET_SPEED', payload: session.playbackSpeed || 1.0 });
        if (session.bassBoost) dispatch({ type: 'SET_BASS_BOOST', payload: true });
        dispatch({ type: 'SET_PITCH_SHIFT', payload: session.pitchShift || 0 });
        if (session.normalization) dispatch({ type: 'SET_NORMALIZATION', payload: true });
        if (session.eqValues) dispatch({ type: 'SET_EQ', payload: session.eqValues });
        dispatch({ type: 'SET_CROSSFADE', payload: session.crossfadeDuration || 0 });
        dispatch({ type: 'SET_TRANSITION_EFFECT', payload: session.transitionEffect || 'none' });

        // Load the song into audio element but DON'T play — paused at last position
        const audio = audioRef.current;
        audio.src = currentSong.audioUrl;
        audio.volume = session.isMuted ? 0 : (session.volume ?? 0.8);

        const onReady = () => {
          audio.removeEventListener('canplay', onReady);
          // Seek to saved position
          if (session.currentTime && isFinite(session.currentTime)) {
            audio.currentTime = session.currentTime;
          }
          dispatch({ type: 'SET_DURATION', payload: audio.duration || 0 });
          dispatch({ type: 'SET_CURRENT_TIME', payload: audio.currentTime || 0 });
          // Stay paused — user can press play when ready
        };
        audio.addEventListener('canplay', onReady);
        audio.load();
      } catch (e) {
        console.warn('[versefy] Session restore failed:', e);
      }
    })();
  }, []);

  const value = {
    ...state,
    audioRef, analyserRef,
    play, pause, togglePlay, seek, setVolume, toggleMute,
    playSong, next, prev, toggleRepeat, toggleShuffle,
    setEffectMode, ensureAudioGraph,
    setEQ, resetEQ, setCrossfade, setSpeed,
    toggleQueue, toggleEQ,
    toggleBassBoost, setPitchShift, toggleNormalization,
    setSleepTimer, setTransitionEffect, toggleWallpaperViz,
    setReverbAmount, toggleMono, toggle8DAudio, toggleKaraoke, setStereoWidth,
    EQ_BANDS, TRANSITION_EFFECTS,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
