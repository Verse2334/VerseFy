const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const isDev = !app.isPackaged;

// Find yt-dlp and ffmpeg - check known install locations
function findBinary(name) {
  // 1) Try PATH (works after reboot / new terminal)
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const result = execSync(`${cmd} ${name}`, { encoding: 'utf-8', timeout: 5000 }).trim().split(/\r?\n/)[0].trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}

  // 2) Search WinGet packages (depth 6 to handle deep ffmpeg path)
  const wingetDir = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetDir)) {
    const found = findFileRecursive(wingetDir, `${name}.exe`, 6);
    if (found) return found;
  }

  // 3) Common install locations
  const common = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', name, `${name}.exe`),
    path.join('C:', 'tools', `${name}.exe`),
    path.join('C:', name, `${name}.exe`),
    path.join('C:', 'ProgramData', 'chocolatey', 'bin', `${name}.exe`),
    path.join(os.homedir(), 'scoop', 'shims', `${name}.exe`),
  ];
  for (const p of common) {
    if (fs.existsSync(p)) return p;
  }

  return name; // bare name as last resort
}

function findFileRecursive(dir, filename, maxDepth) {
  if (maxDepth <= 0) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === filename.toLowerCase()) return full;
      if (e.isDirectory()) {
        const found = findFileRecursive(full, filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

let _paths = null;

function getPaths() {
  if (_paths) return _paths;
  const ytdlpPath = findBinary('yt-dlp');
  const ffmpegPath = findBinary('ffmpeg');
  const denoPath = findBinary('deno');
  const ffmpegDir = (ffmpegPath && ffmpegPath !== 'ffmpeg') ? path.dirname(ffmpegPath) : null;
  const denoDir = (denoPath && denoPath !== 'deno') ? path.dirname(denoPath) : null;
  console.log('[versefy] yt-dlp:', ytdlpPath);
  console.log('[versefy] ffmpeg:', ffmpegDir);
  console.log('[versefy] deno:', denoDir);
  _paths = { ytdlpPath, ffmpegPath, ffmpegDir, denoPath, denoDir };
  return _paths;
}

function getSpawnEnv() {
  const { ffmpegDir, denoDir } = getPaths();
  const env = { ...process.env };
  const extra = [ffmpegDir, denoDir].filter(Boolean);
  if (extra.length) env.PATH = extra.join(path.delimiter) + path.delimiter + (env.PATH || '');
  return env;
}

// Aliases for back-compat
function initPaths() { return getPaths(); }

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    frame: true,
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.setMenuBarVisibility(false);
}

// ========== yt-dlp download with timeout + explicit deno path ==========
let activeProc = null;

function progress(event, msg) {
  try { if (event?.sender && !event.sender.isDestroyed()) event.sender.send('yt-dlp:progress', msg); } catch {}
}

ipcMain.on('yt-dlp:cancel', () => {
  if (activeProc) { try { activeProc.kill(); } catch {} activeProc = null; }
});

function ytdlpRun(args, { onData, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const { ytdlpPath: yt, ffmpegDir: fDir, denoPath: dn } = getPaths();
    const env = getSpawnEnv();

    // Always pass --ffmpeg-location and deno runtime explicitly
    const extra = [];
    if (fDir) extra.push('--ffmpeg-location', fDir);
    // Tell yt-dlp exactly where deno is so it never hangs
    if (dn && dn !== 'deno') extra.push('--js-runtimes', `deno:${dn}`);

    const fullArgs = [...extra, ...args];
    console.log('[yt-dlp] spawn:', yt, fullArgs.slice(0, 6).join(' '), '...');

    const proc = spawn(yt, fullArgs, { env, windowsHide: true });
    activeProc = proc;

    let stdout = '', stderr = '';
    let killed = false;

    // Hard timeout
    const timer = setTimeout(() => {
      killed = true;
      try { proc.kill(); } catch {}
      reject(new Error(`yt-dlp timed out after ${timeout / 1000}s. It may be stuck.`));
    }, timeout);

    proc.stdout.on('data', d => {
      stdout += d.toString();
      if (onData) onData(d.toString());
    });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', e => {
      clearTimeout(timer); activeProc = null;
      reject(new Error(`Cannot run yt-dlp: ${e.message}\nPath: ${yt}`));
    });
    proc.on('close', code => {
      clearTimeout(timer); activeProc = null;
      if (killed) return;
      if (code !== 0) reject(new Error(`yt-dlp exit ${code}:\n${stderr.slice(-500)}`));
      else resolve(stdout);
    });
  });
}

