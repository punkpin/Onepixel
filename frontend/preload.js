const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onToggleSTT: (callback) => ipcRenderer.on('toggle-stt', (_event, ...args) => callback(...args)),
    // 🌟 添加配置读取和写入接口
    getSetting: (key) => ipcRenderer.invoke('get-setting', key),
    setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
    // 🌟 添加后端状态监听接口
    onBackendStatus: (callback) => ipcRenderer.on('backend-status', (_event, ...args) => callback(...args))
});