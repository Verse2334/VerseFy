import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { IoClose } from 'react-icons/io5';
import './EffectsPedals.css';

const PEDALS = [
  { id: 'distortion', name: 'Distortion', icon: '🔥', color: '#ef4444', type: 'waveshaper' },
  { id: 'delay', name: 'Delay', icon: '🔁', color: '#3b82f6', type: 'delay' },
  { id: 'flanger', name: 'Flanger', icon: '🌊', color: '#06b6d4', type: 'flanger' },
  { id: 'chorus', name: 'Chorus', icon: '🎭', color: '#8b5cf6', type: 'chorus' },
  { id: 'phaser', name: 'Phaser', icon: '🌀', color: '#ec4899', type: 'phaser' },
  { id: 'bitcrush', name: 'Bitcrush', icon: '👾', color: '#22c55e', type: 'bitcrush' },
];

export default function EffectsPedals({ onClose }) {
  const { audioRef, ensureAudioGraph } = usePlayer();
  const [activeEffects, setActiveEffects] = useState({});
  const [params, setParams] = useState({});
  const nodesRef = useRef({});
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);

  // Setup audio context for effects
  useEffect(() => {
    ensureAudioGraph();
    return () => {
      // Cleanup all effect nodes
      Object.values(nodesRef.current).forEach(n => { try { n.disconnect(); } catch {} });
      nodesRef.current = {};
    };
  }, [ensureAudioGraph]);

  function getAudioCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctxRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current = src;
      src.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }

  function togglePedal(pedal) {
    const isActive = !!activeEffects[pedal.id];
    setActiveEffects(prev => ({ ...prev, [pedal.id]: !isActive }));

    if (!isActive) {
      // Initialize default params
      setParams(prev => ({
        ...prev,
        [pedal.id]: prev[pedal.id] || { amount: 50 },
      }));
    }
  }

  function updateParam(pedalId, value) {
    setParams(prev => ({
      ...prev,
      [pedalId]: { ...prev[pedalId], amount: value },
    }));
  }

  return (
    <div className="pedals-panel">
      <div className="pedals-header">
        <h3>Effects Pedals</h3>
        <button className="pedals-close" onClick={onClose}><IoClose /></button>
      </div>

      <p className="pedals-desc">Toggle effects on/off. These are visual indicators — the actual audio effects use the Web Audio chain from the EQ panel (reverb, bass boost, 8D audio, etc.)</p>

      <div className="pedals-board">
        {PEDALS.map(pedal => {
          const isOn = !!activeEffects[pedal.id];
          const amount = params[pedal.id]?.amount ?? 50;
          return (
            <div key={pedal.id} className={`pedal ${isOn ? 'on' : ''}`} style={{ '--pedal-color': pedal.color }}>
              <div className="pedal-led" />
              <span className="pedal-icon">{pedal.icon}</span>
              <span className="pedal-name">{pedal.name}</span>

              {isOn && (
                <div className="pedal-knob-wrap">
                  <input
                    type="range" min="0" max="100" value={amount}
                    onChange={e => updateParam(pedal.id, parseInt(e.target.value))}
                    className="pedal-knob"
                  />
                  <span className="pedal-knob-val">{amount}%</span>
                </div>
              )}

              <button className="pedal-stomp" onClick={() => togglePedal(pedal)}>
                {isOn ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pedals-tip">
        Use the EQ panel's Advanced Options for real audio processing (reverb, 8D, karaoke, etc.)
      </div>
    </div>
  );
}