ipcMain.handle('yt-dlp:download', async (event, url) => {
  if (activeProc) { try { activeProc.kill(); } catch {} activeProc = null; }

  const tmpDir = path.join(os.tmpdir(), 'versefy-downloads');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  try { for (const f of fs.readdirSync(tmpDir)) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch {} } } catch {}

  // Phase 1: metadata (60s timeout — YouTube player extraction can be slow)
  progress(event, 'Getting video info...');
  let info;
  try {
    const out = await ytdlpRun([
      '--print', '%(title)s|||%(uploader)s|||%(duration)s|||%(thumbnail)s',
      '--no-download', '--no-warnings', url
    ], { timeout: 60000 });
    const parts = out.trim().split('|||');
    info = { title: parts[0] || 'Unknown', artist: parts[1] || 'Unknown', duration: parseFloat(parts[2]) || 0, thumbnail: parts[3] || null };
    progress(event, `Found: "${info.title}"`);
  } catch (e) {
    progress(event, '');
    const hint = /timed out/i.test(e.message)
      ? '\n\nTip: YouTube frequently changes its player — your yt-dlp may be out of date.\nRun "yt-dlp -U" in a terminal, or reinstall via Install-Versefy-Dependencies.bat.'
      : '';
    throw new Error('Could not get video info.\n' + e.message + hint);
  }

  // Phase 2: download + convert (5 min timeout for long videos)
  progress(event, `Downloading "${info.title}"...`);
  try {
    await ytdlpRun([
      '-x', '--audio-format', 'mp3', '--audio-quality', '0', '--newline',
      '-o', path.join(tmpDir, '%(title)s.%(ext)s'), url
    ], {
      timeout: 300000,
      onData: (text) => {
        const pct = text.match(/(\d+\.?\d*)%/);
        if (pct) progress(event, `Downloading... ${Math.round(parseFloat(pct[1]))}%`);
        else if (text.includes('ExtractAudio')) progress(event, 'Converting to MP3...');
        else if (text.includes('Deleting')) progress(event, 'Finishing up...');
      },
    });
  } catch (e) {
    progress(event, '');
    const hint = /timed out/i.test(e.message)
      ? '\n\nTip: update yt-dlp ("yt-dlp -U") — YouTube player changes can stall old versions.'
      : '';
    throw new Error('Download failed.\n' + e.message + hint);
  }

  // Phase 3: read file
  progress(event, 'Saving to library...');
  const files = fs.readdirSync(tmpDir);
  const audioFile = files.find(f => /\.(mp3|m4a|opus|webm|ogg|wav)$/i.test(f));
  if (!audioFile) throw new Error('No audio file found. Files: ' + files.join(', '));

  const filePath = path.join(tmpDir, audioFile);
  const audioData = fs.readFileSync(filePath);
  const ext = path.extname(audioFile).slice(1);
  const audioUrl = `data:audio/${ext};base64,${audioData.toString('base64')}`;
  try { fs.unlinkSync(filePath); } catch {}

  progress(event, 'Done!');
  return { title: info.title, artist: info.artist, duration: info.duration, thumbnail: info.thumbnail, audioUrl };
});

