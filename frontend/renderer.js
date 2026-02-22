
(function() {
    // --- 1. 获取固定的页面元素 ---
    const avatarZone = document.getElementById('avatar-zone');
    const petImage = document.getElementById('pet-image');
    const chatZone = document.getElementById('chat-zone');
    const settingsZone = document.getElementById('settings-zone');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const displayModeSelect = document.getElementById('display-mode-select');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');

    // 动态获取/创建的画布引用
    let live2dCanvas = document.getElementById('live2d-canvas');

    // --- 2. 状态变量 ---
    let pixiApp = null;
    let currentModel = null;
    let isInitialized = false;

    // --- 3. UI 交互与模式切换 ---
    openSettingsBtn.onclick = () => { settingsZone.classList.remove('hidden'); };
    closeSettingsBtn.onclick = () => { settingsZone.classList.add('hidden'); };

    displayModeSelect.onchange = async (e) => {
        if (e.target.value === 'live2d') {
            petImage.classList.add('hidden');
            await initLive2D(); // 重新建构 Live2D 世界
        } else {
            petImage.classList.remove('hidden');
            killLive2D(); // 彻底摧毁 Live2D 世界
        }
    };

    // --- 4. Live2D 核心生命周期 ---

    // 初始化/重建
    async function initLive2D() {
        if (isInitialized) return;

        if (!window.Live2DCubismCore) {
            console.error("未找到 Live2DCubismCore 文件！");
            return;
        }

        // 🔴 核心魔法：如果画布被销毁了，我们就动态造一个新的插进页面里！
        if (!live2dCanvas) {
            live2dCanvas = document.createElement('canvas');
            live2dCanvas.id = 'live2d-canvas';
            live2dCanvas.className = 'live2d-canvas';
            // 确保画布插在左侧区域，并且在设置面板的底层
            avatarZone.insertBefore(live2dCanvas, settingsZone);
        }

        // 创建全新的引擎实例
        pixiApp = new PIXI.Application({
            view: live2dCanvas,
            transparent: true,
            autoStart: true,
            resizeTo: avatarZone,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        const modelUrl = "./models/Hiyori/Hiyori.model3.json";

        try {
            currentModel = await PIXI.live2d.Live2DModel.from(modelUrl);
            pixiApp.stage.addChild(currentModel);

            fitModelGiant();
            window.addEventListener('resize', fitModelGiant);

            isInitialized = true;
            console.log("Live2D 引擎已全新启动！");
        } catch (err) {
            console.error("加载模型失败:", err);
        }
    }

    // 彻底销毁
    function killLive2D() {
        if (pixiApp) {
            // 取消监听，防止报错
            window.removeEventListener('resize', fitModelGiant);

            // 🔴 核弹级清理：destroy(true) 会把 WebGL 上下文和 <canvas> 标签连根拔起！
            pixiApp.destroy(true, { children: true });

            pixiApp = null;
            currentModel = null;
            live2dCanvas = null; // 清空画布引用，下次切回来时重新造
            isInitialized = false;

            console.log("Live2D 引擎及画布已被彻底拔除，显存完美释放！");
        }
    }

    // 裁切与拖拽
    function fitModelGiant() {
        if (!currentModel || !pixiApp || !pixiApp.screen) return;

        const canvasW = pixiApp.screen.width;
        const canvasH = pixiApp.screen.height;

        if (canvasH === 0) return;

        // 裁切比例
        const viewFactor = 1.6;
        const ratio = (canvasH * viewFactor) / currentModel.height;
        currentModel.scale.set(ratio);

        currentModel.anchor.set(0.5, 0.5);

        // 位置微调
        currentModel.x = (canvasW / 2) + 40;
        currentModel.y = canvasH * 0.75;

        // 鼠标拖拽逻辑
        currentModel.interactive = true;
        currentModel.buttonMode = true;

        currentModel.on('pointerdown', (e) => {
            currentModel.dragging = true;
            currentModel.dragStartX = currentModel.x;
            currentModel.dragStartY = currentModel.y;
            currentModel.mouseStartX = e.data.global.x;
            currentModel.mouseStartY = e.data.global.y;
        });

        currentModel.on('pointermove', (e) => {
            if (currentModel.dragging) {
                const dx = e.data.global.x - currentModel.mouseStartX;
                const dy = e.data.global.y - currentModel.mouseStartY;
                currentModel.x = currentModel.dragStartX + dx;
                currentModel.y = currentModel.dragStartY + dy;
            }
        });

        currentModel.on('pointerup', () => currentModel.dragging = false);
        currentModel.on('pointerupoutside', () => currentModel.dragging = false);
    }

    // --- 5. 聊天接口对接 ---
    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, 'user-msg');
        chatInput.value = '';

        const botMsgDiv = appendMessage('正在思考...', 'bot-msg');

        try {
            const response = await fetch("http://127.0.0.1:8000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();
            botMsgDiv.textContent = data.reply;
        } catch (error) {
            botMsgDiv.textContent = "大脑好像断线了，请确认 Python 后端已开启。";
        }

        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    scrollToBottom();

    function appendMessage(text, className) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${className}`;
        msgDiv.textContent = text;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }
    function scrollToBottom() {
        chatHistory.scrollTo({
            top: chatHistory.scrollHeight,
            behavior: 'smooth'
        })
    }

    sendBtn.onclick = handleSend;
    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    // --- 6. 软件开机自检 ---
    if (displayModeSelect.value === 'live2d') {
        initLive2D();
    }

})();