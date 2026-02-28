import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["MODELSCOPE_CACHE"] = os.path.join(os.path.dirname(__file__), "models")


import base64
import re
import tempfile
import uuid

import edge_tts
import speech_recognition as sr
import uvicorn
from brain import Brain
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# 🌟 新王登基：引入阿里 FunASR 听觉引擎
from funasr import AutoModel
from pydantic import BaseModel

app = FastAPI()
my_brain = Brain()  # 激活大脑

# ==========================================
# 🧠 全局挂载阿里 SenseVoice 听觉引擎
# ==========================================
print("🧠 [系统]: 正在挂载阿里 SenseVoice 听觉引擎。首次运行将从魔搭社区下载约 1GB 模型，可能需要数分钟，请耐心等待...")
sense_model = AutoModel(
    model="iic/SenseVoiceSmall",
    device="cpu",
    trust_remote_code=True,
    disable_update=True
)
print("✅ [系统]: 国产听觉神经已满血离线挂载！")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 📜 核心：前端防弹协议 ---
class ChatRequest(BaseModel):
    text: str


class ChatResponse(BaseModel):
    type: str = "chat"
    reply: str
    action: str = ""
    expression: str = ""
    data: dict = {}

@app.get("/ping")
def ping():
    return {"status": "ok"}
# --- 🚀 路由网关 ---
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    print(f"[主人发来]: {request.text}")

    try:
        # 把问题扔给大脑
        reply_text = my_brain.think(request.text)
        print(f"[小咪回复]: {reply_text}")

        communicate = edge_tts.Communicate(
            text=reply_text,
            voice="zh-CN-XiaoyiNeural",
            rate="+10%",
            pitch="+15Hz"
        )

        temp_audio_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.mp3")
        await communicate.save(temp_audio_path)

        with open(temp_audio_path, "rb") as f:
            audio_base64 = base64.b64encode(f.read()).decode("utf-8")

        os.remove(temp_audio_path)

        # 严格按照“防弹协议”打包发给前端
        return ChatResponse(
            type="chat",
            reply=reply_text,
            action="TapBody",
            data={"audio": audio_base64}
        )

    except Exception as e:
        print(f"❌ [大脑/发声异常]: {e}")
        # 大脑出错了，也必须按标准协议返回，绝不让前端崩溃！
        return ChatResponse(
            type="error",
            reply="（猫耳低垂）哎呀，主人的网络好像有点问题，小咪脑子卡住了喵...",
            action="Angry"
        )


@app.get("/listen")
def listen_to_user():
    """纯离线多模态：阿里 SenseVoice 听觉接口"""
    r = sr.Recognizer()
    r.pause_threshold = 2.0
    try:
        with sr.Microphone() as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            print("🟢 [本地耳朵]: 正在全神贯注监听麦克风...")

            # 获取用户说话的音频流
            audio = r.listen(source, timeout=5, phrase_time_limit=10)
            print("🔄 [本地耳朵]: 录音完毕，SenseVoice 极速解析中...")

            # 🌟 将音频流保存为临时 WAV 文件，喂给阿里模型
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(audio.get_wav_data())
                temp_wav_path = f.name

            try:
                # 离线解析！强制中文，并开启智能标点转换
                res = sense_model.generate(
                    input=temp_wav_path,
                    cache={},
                    language="zh",
                    use_itn=True
                )

                if res and len(res) > 0:
                    raw_text = res[0].get("text", "")

                    # ⚠️ 关键清洗：用正则把阿里的情感标签 <|zh|><|NEUTRAL|><|Speech|> 剔除掉
                    clean_text = re.sub(r'<\|.*?\|>', '', raw_text).strip()

                    print(f"✨ [本地耳朵]: 听懂了！【{clean_text}】")
                    return {"status": "success", "text": clean_text}
                else:
                    return {"status": "error", "msg": "没听清喵，能再说一遍吗？"}

            finally:
                # 无论成功失败，一定要清理掉临时音频文件，防止塞满用户硬盘
                if os.path.exists(temp_wav_path):
                    os.remove(temp_wav_path)

    except sr.WaitTimeoutError:
        return {"status": "error", "msg": "等了半天，主人好像没有说话喵？"}
    except sr.UnknownValueError:
        return {"status": "error", "msg": "听不清喵，能再说一遍吗？"}
    except Exception as e:
        print(f"❌ [本地耳朵异常]: {e}")
        return {"status": "error", "msg": "本地耳朵短路了喵~"}


if __name__ == "__main__":
    print("🚀 OnePixel 网关启动中...")
    print("服务运行在: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)