// Download a YouTube video (video-only, for background use) — returns bytes + metadata
ipcMain.handle('yt-dlp:download-video', async (event, url) => {
  if (activeProc) { try { activeProc.kill(); } catch {} activeProc = null; }

  const tmpDir = path.join(app.getPath('temp'), 'versefy-yt-video');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  try { for (const f of fs.readdirSync(tmpDir)) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch {} } } catch {}

  // Phase 1: metadata
  progress(event, 'Getting video info...');
  let info;
  try {
    const out = await ytdlpRun([
      '--print', '%(title)s|||%(uploader)s|||%(duration)s|||%(thumbnail)s',
      '--no-download', '--no-warnings', url
    ], { timeout: 60000 });
    const parts = out.trim().split('|||');
    info = { title: parts[0] || 'Unknown', artist: parts[1] || 'Unknown', duration: parseFloat(parts[2]) || 0, thumbnail: parts[3] || null };
    progress(event, `Found: "${info.title}"`);
  } catch (e) {
    progress(event, '');
    throw new Error('Could not get video info.\n' + e.message);
  }

  // Phase 2: download video-only stream (smaller than combined, no audio needed for bg)
  // Prefer mp4 <= 720p to keep file size reasonable.
  progress(event, `Downloading video: "${info.title}"...`);
  try {
    await ytdlpRun([
      '-f', 'bv*[height<=720][ext=mp4]/bv*[height<=720]/best[height<=720]/best',
      '--newline',
      '-o', path.join(tmpDir, 'bgvideo.%(ext)s'), url
    ], {
      timeout: 600000, // 10 min for large videos
      onData: (text) => {
        const pct = text.match(/(\d+\.?\d*)%/);
        if (pct) progress(event, `Downloading... ${Math.round(parseFloat(pct[1]))}%`);
        else if (text.includes('Merger')) progress(event, 'Merging streams...');
      },
    });
  } catch (e) {
    progress(event, '');
    throw new Error('Video download failed.\n' + e.message);
  }

  // Phase 3: read file bytes
  progress(event, 'Saving video...');
  const files = fs.readdirSync(tmpDir);
  const videoFile = files.find(f => /\.(mp4|webm|mkv|mov)$/i.test(f));
  if (!videoFile) throw new Error('No video file found. Files: ' + files.join(', '));

  const filePath = path.join(tmpDir, videoFile);
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(videoFile).slice(1).toLowerCase();
  const mime = ext === 'webm' ? 'video/webm' : ext === 'mkv' ? 'video/x-matroska' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  try { fs.unlinkSync(filePath); } catch {}

  progress(event, 'Done!');
  return {
    title: info.title,
    artist: info.artist,
    duration: info.duration,
    thumbnail: info.thumbnail,
    mime,
    ext,
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), // ArrayBuffer for renderer
  };
});

ipcMain.handle('yt-dlp:check', async () => {
  try {
    const out = await ytdlpRun(['--version'], { timeout: 10000 });
    return { available: true, version: out.trim() };
  } catch {
    return { available: false, version: null };
  }
});

// Save file to disk
ipcMain.handle('save-file', async (event, { data, defaultName }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName || 'sound.mp3',
    filters: [
      { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled) return { saved: false };

  const matches = data.match(/^data:([^;]+);base64,(.+)$/);
  if (matches) {
    fs.writeFileSync(result.filePath, Buffer.from(matches[2], 'base64'));
  } else {
    fs.writeFileSync(result.filePath, data);
  }
  return { saved: true, path: result.filePath };
});

// ========== Global Hotkeys ==========
const DEFAULT_HOTKEYS = {
  playPause: 'CommandOrControl+Shift+Space',
  next: 'CommandOrControl+Shift+Right',
  prev: 'CommandOrControl+Shift+Left',
  volumeUp: 'CommandOrControl+Shift+Up',
  volumeDown: 'CommandOrControl+Shift+Down',
};

const hotkeyConfigPath = path.join(app.getPath('userData'), 'hotkeys.json');
let currentHotkeys = {};

function loadHotkeys() {
  try {
    if (fs.existsSync(hotkeyConfigPath)) {
      return JSON.parse(fs.readFileSync(hotkeyConfigPath, 'utf-8'));
    }
  } catch {}
  return { ...DEFAULT_HOTKEYS };
}

function saveHotkeys(hotkeys) {
  fs.writeFileSync(hotkeyConfigPath, JSON.stringify(hotkeys, null, 2));
}

function sendToRenderer(channel, ...args) {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    try { w.webContents.send(channel, ...args); } catch {}
  }
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const hotkeys = loadHotkeys();
  currentHotkeys = hotkeys;

  const actions = {
    playPause: () => sendToRenderer('hotkey:action', 'playPause'),
    next: () => sendToRenderer('hotkey:action', 'next'),
    prev: () => sendToRenderer('hotkey:action', 'prev'),
    volumeUp: () => sendToRenderer('hotkey:action', 'volumeUp'),
    volumeDown: () => sendToRenderer('hotkey:action', 'volumeDown'),
  };

  for (const [action, accelerator] of Object.entries(hotkeys)) {
    if (accelerator && actions[action]) {
      try {
        globalShortcut.register(accelerator, actions[action]);
      } catch (e) {
        console.warn(`[versefy] Failed to register hotkey ${accelerator}:`, e.message);
      }
    }
  }
  console.log('[versefy] Hotkeys registered:', hotkeys);
}

