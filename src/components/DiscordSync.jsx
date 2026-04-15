import { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';

export default function DiscordSync() {
  const { currentSong, isPlaying } = usePlayer();

  useEffect(() => {
    const info = currentSong ? { title: currentSong.title, artist: currentSong.artist, isPlaying } : null;
    if (window.electronAPI?.discord) window.electronAPI.discord.update(info);
    if (window.electronAPI?.obs) window.electronAPI.obs.update(info || { title: '', artist: '', isPlaying: false });
  }, [currentSong, isPlaying]);

  return null;
}
