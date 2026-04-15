import { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import SplashScreen from './components/SplashScreen';
import AnimatedBG from './components/AnimatedBG';
import WallpaperViz from './components/WallpaperViz';
import Home from './pages/Home';
import Library from './pages/Library';
import Upload from './pages/Upload';
import Playlists from './pages/Playlists';
import Search from './pages/Search';
import SFXManager from './pages/SFXManager';
import Visualizer from './pages/Visualizer';
import Favorites from './pages/Favorites';
import Storage from './pages/Storage';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Info from './pages/Info';
import Recorder from './pages/Recorder';
import KeyboardHandler from './components/KeyboardHandler';
import DiscordSync from './components/DiscordSync';
import Tutorial from './components/Tutorial';
import Screensaver from './components/Screensaver';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const handleSplashDone = useCallback(() => {
    setShowSplash(false);
    if (!localStorage.getItem('versefy-tutorial-done')) {
      setShowTutorial(true);
    }
  }, []);

  // Theater mode — Escape key exits it
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('theater-mode')) {
        document.body.classList.remove('theater-mode');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function exitTheater() {
    document.body.classList.remove('theater-mode');
  }

  return (
    <ThemeProvider>
      <HashRouter>
        <PlayerProvider>
          <KeyboardHandler />
          <DiscordSync />
          {showSplash && <SplashScreen onDone={handleSplashDone} />}
          <AnimatedBG />
          <WallpaperViz />
          <button className="theater-exit" onClick={exitTheater}>Exit Theater Mode</button>
          {showTutorial && <Tutorial onDone={() => setShowTutorial(false)} />}
          <Screensaver />
          <div className={`app-layout ${showSplash ? 'app-hidden' : 'app-visible'}`}>
            <Sidebar />
            <div className="app-main">
              <div className="app-content">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/playlists" element={<Playlists />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/sfx" element={<SFXManager />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/storage" element={<Storage />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/info" element={<Info />} />
                  <Route path="/recorder" element={<Recorder />} />
                  <Route path="/visualizer" element={<Visualizer />} />
                </Routes>
              </div>
              <Player />
            </div>
          </div>
        </PlayerProvider>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
