import { useState } from 'react';
import { IoCloudUpload, IoMusicalNotes, IoOptions, IoExpand, IoHeart, IoList, IoSpeedometer, IoLeaf, IoChevronForward, IoChevronBack, IoClose, IoRocket } from 'react-icons/io5';
import './Tutorial.css';

const STEPS = [
  {
    title: 'Welcome to Versefy',
    desc: 'Your private music player. Let\'s show you around — this will only take a moment.',
    icon: <IoRocket />,
    highlight: null,
  },
  {
    title: 'Upload Music',
    desc: 'Head to the Upload page to drag & drop audio files, or paste a YouTube link to import songs directly.',
    icon: <IoCloudUpload />,
    highlight: 'upload',
    tip: 'Supports MP3, WAV, FLAC, OGG, M4A, and even MP4 video files (auto-converts to audio).',
  },
  {
    title: 'Your Library',
    desc: 'All your imported songs appear in the Library. You can sort, filter, organize into folders, and search.',
    icon: <IoMusicalNotes />,
    highlight: 'library',
  },
  {
    title: 'Playing Music',
    desc: 'Double-click any song to play it. The player bar at the bottom shows controls, progress, and the current song.',
    icon: <IoMusicalNotes />,
    highlight: 'player',
    tip: 'The album art spins and has a reactive glowing border that pulses with the beat!',
  },
  {
    title: 'Favorites',
    desc: 'Click the heart icon on any song or in the player to add it to your favorites.',
    icon: <IoHeart />,
    highlight: 'favorites',
  },
  {
    title: 'Equalizer & Effects',
    desc: 'Click the EQ button in the player to open the Equalizer. Adjust bass, treble, speed, pitch, and enable bass boost or nightcore mode.',
    icon: <IoOptions />,
    highlight: 'eq',
    tip: 'Try the presets: Bass, Rock, Electronic, Vocal — or tweak each frequency band yourself.',
  },
  {
    title: 'Effects Mode',
    desc: 'Click the speedometer icon in the player to cycle between Normal, Nightcore, and Slowed + Reverb modes.',
    icon: <IoSpeedometer />,
    highlight: 'effects',
  },
  {
    title: 'Visualizer',
    desc: 'Click the expand icon in the player to open the full-screen visualizer. Choose from 8 themes: Radial, Bars, Wave, Galaxy, Earth, City, Aurora, and Ocean.',
    icon: <IoExpand />,
    highlight: 'visualizer',
    tip: 'The Ocean theme is inspired by Tetris Effect — bioluminescent dolphins and jellyfish!',
  },
  {
    title: 'Queue & Playlists',
    desc: 'Click the list icon to see your play queue. Create playlists from the Playlists page — you can even set custom cover art.',
    icon: <IoList />,
    highlight: 'queue',
  },
  {
    title: 'Ambient Mixer',
    desc: 'Click the leaf icon in the player to open the Ambient Mixer. Layer rain, thunder, wind, fire, and lo-fi sounds over your music.',
    icon: <IoLeaf />,
    highlight: 'ambient',
  },
  {
    title: 'You\'re all set!',
    desc: 'Explore Settings for themes, custom fonts, theater mode, and more. Check out Stats for achievements and auto-playlists. Enjoy your music!',
    icon: <IoRocket />,
    highlight: null,
    tip: 'You can always find more info on the Info page in the sidebar.',
  },
];

export default function Tutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  function handleNext() {
    if (isLast) {
      localStorage.setItem('versefy-tutorial-done', 'true');
      onDone();
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem('versefy-tutorial-done', 'true');
    onDone();
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <button className="tutorial-skip" onClick={handleSkip}>
          <IoClose /> Skip
        </button>

        <div className="tutorial-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`tutorial-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>

        <div className="tutorial-icon">{current.icon}</div>
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-desc">{current.desc}</p>
        {current.tip && <p className="tutorial-tip">{current.tip}</p>}

        <div className="tutorial-nav">
          {!isFirst && (
            <button className="tutorial-btn back" onClick={() => setStep(s => s - 1)}>
              <IoChevronBack /> Back
            </button>
          )}
          <button className="tutorial-btn next" onClick={handleNext}>
            {isLast ? 'Get Started' : 'Next'} {!isLast && <IoChevronForward />}
          </button>
        </div>

        <span className="tutorial-step-count">{step + 1} / {STEPS.length}</span>
      </div>
    </div>
  );
}
