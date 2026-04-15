const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ytdlp: {
    download: (url) => ipcRenderer.invoke('yt-dlp:download', url),
    check: () => ipcRenderer.invoke('yt-dlp:check'),
    cancel: () => ipcRenderer.send('yt-dlp:cancel'),
    onProgress: (cb) => {
      const handler = (event, msg) => cb(msg);
      ipcRenderer.on('yt-dlp:progress', handler);
      return () => ipcRenderer.removeListener('yt-dlp:progress', handler);
    },
  },
  saveFile: (data, defaultName) => ipcRenderer.invoke('save-file', { data, defaultName }),
  discord: {
    update: (songInfo) => ipcRenderer.send('discord:update', songInfo),
    status: () => ipcRenderer.invoke('discord:status'),
  },
  share: {
    start: (data) => ipcRenderer.invoke('share:start', data),
    stop: () => ipcRenderer.invoke('share:stop'),
  },
  obs: {
    start: () => ipcRenderer.invoke('obs:start'),
    stop: () => ipcRenderer.invoke('obs:stop'),
    status: () => ipcRenderer.invoke('obs:status'),
    update: (info) => ipcRenderer.send('obs:update', info),
  },
  hotkeys: {
    get: () => ipcRenderer.invoke('hotkeys:get'),
    getDefaults: () => ipcRenderer.invoke('hotkeys:getDefaults'),
    set: (hotkeys) => ipcRenderer.invoke('hotkeys:set', hotkeys),
    record: () => ipcRenderer.invoke('hotkeys:record'),
    onAction: (cb) => {
      const handler = (event, action) => cb(action);
      ipcRenderer.on('hotkey:action', handler);
      return () => ipcRenderer.removeListener('hotkey:action', handler);
    },
  },
});
