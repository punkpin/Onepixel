# backend/tools/search.py
import os

from dotenv import load_dotenv
from tavily import TavilyClient
from tools.registry import tool

# 加载 .env 里的秘钥
load_dotenv()


@tool(
    name="web_search",
    description="当用户询问最新的新闻、当下的实时信息、或者你不知道的客观事实时，必须调用此工具进行联网搜索。",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "要搜索的精准关键词，例如：'2026春节档票房' 或 '今天A股大盘走势'"}
        },
        "required": ["query"]
    }
)
def web_search(query: str) -> str:
    print(f"🌍 [全网搜索启动]: 小咪正在动用 Tavily 引擎极速检索 -> {query}")

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "搜索失败：系统未配置 TAVILY_API_KEY，请主人检查 .env 文件喵~"

    try:
        # 初始化正规军搜索客户端
        client = TavilyClient(api_key=api_key)

        # 执行极速搜索，获取最相关的 3 条结果（专为大模型优化过的纯净文本）
        response = client.search(query, search_depth="basic", max_results=3)

        results = response.get("results", [])
        if not results:
            return "没有搜索到相关结果喵，可能是一件很冷门的事情呢~"

        # 优雅地格式化结果
        formatted_results = []
        for i, res in enumerate(results):
            # Tavily 会直接返回极其干净的 content 摘要，不带任何恶心的 HTML 标签
            formatted_results.append(f"结果 {i + 1}:\n标题: {res.get('title')}\n内容: {res.get('content')}")

        return "\n\n".join(formatted_results)

    except Exception as e:
        print(f"❌ 搜索工具报错: {e}")
        return f"搜索过程中发生了错误喵，报告错误：{e}"