# backend/tools/weather.py
import json
import os

import requests
from dotenv import load_dotenv
from tools.registry import tool

load_dotenv()


@tool(
    name="get_current_weather",
    description="专门用于查询指定城市今天、明天、后天的天气预报。",
    parameters={
        "type": "object",
        "properties": {
            "city": {"type": "string", "description": "城市名称，例如：北京、广州"}
        },
        "required": ["city"]
    }
)
def get_current_weather(city: str) -> str:
    print(f"☁️ [气象局连线]: 小咪正在向卫星请求 {city} 的三天天气预报...")

    api_key = os.getenv("SENIVERSE_API_KEY")
    if not api_key:
        return "天气系统未配置 SENIVERSE_API_KEY，请主人检查 .env 文件喵~"

    # 心知天气的 API 接口
    url = f"https://api.seniverse.com/v3/weather/daily.json?key={api_key}&location={city}&language=zh-Hans&unit=c&start=0&days=3"

    try:
        # 发送真实的网络请求
        response = requests.get(url, timeout=5)

        # 检查是否请求成功
        if response.status_code != 200:
            return f"气象API不支持查询城市 '{city}',立刻调用 [web_search] 工具在全网检索该城市的天气"

        data = response.json()

        # 解析返回的 3 天预报数组
        daily_forecasts = data["results"][0]["daily"]

        # 组装一份“气象报告”给 Kimi 看
        report_lines = [f"{city}近三天天气预报："]
        for day in daily_forecasts:
            date = day["date"]  # 日期，如 2026-02-27
            text_day = day["text_day"]  # 白天天气，如 晴
            high = day["high"]  # 最高温
            low = day["low"]  # 最低温
            report_lines.append(f"- {date}: 白天{text_day}，气温 {low}℃ 到 {high}℃。")

        # 拼成一整段纯文本返回给大脑
        return "\n".join(report_lines)

    except requests.exceptions.Timeout:
        return "呼叫气象卫星超时了喵，可能是网络不太好~"
    except Exception as e:
        print(f"❌ 天气工具报错: {e}")
        return f"查询天气时发生了未知的错误喵：{e}"