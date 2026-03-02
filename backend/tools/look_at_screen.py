import os
import base64
from io import BytesIO
from PIL import ImageGrab
from openai import OpenAI

from tools.registry import tool

@tool(
    name="look_at_screen",
    description="当主人让你看屏幕、看看你在干嘛、或者问屏幕上有什么/报错是什么时，必须调用此工具。它会截取主人当前的电脑全屏并进行视觉分析。",
    parameters={
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "希望重点关注的屏幕区域或问题，例如'帮我看看这行代码的报错'或'看看我屏幕上的游戏'"
            }
        },
        "required": ["prompt"]
    }
)
def look_at_screen(prompt: str = "请详细描述你现在看到的屏幕画面，重点关注主人可能在问的内容") -> str:
    """
    当主人说“看看我的屏幕”、“帮我看看这个报错”、“屏幕上是什么”等暗示需要你主动观察屏幕的指令时，必须调用此工具！
    该工具会自动截取主人当前的电脑全屏画面并进行分析。
    :param prompt: 你希望视觉引擎重点关注的区域或问题。可以把主人的原话放进来。
    """
    print(f"👁️ [主动视觉神经]: 收到指令！正在悄悄截取主人全屏...")

    try:
        # 1. 瞬间截取电脑全屏
        screenshot = ImageGrab.grab()

        # 2. 将截图转换为内存中的 Base64 格式（稍微压缩一下，防止撑爆网络）
        buffered = BytesIO()
        screenshot.convert("RGB").save(buffered, format="JPEG", quality=80)
        base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")

        print(f"📸 [主动视觉神经]: 截屏成功！正在上传至视觉皮层，问题：{prompt}")

        # 3. 呼叫视觉大模型进行分析
        client = OpenAI(
            api_key=os.getenv("MOONSHOT_API_KEY"),
            base_url="https://api.moonshot.cn/v1",
        )

        response = client.chat.completions.create(
            model="kimi-k2.5",  # 确保使用支持 vision 的模型
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ],
            temperature=1
        )

        result = response.choices[0].message.content
        print(f"✅ [主动视觉神经]: 屏幕分析完成！结果：{result[:50]}...")

        return result

    except Exception as e:
        return f"截屏或分析失败，呜呜...小咪的眼睛好像进了沙子，请告诉主人报错了：{e}"