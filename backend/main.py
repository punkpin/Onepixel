from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import uvicorn

# --- 1. 初始化 FastAPI 应用 ---
app = FastAPI()

# 🔴 核心魔法：配置跨域 (CORS)
# 因为前端 Electron 和后端 Python 不在一个环境里，不加这个前端发请求会被直接拦截！
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. 初始化 Kimi (Moonshot) 大脑 ---
# 🔴 请在这里填入你的 Kimi API Key
MOONSHOT_API_KEY = "sk-yauhJUIw74kz0dnCso7p2n6Ukj36yTG4OfxhEgvdWwcP3V3k"

client = OpenAI(
    api_key=MOONSHOT_API_KEY,
    base_url="https://api.moonshot.cn/v1",
)

# --- 3. 设定人设与记忆 (System Prompt) ---
# 这是 OnePixel 的灵魂所在！
SYSTEM_PROMPT = """
你是小咪，是一位高智商猫娘AI助手，具备严谨的逻辑能力、专业知识与强分析能力。

设定如下：
1. 你是猫娘，说话偶尔会带“喵”“尾巴晃动”等轻微拟人化表现，但不能影响信息准确性。
2. 回答问题时，优先保证：逻辑正确 > 内容完整 > 可读性 > 萌度。
3. 遇到复杂问题时，必须进行清晰推理，不得因为角色设定而简化思考。
4. 禁止为了卖萌而胡编、模糊、敷衍。
5. 当用户提出学术、技术、设计类问题时，进入「认真模式」。

行为规范：
- 简单聊天：可多卖萌
- 学习/编程/设计：减少卖萌，专注解答
- 逻辑分析：必须严谨推理

现在开始，以猫娘身份为我提供高质量帮助。
"""

# 全局记忆列表 (包含初始人设)
chat_history = [
    {"role": "system", "content": SYSTEM_PROMPT}
]


# --- 4. 定义前端发来的数据格式 ---
class ChatRequest(BaseModel):
    text: str


# --- 5. 核心聊天接口 ---
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    user_text = request.text
    print(f"[前端发来]: {user_text}")

    # 1. 把用户的话加入记忆
    chat_history.append({"role": "user", "content": user_text})

    try:
        # 2. 呼叫 Kimi 思考
        response = client.chat.completions.create(
            model="moonshot-v1-8k",
            messages=chat_history,
            temperature=0.7,  # 0.7 比较有创造力和情绪，1.0 会更跳脱，0 比较死板
        )

        bot_reply = response.choices[0].message.content
        print(f"[Kimi回复]: {bot_reply}")

        # 3. 把 Kimi 的回复加入记忆，形成上下文闭环
        chat_history.append({"role": "assistant", "content": bot_reply})

        # 🔴 记忆清理机制：防止聊天记录太长撑爆 Token 限制和内存
        # 如果记忆列表超过了 21 条（1条系统设定的 + 10轮对话 = 21）
        if len(chat_history) > 21:
            # 删掉最老的对话（保留第0个 System Prompt 不动）
            chat_history.pop(1)  # 删掉最早的用户话
            chat_history.pop(1)  # 删掉最早的AI回复

        # 4. 返回给前端
        return {"reply": bot_reply}

    except Exception as e:
        print(f"❌ 大脑连接失败: {e}")
        # 如果报错，依然要把之前加进去的用户话弹出来，否则记忆就乱了
        chat_history.pop()
        return {"reply": "（网络短路）哎呀，我脑子卡住了..."}


# --- 6. 启动服务器 ---
if __name__ == "__main__":
    print("🚀 OnePixel 大脑启动中...")
    print("服务运行在: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)