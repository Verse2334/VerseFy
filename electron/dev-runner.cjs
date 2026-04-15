const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');

// Start vite
const vite = spawn('npx', ['vite'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

// Wait for vite to be ready, then launch electron
function waitForVite(retries = 30) {
  const req = http.get('http://localhost:5173', (res) => {
    console.log('[dev-runner] Vite is ready, launching Electron...');
    const electron = spawn('npx', ['electron', '.'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    electron.on('close', () => {
      vite.kill();
      process.exit(0);
    });
  });

  req.on('error', () => {
    if (retries <= 0) {
      console.error('[dev-runner] Vite did not start in time');
      vite.kill();
      process.exit(1);
    }
    setTimeout(() => waitForVite(retries - 1), 1000);
  });
}

setTimeout(() => waitForVite(), 2000);

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
