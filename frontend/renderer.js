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

    // --- 2. 常量定义 ---
    const LIVE2D_MODEL_URL = "../models/Hiyori/Hiyori.model3.json";
    const BACKEND_API_URL = "http://127.0.0.1:8000/chat";
    const BACKEND_LISTEN_URL = "http://127.0.0.1:8000/listen";
    const BACKEND_PING_URL = "http://127.0.0.1:8000/ping"; // 💓 心跳地址

    let live2dCanvas = document.getElementById('live2d-canvas');
    let pixiApp = null;
    let currentModel = null;
    let isInitialized = false;

    let isBackendReady = false; // 🔴 核心锁：后端没准备好，绝不放行交互！

    // --- 3. UI 交互与模式切换 ---
    openSettingsBtn.onclick = () => { settingsZone.classList.remove('hidden'); };
    closeSettingsBtn.onclick = () => { settingsZone.classList.add('hidden'); };

    displayModeSelect.onchange = async (e) => {
        if (e.target.value === 'live2d') {
            petImage.classList.add('hidden');
            await initLive2D();
        } else {
            petImage.classList.remove('hidden');
            killLive2D();
        }
    };

    // --- 4. Live2D 核心逻辑 ---
    async function initLive2D() {
        if (isInitialized) return;
        if (!window.Live2DCubismCore) return console.error("未找到 Live2DCubismCore 文件！");

        if (!live2dCanvas) {
            live2dCanvas = document.createElement('canvas');
            live2dCanvas.id = 'live2d-canvas';
            live2dCanvas.className = 'live2d-canvas';
            avatarZone.insertBefore(live2dCanvas, settingsZone);
        }

        pixiApp = new PIXI.Application({
            view: live2dCanvas,
            transparent: true,
            autoStart: true,
            resizeTo: avatarZone,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        try {
            currentModel = await PIXI.live2d.Live2DModel.from(LIVE2D_MODEL_URL);
            pixiApp.stage.addChild(currentModel);
            fitModelGiant();
            window.addEventListener('resize', fitModelGiant);
            isInitialized = true;
        } catch (err) { console.error("加载模型失败:", err); }
    }

    function killLive2D() {
        if (pixiApp) {
            window.removeEventListener('resize', fitModelGiant);
            pixiApp.destroy(true, { children: true });
            pixiApp = null;
            currentModel = null;
            live2dCanvas = null;
            isInitialized = false;
        }
    }

    function _updateModelTransform(model, app) {
        if (!model || !app || !app.screen) return;
        const canvasW = app.screen.width;
        const canvasH = app.screen.height;
        if (canvasH === 0) return;
        const ratio = (canvasH * 1.6) / model.height;
        model.scale.set(ratio);
        model.anchor.set(0.5, 0.5);
        model.x = (canvasW / 2) + 40;
        model.y = canvasH * 0.75;
    }

    function _setupModelInteractions(model) {
        model.interactive = true;
        model.buttonMode = true;
        model.on('pointerdown', (e) => {
            model.dragging = true;
            model.dragStartX = model.x;
            model.dragStartY = model.y;
            model.mouseStartX = e.data.global.x;
            model.mouseStartY = e.data.global.y;
        });
        model.on('pointermove', (e) => {
            if (model.dragging) {
                model.x = model.dragStartX + (e.data.global.x - model.mouseStartX);
                model.y = model.dragStartY + (e.data.global.y - model.mouseStartY);
            }
        });
        model.on('pointerup', () => model.dragging = false);
        model.on('pointerupoutside', () => model.dragging = false);
    }

    function fitModelGiant() {
        if (!currentModel || !pixiApp || !pixiApp.screen) return;
        _updateModelTransform(currentModel, pixiApp);
        _setupModelInteractions(currentModel);
    }

    // ==========================================
    // 💓 5. 微服务架构：轮询等待后端苏醒
    // ==========================================
    async function waitForBackend() {
        chatInput.disabled = true;
        sendBtn.disabled = true;
        chatInput.placeholder = "🧠 正在唤醒小咪的大脑，请稍候...";

        while (!isBackendReady) {
            try {
                const res = await fetch(BACKEND_PING_URL);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "ok") {
                        isBackendReady = true;
                        break;
                    }
                }
            } catch (err) {
                // 后端还没开机，保持沉默，继续等
            }
            // 每隔 500 毫秒探一次鼻息
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 后端醒了！解除封印！
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.placeholder = "和 小咪 聊点什么吧...";
        appendMessage("✨ 小咪的大脑已连接，随时可以聊天喵！", 'bot-msg');
    }

    // 页面一加载，立刻开始探测后端
    waitForBackend();

    // --- 6. 聊天接口发送逻辑 (含 TTS 发声) ---
    async function handleSend() {
        if (!isBackendReady) return; // 🔒 没醒就不许发消息！

        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage(text, 'user-msg');
        chatInput.value = '';

        const botMsgDiv = appendMessage('正在思考...', 'bot-msg');

        try {
            const response = await fetch(BACKEND_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });
            const data = await response.json();

            // 显示文字
            botMsgDiv.textContent = data.reply;

            // 🌟 核心魔法：接收并播放 Base64 语音流！
            if (data.data && data.data.audio) {
                const audio = new Audio("data:audio/mp3;base64," + data.data.audio);
                audio.play();
            }

        } catch (error) {
            botMsgDiv.textContent = "大脑好像断线了，请确认 Python 后端已开启。";
        }
        scrollToBottom();
    }

    function appendMessage(text, className) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${className}`;
        msgDiv.textContent = text;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    function scrollToBottom() {
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    sendBtn.onclick = handleSend;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') handleSend(); };

    if (displayModeSelect.value === 'live2d') initLive2D();

    // ==========================================
    // 🌟 7. 多模态：纯离线触发 Python 本地听觉模型
    // ==========================================
    let isRecording = false;

    if (window.electronAPI) {
        window.electronAPI.onToggleSTT(async () => {
            if (!isBackendReady) {
                console.log("大脑还在加载，不许按耳朵！");
                return;
            }
            if (isRecording) {
                console.log("正在录音或解析中，请稍等喵...");
                return;
            }

            isRecording = true;
            chatInput.value = "";
            chatInput.placeholder = "🎤 竖起耳朵听着呢，主人请讲...";

            try {
                // 🔴 呼叫后端的本地 SenseVoice 引擎开启录音
                const response = await fetch(BACKEND_LISTEN_URL);
                const data = await response.json();

                if (data.status === "success") {
                    chatInput.value = data.text;
                    handleSend(); // 识别成功，自动触发发送逻辑！
                    chatInput.placeholder = "和 小咪 聊点什么吧..."; // 🌟 修复：发送成功后恢复正常提示语
                } else {
                    // 没听清，或者超时没说话
                    chatInput.placeholder = data.msg;
                    setTimeout(() => { chatInput.placeholder = "和 小咪 聊点什么吧..."; }, 3000); // 🌟 修复
                }
            } catch (err) {
                console.error("呼叫后端耳朵失败:", err);
                chatInput.placeholder = "后端耳朵没接通喵，请检查控制台~";
                setTimeout(() => { chatInput.placeholder = "和 小咪 聊点什么吧..."; }, 3000); // 🌟 修复
            } finally {
                // 解除锁定，允许下一次录音
                isRecording = false;
            }
        });
    }

})();