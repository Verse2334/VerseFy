import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Emergency theme reset: press Ctrl+Shift+R to reset to default purple theme
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    localStorage.setItem('versefy-theme', 'purple');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
