/**
 * OnePixel - Electron 主进程 (main.js)
 */
(async () => {
    const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut } = require('electron'); // 🌟 加了 globalShortcut
    const path = require('path');
    const { spawn } = require('child_process');

    const { default: Store } = await import('electron-store');

let mainWindow = null;
let tray = null;
let pythonProcess = null;

// 🌟 配置默认值
const defaultSettings = {
    window: {
        width: 450,
        height: 350
    },
    tray: {
        tooltip: 'OnePixel 桌面助手',
        menuShowHide: '👀 显示 / 隐藏 OnePixel',
        menuQuit: '❌ 彻底退出',
        menuHideOnly: '👀 隐藏桌宠 (去系统托盘找我)'
    },
    live2d: {
        modelUrl: '../models/Hiyori/Hiyori.model3.json',
        backendApiUrl: 'http://127.0.0.1:8000/chat',
    },
    general: {
        iconPath: 'icon.png',
        globalShortcut: 'Alt+V'
    }
};

// 初始化配置存储
const store = new Store({ defaults: defaultSettings, path: app.getPath('userData') });

// 封装应用退出逻辑
function quitApp() {
    if (tray) tray.destroy();
    app.quit();
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: store.get('window.width'),
        height: store.get('window.height'),
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        visibleOnAllWorkspaces: true,
        webPreferences: {
            nodeIntegration: false,  // 🌟 安全规范：关闭
            contextIsolation: true,  // 🌟 安全规范：开启
            preload: path.join(__dirname, 'preload.js') // 🌟 核心：挂载桥梁！
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true);
    //mainWindow.webContents.openDevTools({ mode: 'detach' }); // 如果想看前端报错，取消注释这行

    createTray();
}

function createTray() {
    const iconPath = path.join(__dirname, store.get('general.iconPath'));
    const { nativeImage } = require('electron');
    const image = nativeImage.createFromPath(iconPath);
    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: store.get('tray.menuShowHide'),
            click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
        },
        { type: 'separator' },
        {
            label: store.get('tray.menuQuit'),
            click: quitApp
        }
    ]);
    tray.setToolTip(store.get('tray.tooltip'));
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
}

ipcMain.on('show-context-menu', (event) => {
    const template = [
        { label: store.get('tray.menuHideOnly'), click: () => mainWindow.hide() },
        { type: 'separator' },
        { label: store.get('tray.menuQuit'), click: quitApp }
    ];
    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup(win);
});

function startBackend() {
    const backendScript = path.join(__dirname, '..', 'backend', 'main.py');
    pythonProcess = spawn('python', [backendScript], { shell: true });

    // 捕获 stdout 并发送到渲染进程
    pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        console.log(`[Python Backend Stdout]: ${message}`);
        if (mainWindow) {
            mainWindow.webContents.send('backend-status', message);
        }
    });

    // 捕获 stderr 并发送到渲染进程
    pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.error(`[Python Backend Stderr]: ${message}`);
        if (mainWindow) {
            mainWindow.webContents.send('backend-status', `ERROR: ${message}`);
        }
    });

    // 监听进程关闭事件
    pythonProcess.on('close', (code) => {
        console.log(`[Python Backend]: exited with code ${code}`);
        if (mainWindow) {
            mainWindow.webContents.send('backend-status', `后端服务已退出 (代码: ${code})`);
        }
    });

    // 监听进程错误事件
    pythonProcess.on('error', (err) => {
        console.error(`[Python Backend]: failed to start process.`, err);
        if (mainWindow) {
            mainWindow.webContents.send('backend-status', `后端服务启动失败: ${err.message}`);
        }
    });
}

// 🌟 生命钩子及快捷键注册
app.whenReady().then(() => {
    createWindow();

    // 🌟 注册 IPC 处理器
    ipcMain.handle('get-setting', (event, key) => {
        return store.get(key);
    });

    ipcMain.handle('set-setting', (event, key, value) => {
        store.set(key, value);
    });

    // 注册全局快捷键
    globalShortcut.register(store.get('general.globalShortcut'), () => {
        console.log("📢 主进程听到了 Alt+V！通知前端...");
        if (mainWindow) {
            mainWindow.webContents.send('toggle-stt');
        }
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll(); // 清理快捷键
});

})();