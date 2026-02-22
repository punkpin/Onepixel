/**
 * OnePixel - Electron 主进程 (main.js)
 * 功能：透明无边框窗口、任务栏隐身、系统托盘、原生右键菜单
 */

const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');

// 🔴 必须设为全局变量！
// 如果放在函数里面，会被 JavaScript 的垃圾回收机制(GC)当成废品清理掉，导致托盘图标离奇消失。
let mainWindow = null;
let tray = null;

function createWindow() {
    // 1. 创建终极桌宠窗口
    mainWindow = new BrowserWindow({
        width: 450,
        height: 350,
        transparent: true,   // 背景透明
        frame: false,        // 无边框
        resizable: false,    // 禁止缩放，防止排版乱掉
        skipTaskbar: true,   // 🔴 核心：在底部任务栏和 Alt+Tab 中彻底隐身
        alwaysOnTop: true,
        visibleOnAllWorkspaces: true,// 💡 建议开启：让桌宠始终保持在最顶层（不会被浏览器挡住）
        webPreferences: {
            nodeIntegration: true,   // 允许渲染进程使用 Node.js API (如 require)
            contextIsolation: false  // 配合上一条使用
        }
    });

    // 2. 加载前端页面
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true);

    // 3. 初始化右下角系统托盘
    createTray();
}

function createTray() {
    // 🔴 必须确保你的项目根目录下有一张叫 icon.png 的图片（建议正方形，如 64x64）
    const iconPath = path.join(__dirname, 'icon.png');
    const { nativeImage } = require('electron');
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
        console.error("❌ 路径对但图标加载失败，请确认文件名为 icon.png 且格式正常");
    }
    tray = new Tray(iconPath);

    // 构建托盘的右键菜单
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '👀 显示 / 隐藏 OnePixel',
            click: () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                }
            }
        },
        { type: 'separator' }, // 优雅的分割线
        {
            label: '❌ 彻底退出',
            click: () => {
                tray.destroy(); // 退出前清理掉托盘图标
                app.quit();     // 真正杀死所有进程
            }
        }
    ]);

    tray.setToolTip('OnePixel 桌面助手');
    tray.setContextMenu(contextMenu);

    // 彩蛋：双击托盘图标快速切换显示状态
    tray.on('double-click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    });
}

// --- IPC 通信：接收来自 renderer.js 的信号 ---

// 监听前端发来的“呼出右键菜单”请求
ipcMain.on('show-context-menu', (event) => {
    const template = [
        {
            label: '👀 隐藏桌宠 (去系统托盘找我)',
            click: () => { mainWindow.hide(); } // 这里只做隐藏，不杀进程
        },
        { type: 'separator' },
        {
            label: '❌ 彻底退出',
            click: () => {
                if (tray) tray.destroy();
                app.quit();
            }
        }
    ];

    const menu = Menu.buildFromTemplate(template);

    // 在鼠标当前位置弹出这个原生菜单
    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup(win);
});


// --- Electron App 生命周期管理 ---
const { spawn } = require('child_process');
let pythonProcess = null;

function startBackend() {
    // 启动根目录 backend 下的 main.py
    const backendScript = path.join(__dirname, '..', 'backend', 'main.py');
    pythonProcess = spawn('python', [backendScript], { shell: true });
}

// 修改生命周期钩子
app.whenReady().then(() => {
    startBackend(); // 启动大脑
    createWindow();
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