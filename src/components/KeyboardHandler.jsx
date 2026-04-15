import { useEffect } from 'react';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { usePlayer } from '../context/PlayerContext';

export default function KeyboardHandler() {
  useKeyboardShortcuts();

  const { togglePlay, next, prev, setVolume, volume } = usePlayer();

  // Listen for global hotkey actions from Electron main process
  useEffect(() => {
    if (!window.electronAPI?.hotkeys?.onAction) return;

    const unsub = window.electronAPI.hotkeys.onAction((action) => {
      switch (action) {
        case 'playPause': togglePlay(); break;
        case 'next': next(); break;
        case 'prev': prev(); break;
        case 'volumeUp': setVolume(Math.min(1, volume + 0.05)); break;
        case 'volumeDown': setVolume(Math.max(0, volume - 0.05)); break;
      }
    });

    return unsub;
  }, [togglePlay, next, prev, setVolume, volume]);

  return null;
}
