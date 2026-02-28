/**
 * OnePixel - Electron 主进程 (main.js) - 极速安全版
 */
const { app, BrowserWindow, Menu, Tray, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;

// 🌟 物理切除 electron-store，换成纯内存对象。
// 彻底杜绝异步加载和文件读写导致的闪退！
const store = {
    window: { width: 450, height: 350 },
    tray: {
        tooltip: 'OnePixel 桌面助手',
        menuShowHide: '👀 显示 / 隐藏',
        menuQuit: '❌ 彻底退出',
        menuHideOnly: '👀 隐藏桌宠'
    },
    general: {
        iconPath: 'icon.png',
        globalShortcut: 'Alt+V'
    }
};

function quitApp() {
    if (tray) tray.destroy();
    app.quit();
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: store.window.width,
        height: store.window.height,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true);

    // 🌟 如果之后界面白屏，可以把这行注释解开，就能看到前端的红字报错了！
    // mainWindow.webContents.openDevTools({ mode: 'detach' });

    createTray();
}

function createTray() {
    try {
        const iconPath = path.join(__dirname, store.general.iconPath);
        tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            { label: store.tray.menuShowHide, click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show() },
            { type: 'separator' },
            { label: store.tray.menuQuit, click: quitApp }
        ]);
        tray.setToolTip(store.tray.tooltip);
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
    } catch (e) {
        // 🌟 防崩装甲：如果没有 icon.png，只会在这打印一行红字，绝对不会让程序闪退！
        console.error("⚠️ [警告]: 找不到托盘图标 icon.png，已跳过托盘创建！不影响正常使用喵~");
    }
}

// 🌟 生命钩子及快捷键注册
app.whenReady().then(() => {
    createWindow();

    // 伪装 store 的 IPC 接口，兼容你之前的写法
    ipcMain.handle('get-setting', (event, key) => {
        const keys = key.split('.');
        let val = store;
        for (const k of keys) {
            if (val[k] !== undefined) val = val[k];
        }
        return val;
    });

    ipcMain.handle('set-setting', (event, key, value) => {
        console.log(`[设置拦截]: 暂不支持持久化保存 ${key} = ${value}`);
    });

    // 注册全局快捷键
    try {
        globalShortcut.register(store.general.globalShortcut, () => {
            console.log("📢 主进程听到了 Alt+V！通知前端...");
            if (mainWindow) {
                mainWindow.webContents.send('toggle-stt');
            }
        });
    } catch (e) {
        console.error("⚠️ 快捷键注册失败:", e.message);
    }
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
    globalShortcut.unregisterAll();
});