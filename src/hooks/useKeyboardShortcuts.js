import { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function useKeyboardShortcuts() {
  const { togglePlay, next, prev, setVolume, volume } = usePlayer();

  useEffect(() => {
    function handler(e) {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) next();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) prev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, next, prev, setVolume, volume]);
}