ipcMain.handle('hotkeys:get', () => loadHotkeys());
ipcMain.handle('hotkeys:getDefaults', () => ({ ...DEFAULT_HOTKEYS }));

ipcMain.handle('hotkeys:set', (event, hotkeys) => {
  saveHotkeys(hotkeys);
  registerHotkeys();
  return hotkeys;
});

// Record next key combo for rebinding
ipcMain.handle('hotkeys:record', (event) => {
  return new Promise((resolve) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return resolve(null);

    const handler = (e, input) => {
      // Ignore standalone modifier presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(input.key)) return;
      if (input.type !== 'keyDown') return;

      win.webContents.removeListener('before-input-event', handler);

      const parts = [];
      if (input.control) parts.push('CommandOrControl');
      if (input.shift) parts.push('Shift');
      if (input.alt) parts.push('Alt');

      // Map key names to Electron accelerator format
      const keyMap = {
        ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down',
        ArrowLeft: 'Left', ArrowRight: 'Right',
      };
      const key = keyMap[input.key] || input.key.length === 1 ? input.key.toUpperCase() : input.key;
      parts.push(keyMap[input.key] || (input.key.length === 1 ? input.key.toUpperCase() : input.key));

      resolve(parts.join('+'));
    };

    win.webContents.on('before-input-event', handler);

    // Timeout after 10 seconds
    setTimeout(() => {
      win.webContents.removeListener('before-input-event', handler);
      resolve(null);
    }, 10000);
  });
});

// ========== Discord Rich Presence ==========
let rpcClient = null;
// To show song details on Discord, create an app at https://discord.com/developers/applications
// and put the Application ID here. Upload a "versefy_logo" image under Rich Presence > Art Assets.
const DISCORD_CLIENT_ID = '1493645791363858494';

function initDiscord() {
  try {
    const DiscordRPC = require('discord-rpc');
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });
    rpcClient.on('ready', () => {
      console.log('[versefy] Discord RPC connected as', rpcClient.user?.username);
      updateDiscordPresence(null);
    });
    rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch((err) => {
      console.log('[versefy] Discord RPC login failed:', err?.message || err);
      rpcClient = null;
    });
  } catch (e) {
    console.log('[versefy] Discord RPC not available:', e.message);
  }
}

function updateDiscordPresence(songInfo) {
  if (!rpcClient) return;
  try {
    if (songInfo && songInfo.title) {
      const activity = {
        details: songInfo.title.slice(0, 128),
        state: (songInfo.artist || 'Unknown Artist').slice(0, 128),
        largeImageText: 'Versefy',
        smallImageText: songInfo.isPlaying ? 'Playing' : 'Paused',
        instance: false,
      };
      // Only include image keys if the Discord app has assets uploaded
      // Remove these lines if you haven't uploaded assets yet
      activity.largeImageKey = 'versefy_logo';
      if (songInfo.isPlaying) {
        activity.startTimestamp = Math.floor(Date.now() / 1000);
      }
      rpcClient.setActivity(activity);
    } else {
      rpcClient.setActivity({
        details: 'Idle',
        state: 'Nothing playing',
        largeImageText: 'Versefy',
        instance: false,
      });
    }
  } catch (e) {
    console.log('[versefy] Discord presence update failed:', e.message);
  }
}

ipcMain.on('discord:update', (event, songInfo) => {
  updateDiscordPresence(songInfo);
});

ipcMain.handle('discord:status', () => {
  return { connected: rpcClient !== null };
});

// ========== Song Sharing ==========
const http = require('http');
let shareServer = null;
let sharedSongData = null;

