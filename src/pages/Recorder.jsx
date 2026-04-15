import { useState, useRef, useEffect } from 'react';
import { addSong } from '../utils/db';
import { usePlayer } from '../context/PlayerContext';
import { IoMic, IoStop, IoPlay, IoSave, IoTrash, IoPause, IoHardwareChip } from 'react-icons/io5';
import { v4 as uuidv4 } from 'uuid';
import './Pages.css';

export default function Recorder() {
  const { audioRef: playerAudioRef } = usePlayer();
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [timer, setTimer] = useState(0);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const playbackRef = useRef(null);

  // Device lists
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('versefy-input-device') || 'default');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('versefy-audio-device') || 'default');

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      // Need to request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    } catch {}
  }

  function handleInputChange(deviceId) {
    setSelectedInput(deviceId);
    localStorage.setItem('versefy-input-device', deviceId);
  }

  async function handleOutputChange(deviceId) {
    setSelectedOutput(deviceId);
    localStorage.setItem('versefy-audio-device', deviceId);
    // Apply to player audio element
    try {
      if (playerAudioRef?.current?.setSinkId) {
        await playerAudioRef.current.setSinkId(deviceId);
      }
      // Apply to recorder playback element
      if (playbackRef.current?.setSinkId) {
        await playbackRef.current.setSinkId(deviceId);
      }
    } catch (e) {
      console.warn('Could not set output device:', e);
    }
  }

  async function startRecording() {
    try {
      const constraints = { audio: selectedInput && selectedInput !== 'default' ? { deviceId: { exact: selectedInput } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];
      setAudioUrl(null);
      setSaved(false);
      setTimer(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const audio = new Audio(url);
        audio.onloadedmetadata = () => setDuration(audio.duration);
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
      };

      recorder.start(100);
      setRecording(true);
      setPaused(false);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } catch (e) {
      alert('Could not access microphone: ' + e.message);
    }
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    setRecording(false);
    setPaused(false);
  }

  function togglePause() {
    if (!mediaRef.current) return;
    if (paused) {
      mediaRef.current.resume();
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      mediaRef.current.pause();
      clearInterval(timerRef.current);
    }
    setPaused(!paused);
  }

  function discard() {
    setAudioUrl(null);
    setDuration(0);
    setTimer(0);
    setSaved(false);
    setTitle('');
  }

  // Apply output device to playback element when it mounts
  useEffect(() => {
    if (playbackRef.current && selectedOutput && selectedOutput !== 'default' && playbackRef.current.setSinkId) {
      playbackRef.current.setSinkId(selectedOutput).catch(() => {});
    }
  }, [audioUrl, selectedOutput]);

  async function saveRecording() {
    if (!audioUrl) return;
    const resp = await fetch(audioUrl);
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onload = async () => {
      const song = {
        id: uuidv4(),
        title: title.trim() || `Recording ${new Date().toLocaleString()}`,
        artist: localStorage.getItem('versefy-username') || 'Me',
        duration,
        audioUrl: reader.result,
        artwork: null,
        addedAt: Date.now(),
        fileSize: blob.size,
        type: 'sfx',
        category: 'Recording',
        tags: ['recording'],
        folderId: null,
      };
      await addSong(song);
      setSaved(true);
    };
    reader.readAsDataURL(blob);
  }

  function formatTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Voice Recorder</h1>
        <p className="subtitle">Record from your microphone and save to SFX Manager</p>
      </div>

      {/* Device Selection */}
      <div className="recorder-devices">
        <div className="recorder-device-group">
          <label className="recorder-device-label"><IoMic /> Input Device</label>
          <select className="recorder-device-select" value={selectedInput} onChange={e => handleInputChange(e.target.value)}>
            {inputDevices.length === 0 && <option value="default">Default Microphone</option>}
            {inputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
        <div className="recorder-device-group">
          <label className="recorder-device-label"><IoHardwareChip /> Output Device</label>
          <select className="recorder-device-select" value={selectedOutput} onChange={e => handleOutputChange(e.target.value)}>
            {outputDevices.length === 0 && <option value="default">Default Speakers</option>}
            {outputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="recorder-card">
        {/* Timer display */}
        <div className="recorder-timer">
          <span className={`recorder-time ${recording ? 'active' : ''}`}>
            {formatTimer(timer)}
          </span>
          {recording && <span className="recorder-status">{paused ? 'Paused' : 'Recording...'}</span>}
        </div>

        {/* Controls */}
        <div className="recorder-controls">
          {!recording && !audioUrl && (
            <button className="recorder-btn record" onClick={startRecording}>
              <IoMic /> Start Recording
            </button>
          )}
          {recording && (
            <>
              <button className="recorder-btn pause" onClick={togglePause}>
                {paused ? <IoPlay /> : <IoPause />}
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button className="recorder-btn stop" onClick={stopRecording}>
                <IoStop /> Stop
              </button>
            </>
          )}
        </div>

        {/* Playback + Save */}
        {audioUrl && !recording && (
          <div className="recorder-result">
            <audio ref={playbackRef} src={audioUrl} controls className="recorder-audio" />
            <input
              type="text"
              className="recorder-title-input"
              placeholder="Recording title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className="recorder-result-actions">
              <button className="recorder-btn save" onClick={saveRecording} disabled={saved}>
                <IoSave /> {saved ? 'Saved to SFX!' : 'Save to SFX Manager'}
              </button>
              <button className="recorder-btn discard" onClick={discard}>
                <IoTrash /> Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
