# OnePixel - 可爱猫娘桌宠 (Kimi AI 驱动)

OnePixel 是一个由 Kimi AI 驱动的桌面宠物应用程序，它以可爱的猫娘形象陪伴您，并具备强大的 AI 交互能力。它不仅能进行智能对话，还能根据您的指令执行多种任务，例如屏幕内容分析、联网搜索、天气查询等。

## ✨ 主要特性

-   **智能猫娘对话**: 基于 Kimi AI 提供生动、活泼、傲娇的猫娘人设交互体验。
-   **语音交互 (STT & TTS)**: 支持语音输入 (Speech-to-Text) 和语音输出 (Text-to-Speech)，实现更自然的交流。
-   **屏幕内容分析**: 能够“看”懂您的屏幕内容，并根据您的指令进行视觉分析（例如，看代码报错、看游戏画面）。
-   **联网搜索**: 当需要获取最新资讯或未知事实时，可进行全网搜索并总结信息。
-   **天气查询**: 支持查询指定城市未来三天的天气预报。
-   **可定制性**: 预留了前端配置接口，方便未来通过设置面板调整模型参数、API 密钥等。
-   **全局快捷键**: 默认 `Alt+V` 唤起语音输入，方便快捷。
-   **轻量级**: 基于 Electron + FastAPI 构建，占用资源少。

## 🚀 快速开始

### 前提条件

在运行 OnePixel 之前，请确保您的系统已安装以下软件：

-   **Node.js & npm**: 用于运行 Electron 前端。推荐使用 LTS 版本。
-   **Python 3.9+**: 用于运行 FastAPI 后端。
-   **FFmpeg & FFprobe**: 用于语音处理，确保 `ffmpeg.exe` 和 `ffprobe.exe` 在 `backend` 目录下或系统 PATH 中。

### 1. 克隆仓库

```bash
git clone [您的仓库地址]
cd OnePixel
```

### 2. 配置环境变量

在 `OnePixel` 根目录下创建 `.env` 文件，并填入您的 API 密钥：

```
# Kimi AI API Key (Moonshot AI)
MOONSHOT_API_KEY=sk-xxxxxx

# Tavily Search API Key (用于联网搜索)
TAVILY_API_KEY=tvly-xxxxxx

# Seniverse Weather API Key (用于天气查询)
SENIVERSE_API_KEY=your_seniverse_api_key
```

-   **MOONSHOT_API_KEY**: 从 [Moonshot AI 官网](https://www.moonshot.cn/) 获取。
-   **TAVILY_API_KEY**: 从 [Tavily AI 官网](https://tavily.com/) 获取。
-   **SENIVERSE_API_KEY**: 从 [心知天气官网](https://www.seniverse.com/) 获取。

### 3. 启动后端服务

进入 `backend` 目录，安装 Python 依赖并启动服务：

```bash
cd backend
pip install -r requirements.txt
python main.py
```

首次运行 `main.py` 时，它会下载 Kimi AI 的 SenseVoice 语音模型（约 1GB），请耐心等待。下载进度会在控制台显示。

### 4. 启动前端应用

打开一个新的终端窗口，进入 `OnePixel` 根目录，安装 Node.js 依赖并启动应用：

```bash
cd .. # 如果您在 backend 目录，请先返回根目录
npm install
npm start
```

## 🛠️ 工具扩展

OnePixel 的后端设计支持通过插件系统轻松扩展功能。您可以在 `backend/tools` 目录下添加新的 Python 文件，使用 `@tool` 装饰器定义新的工具，并提供其名称、描述和参数 schema。系统会自动发现并挂载这些新工具，猫娘 AI 将能够在对话中智能调用它们。

## ⚙️ 设置 (开发中)

目前应用的设置（例如窗口尺寸、快捷键等）存储在内存中。未来将提供用户友好的设置面板，实现持久化配置。

## ⚠️ 注意事项

-   **后端模型下载**: 首次启动后端时，SenseVoice 模型下载需要时间。
-   **文件权限**: 如果遇到文件权限问题（尤其是在 Windows 上），请尝试以管理员身份运行终端或删除 `C:\Users\您的用户名\AppData\Roaming\onepixel` 目录下的缓存文件。
-   **API Key**: 确保 `.env` 文件中的 API Key 配置正确且有效。

希望您喜欢您的猫娘桌宠！喵~