ipcMain.handle('share:start', async (event, { title, audioUrl }) => {
  sharedSongData = { title, audioUrl };

  if (shareServer) {
    return { url: `http://${getLocalIP()}:${shareServer.address().port}` };
  }

  return new Promise((resolve) => {
    shareServer = http.createServer((req, res) => {
      if (!sharedSongData) {
        res.writeHead(404);
        res.end('No song shared');
        return;
      }

      if (req.url === '/audio') {
        const matches = sharedSongData.audioUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          res.writeHead(200, { 'Content-Type': matches[1], 'Content-Length': buffer.length });
          res.end(buffer);
        } else {
          res.writeHead(500);
          res.end('Invalid audio data');
        }
        return;
      }

      // Escape HTML to prevent XSS via song titles
      const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const safeTitle = escHtml(sharedSongData.title);

      // Serve a simple HTML player page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} - Versefy</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#060609; color:#fff; font-family:system-ui; }
  .card { text-align:center; padding:40px; }
  h1 { font-size:24px; margin:0 0 8px; background:linear-gradient(135deg,#8b5cf6,#ec4899); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  p { color:#888; margin:0 0 24px; }
  audio { width:300px; }
  .brand { margin-top:20px; font-size:12px; color:#555; }
</style></head><body>
<div class="card">
  <h1>${safeTitle}</h1>
  <p>Shared via Versefy</p>
  <audio controls autoplay src="/audio"></audio>
  <div class="brand">Versefy Music Player</div>
</div></body></html>`);
    });

    shareServer.listen(0, () => {
      const port = shareServer.address().port;
      const url = `http://${getLocalIP()}:${port}`;
      console.log('[versefy] Share server started at', url);
      resolve({ url });
    });
  });
});

ipcMain.handle('share:stop', async () => {
  sharedSongData = null;
  return { stopped: true };
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ========== OBS Overlay ==========
let obsServer = null;
let obsNowPlaying = { title: '', artist: '', isPlaying: false };

ipcMain.on('obs:update', (event, info) => {
  obsNowPlaying = info || { title: '', artist: '', isPlaying: false };
});

ipcMain.handle('obs:start', async () => {
  if (obsServer) return { url: `http://localhost:${obsServer.address().port}/obs` };

  return new Promise((resolve) => {
    obsServer = http.createServer((req, res) => {
      if (req.url === '/obs/data') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(obsNowPlaying));
        return;
      }
      if (req.url === '/obs' || req.url === '/obs/') {
        const escHtml = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:transparent; font-family:'Inter','Segoe UI',sans-serif; overflow:hidden; }
  .np { display:flex; align-items:center; gap:12px; padding:10px 18px; background:rgba(6,6,9,0.85); border:1px solid rgba(139,92,246,0.2); border-radius:14px; backdrop-filter:blur(12px); max-width:400px; }
  .np-dot { width:8px; height:8px; border-radius:50%; background:#8b5cf6; flex-shrink:0; }
  .np-dot.playing { animation:pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:.4;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
  .np-info { flex:1; min-width:0; }
  .np-title { font-size:14px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .np-artist { font-size:11px; color:rgba(255,255,255,.5); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .np-brand { font-size:9px; color:rgba(139,92,246,.6); letter-spacing:1px; text-transform:uppercase; flex-shrink:0; }
  .hidden { opacity:0; transform:translateY(8px); transition:all .3s; }
  .visible { opacity:1; transform:translateY(0); transition:all .3s; }
</style>
</head><body>
<div class="np hidden" id="np">
  <div class="np-dot" id="dot"></div>
  <div class="np-info">
    <div class="np-title" id="title"></div>
    <div class="np-artist" id="artist"></div>
  </div>
  <div class="np-brand">versefy</div>
</div>
<script>
  async function poll(){
    try{
      const r=await fetch('/obs/data');
      const d=await r.json();
      const el=document.getElementById('np');
      document.getElementById('title').textContent=d.title||'';
      document.getElementById('artist').textContent=d.artist||'';
      document.getElementById('dot').className='np-dot'+(d.isPlaying?' playing':'');
      el.className='np '+(d.title?'visible':'hidden');
    }catch{}
    setTimeout(poll,1500);
  }
  poll();
</script>
</body></html>`);
        return;
      }
      res.writeHead(404); res.end();
    });

    obsServer.listen(18491, () => {
      const url = `http://localhost:18491/obs`;
      console.log('[versefy] OBS overlay at', url);
      resolve({ url });
    });
  });
});

ipcMain.handle('obs:stop', async () => {
  if (obsServer) { obsServer.close(); obsServer = null; }
  return { stopped: true };
});

ipcMain.handle('obs:status', () => {
  return { running: obsServer !== null, url: obsServer ? `http://localhost:${obsServer.address().port}/obs` : null };
});

app.whenReady().then(() => {
  createWindow();
  registerHotkeys();
  initDiscord();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
