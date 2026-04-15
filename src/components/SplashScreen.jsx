import { useState, useEffect, useRef } from 'react';
import './SplashScreen.css';

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('enter'); // enter -> reveal -> welcome -> exit
  const [username, setUsername] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const inputRef = useRef(null);

  const isFirstTime = !localStorage.getItem('versefy-username');
  const savedName = localStorage.getItem('versefy-username') || '';

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('reveal'), 500);

    if (isFirstTime) {
      // Show welcome/name screen after splash animation
      const t2 = setTimeout(() => { setPhase('welcome'); setShowWelcome(true); }, 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      // Returning user - show greeting then exit
      const t2 = setTimeout(() => setPhase('greeting'), 2000);
      const t3 = setTimeout(() => setPhase('exit'), 3200);
      const t4 = setTimeout(() => onDone(), 3800);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [onDone, isFirstTime]);

  useEffect(() => {
    if (showWelcome && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [showWelcome]);

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Late Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 21) return 'Good Evening';
    return 'Good Night';
  }

  function handleSubmit() {
    const name = username.trim() || 'User';
    localStorage.setItem('versefy-username', name);
    setPhase('exit');
    setTimeout(() => onDone(), 600);
  }

  function handleSkip() {
    localStorage.setItem('versefy-username', 'User');
    setPhase('exit');
    setTimeout(() => onDone(), 600);
  }

  return (
    <div className={`splash splash-${phase}`}>
      <div className="splash-bg">
        <div className="splash-orb orb-1" />
        <div className="splash-orb orb-2" />
        <div className="splash-orb orb-3" />
        <div className="splash-orb orb-4" />
        <div className="splash-orb orb-5" />
        {/* Floating particles */}
        <div className="splash-particles">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="splash-particle" style={{
              '--x': `${Math.random() * 100}%`,
              '--y': `${Math.random() * 100}%`,
              '--d': `${2 + Math.random() * 4}s`,
              '--s': `${0.5 + Math.random() * 1.5}`,
              '--delay': `${Math.random() * 2}s`,
            }} />
          ))}
        </div>
      </div>

      <div className="splash-content">
        {/* Logo + Title (always shown initially) */}
        <div className={`splash-main ${showWelcome || phase === 'greeting' ? 'shrunk' : ''}`}>
          <div className="splash-logo">
            <svg className="splash-icon" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="url(#splashGrad)" strokeWidth="2.5" opacity="0.5" />
              <circle cx="24" cy="24" r="14" stroke="url(#splashGrad)" strokeWidth="2" opacity="0.3" />
              <path d="M20 16v16l12-8z" fill="url(#splashGrad)" />
              <defs>
                <linearGradient id="splashGrad" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="splash-title">Versefy</h1>
          <div className="splash-line" />
          <p className="splash-tagline">Your music, your way</p>
        </div>

        {/* First time: name input */}
        {showWelcome && phase === 'welcome' && (
          <div className="splash-welcome">
            <h2 className="welcome-heading">Welcome to Versefy</h2>
            <p className="welcome-sub">What should we call you?</p>
            <input
              ref={inputRef}
              type="text"
              className="welcome-input"
              placeholder="Enter your name..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={30}
            />
            <div className="welcome-actions">
              <button className="welcome-btn primary" onClick={handleSubmit}>
                Continue
              </button>
              <button className="welcome-btn ghost" onClick={handleSkip}>
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Returning user greeting */}
        {phase === 'greeting' && (
          <div className="splash-greeting">
            <h2 className="greeting-text">{getGreeting()}, {savedName}</h2>
          </div>
        )}
      </div>
    </div>
  );
}
