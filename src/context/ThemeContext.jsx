import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const THEMES = {
  purple: {
    name: 'Purple Haze',
    accent: '#8b5cf6',
    accentHover: '#a78bfa',
    accentGlow: 'rgba(139, 92, 246, 0.3)',
    secondary: '#ec4899',
    bgPrimary: '#060609',
    bgSecondary: '#0c0c14',
    bgElevated: '#14141f',
    gradientA: 'rgba(139, 92, 246, 0.08)',
    gradientB: 'rgba(236, 72, 153, 0.06)',
    scrollbar: 'rgba(139, 92, 246, 0.2)',
  },
  blue: {
    name: 'Ocean Blue',
    accent: '#3b82f6',
    accentHover: '#60a5fa',
    accentGlow: 'rgba(59, 130, 246, 0.3)',
    secondary: '#06b6d4',
    bgPrimary: '#050a10',
    bgSecondary: '#0a1220',
    bgElevated: '#111c2e',
    gradientA: 'rgba(59, 130, 246, 0.08)',
    gradientB: 'rgba(6, 182, 212, 0.06)',
    scrollbar: 'rgba(59, 130, 246, 0.2)',
  },
  red: {
    name: 'Crimson Fire',
    accent: '#ef4444',
    accentHover: '#f87171',
    accentGlow: 'rgba(239, 68, 68, 0.3)',
    secondary: '#f97316',
    bgPrimary: '#0a0505',
    bgSecondary: '#140a0a',
    bgElevated: '#1f1212',
    gradientA: 'rgba(239, 68, 68, 0.08)',
    gradientB: 'rgba(249, 115, 22, 0.06)',
    scrollbar: 'rgba(239, 68, 68, 0.2)',
  },
  green: {
    name: 'Neon Mint',
    accent: '#22c55e',
    accentHover: '#4ade80',
    accentGlow: 'rgba(34, 197, 94, 0.3)',
    secondary: '#06b6d4',
    bgPrimary: '#040a06',
    bgSecondary: '#0a140c',
    bgElevated: '#121f16',
    gradientA: 'rgba(34, 197, 94, 0.08)',
    gradientB: 'rgba(6, 182, 212, 0.06)',
    scrollbar: 'rgba(34, 197, 94, 0.2)',
  },
  pink: {
    name: 'Sakura Pink',
    accent: '#ec4899',
    accentHover: '#f472b6',
    accentGlow: 'rgba(236, 72, 153, 0.3)',
    secondary: '#a855f7',
    bgPrimary: '#0a0508',
    bgSecondary: '#140a10',
    bgElevated: '#1f1218',
    gradientA: 'rgba(236, 72, 153, 0.08)',
    gradientB: 'rgba(168, 85, 247, 0.06)',
    scrollbar: 'rgba(236, 72, 153, 0.2)',
  },
  mono: {
    name: 'Monochrome',
    accent: '#a0a0a0',
    accentHover: '#c0c0c0',
    accentGlow: 'rgba(160, 160, 160, 0.2)',
    secondary: '#707070',
    bgPrimary: '#080808',
    bgSecondary: '#0e0e0e',
    bgElevated: '#181818',
    gradientA: 'rgba(160, 160, 160, 0.05)',
    gradientB: 'rgba(120, 120, 120, 0.04)',
    scrollbar: 'rgba(160, 160, 160, 0.15)',
  },
  sunset: {
    name: 'Sunset',
    accent: '#f97316',
    accentHover: '#fb923c',
    accentGlow: 'rgba(249, 115, 22, 0.3)',
    secondary: '#eab308',
    bgPrimary: '#0a0704',
    bgSecondary: '#140e08',
    bgElevated: '#1f1810',
    gradientA: 'rgba(249, 115, 22, 0.08)',
    gradientB: 'rgba(234, 179, 8, 0.06)',
    scrollbar: 'rgba(249, 115, 22, 0.2)',
  },
  lava: {
    name: 'Lava',
    accent: '#ef4444',
    accentHover: '#f87171',
    accentGlow: 'rgba(239, 68, 68, 0.35)',
    secondary: '#f97316',
    bgPrimary: '#0a0404',
    bgSecondary: '#140808',
    bgElevated: '#1f1010',
    gradientA: 'rgba(239, 68, 68, 0.08)',
    gradientB: 'rgba(249, 115, 22, 0.06)',
    scrollbar: 'rgba(239, 68, 68, 0.2)',
  },
  aurora: {
    name: 'Aurora',
    accent: '#06b6d4',
    accentHover: '#22d3ee',
    accentGlow: 'rgba(6, 182, 212, 0.3)',
    secondary: '#22c55e',
    bgPrimary: '#030a08',
    bgSecondary: '#081410',
    bgElevated: '#0f1f1a',
    gradientA: 'rgba(6, 182, 212, 0.08)',
    gradientB: 'rgba(34, 197, 94, 0.06)',
    scrollbar: 'rgba(6, 182, 212, 0.2)',
  },
  neon: {
    name: 'Neon',
    accent: '#f0abfc',
    accentHover: '#f5d0fe',
    accentGlow: 'rgba(240, 171, 252, 0.35)',
    secondary: '#67e8f9',
    bgPrimary: '#050510',
    bgSecondary: '#0a0a1a',
    bgElevated: '#121225',
    gradientA: 'rgba(240, 171, 252, 0.08)',
    gradientB: 'rgba(103, 232, 249, 0.06)',
    scrollbar: 'rgba(240, 171, 252, 0.2)',
  },
  midnight: {
    name: 'Midnight',
    accent: '#6366f1',
    accentHover: '#818cf8',
    accentGlow: 'rgba(99, 102, 241, 0.3)',
    secondary: '#a855f7',
    bgPrimary: '#020215',
    bgSecondary: '#06062a',
    bgElevated: '#0e0e3a',
    gradientA: 'rgba(99, 102, 241, 0.08)',
    gradientB: 'rgba(168, 85, 247, 0.06)',
    scrollbar: 'rgba(99, 102, 241, 0.2)',
  },
};

function applyTheme(theme) {
  const t = THEMES[theme];
  if (!t) return;
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-hover', t.accentHover);
  root.style.setProperty('--accent-glow', t.accentGlow);
  root.style.setProperty('--bg-primary', t.bgPrimary);
  root.style.setProperty('--bg-secondary', t.bgSecondary);
  root.style.setProperty('--bg-elevated', t.bgElevated);
  root.style.setProperty('--gradient-a', t.gradientA);
  root.style.setProperty('--gradient-b', t.gradientB);
  root.style.setProperty('--scrollbar-color', t.scrollbar);
  root.style.setProperty('--theme-secondary', t.secondary);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('versefy-theme') || 'purple';
    if (!THEMES[saved]) {
      localStorage.setItem('versefy-theme', 'purple');
      return 'purple';
    }
    return saved;
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('versefy-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
