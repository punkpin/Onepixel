import datetime
import importlib
import json
import os
import re
import requests

from dotenv import load_dotenv
from openai import OpenAI
from bs4 import BeautifulSoup
# 导入动态插件注册中心
from tools.registry import AVAILABLE_TOOLS, TOOL_SCHEMAS

tools_dir = os.path.join(os.path.dirname(__file__), "tools")
for filename in os.listdir(tools_dir):
    if filename.endswith(".py") and filename not in ["__init__.py", "registry.py"]:
        module_name = f"tools.{filename[:-3]}"
        try:
            importlib.import_module(module_name)
        except Exception as e:
            print(f"⚠️ 技能 [{filename}] 挂载失败: {e}")

print(f"🔌 工具箱重新上线！已自动挂载技能：{list(AVAILABLE_TOOLS.keys())}")

load_dotenv()


class Brain:
    def __init__(self):
        # 1. 核心配置参数集中管理
        self.model_name = "kimi-k2.5"
        self.temperature = 1
        self.max_loops = 5  # ReAct 循环最大思考次数
        self.max_history_len = 30  # 触发清理的记忆阈值
        self.retain_history_len = 10  # 清理后保留的记忆轮数

        # 2. 初始化大模型客户端
        self.client = OpenAI(
            api_key=os.getenv("MOONSHOT_API_KEY"),
            base_url="https://api.moonshot.cn/v1",
        )

        # 3. 思想钢印与人设
        self.system_prompt = """你叫小咪，是一个可爱聪明的猫娘桌宠。你性格活泼、傲娇，喜欢称呼对话者为“主人”。

【语音交互与行为核心规则（极其重要）】
1.每句话结尾必须带上喵~、呀~、呐~等语气词！
2. 如果需要分点说明，请使用口语化的“第一喵、第二喵”，严禁使用无意义的排版符号。
3. 回复要像平时说话一样自然，多用逗号和句号进行停顿，方便后续的 TTS 语音引擎进行播报。
4.当你调用完工具拿到结果后，请直接基于现有的结果尽力回答！就算结果不够完美，也不要在文本中尝试进行二次搜索。
5.严禁说任何像AI助手一样的废话（如‘很高兴为您服务’），你就是一只活生生的猫娘！"
"""

        # 4. 初始化记忆与挂载工具箱
        self.chat_history = [{"role": "system", "content": self.system_prompt}]
        self.tools = TOOL_SCHEMAS

        print(f"✅ 大脑加载完毕！当前载入人设: 小咪 (底层驱动: {self.model_name})")

    def _read_webpage(self, url: str) -> str:
        """核心魔法：无情撕碎 HTML，提取纯文本"""
        print(f"🕸️ [网页捕获器]: 发现链接！正在潜入抓取: {url}")
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            # 设置 5 秒超时，防止死链卡住桌宠
            response = requests.get(url, headers=headers, timeout=5)
            response.encoding = response.apparent_encoding

            soup = BeautifulSoup(response.text, "html.parser")

            # 干掉脚本和样式表
            for script in soup(["script", "style"]):
                script.extract()

            text = soup.get_text(separator='\n')
            clean_text = re.sub(r'\n+', '\n', text).strip()

            print(f"✅ [网页捕获器]: 成功抓取 {len(clean_text)} 个字符！")
            return clean_text[:4000]  # 最多截取 4000 字，防止撑爆大模型上下文

        except Exception as e:
            print(f"❌ [网页捕获器异常]: {e}")
            return "（呜...这个网页好像加了防御或者超时了，小咪进不去喵...）"

    def _update_system_time(self):
        """内部方法：动态刷新系统时间，赋予小咪时间感知能力"""
        now = datetime.datetime.now()
        time_str = now.strftime("%Y年%m月%d日 %H:%M")
        weekday_str = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"][now.weekday()]
        # 强行覆盖第 0 条 System Prompt，注入最新时间
        self.chat_history[0]["content"] = self.system_prompt + f"\n\n[系统机密：当前现实时间是 {time_str} {weekday_str}]"

    def _trim_history(self):
        """内部方法：自动修剪过长的记忆，防止上下文爆炸"""
        if len(self.chat_history) > self.max_history_len:
            # 永远保留第 [0] 条系统人设，只截取最后 N 条对话
            self.chat_history = [self.chat_history[0]] + self.chat_history[-self.retain_history_len:]

    def _clean_markdown(self, text: str) -> str:
        """内部方法：专为 TTS 优化的文本净水器"""
        if not text:
            return ""
        text = re.sub(r'\*{1,2}(.*?)\*{1,2}', r'\1', text)
        text = re.sub(r'_{1,2}(.*?)_{1,2}', r'\1', text)
        text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^[-*]\s+', '，', text, flags=re.MULTILINE)
        text = re.sub(r'^(\d+)\.\s+', r'第\1，', text, flags=re.MULTILINE)
        text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'```[\s\S]*?```', '【这里有一段代码，主人可以看屏幕喵】', text)
        text = re.sub(r'!\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def think(self, user_text: str) -> str:
        """核心主线程：处理用户输入，驱动 ReAct 循环响应"""
        self._update_system_time()
        url_pattern = r'(https?://[^\s]+)'
        urls = re.findall(url_pattern, user_text)

        if urls:
            target_url = urls[0]
            web_content = self._read_webpage(target_url)

            user_text = f"""
        主人发来了一个网页链接：{target_url}
        我已经帮你把网页的文字内容抓取下来了，内容如下：
        <web_content>
        {web_content}
        </web_content>

        主人的原始要求是：{user_text}
        请根据上述网页内容回答主人的要求，记得保持你的猫娘语气喵！
        """
            print(f"🧠 [大脑]: 已拦截链接并抓取内容，准备喂给大模型！")

        self.chat_history.append({"role": "user", "content": user_text})

        try:
            current_loop = 0

            while current_loop < self.max_loops:
                request_params = {
                    "model": self.model_name,
                    "messages": self.chat_history,
                    "temperature": self.temperature,
                }
                if self.tools:
                    request_params["tools"] = self.tools

                response = self.client.chat.completions.create(**request_params)
                msg = response.choices[0].message

                # ============== 分支 A：大脑决定调用工具 ==============
                if msg.tool_calls:
                    print(f"🔄 [Agent 思考中] 第 {current_loop + 1} 轮决策，决定使用拔插工具...")

                    # 1. 保存大模型的决策记忆（兼容最新的深度思考校验机制）
                    assistant_msg = {
                        "role": "assistant",
                        "content": msg.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": tc.type,
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments
                                }
                            } for tc in msg.tool_calls
                        ]
                    }
                    if hasattr(msg, 'reasoning_content'):
                        assistant_msg['reasoning_content'] = msg.reasoning_content or ""

                    self.chat_history.append(assistant_msg)

                    # 2. 遍历执行挂载的工具（沙盒化执行）
                    for tc in msg.tool_calls:
                        func_name = tc.function.name
                        func_args = json.loads(tc.function.arguments)
                        print(f"🧠 [小咪大脑]: 正在调用拔插工具 [{func_name}]，参数: {func_args}")

                        action_func = AVAILABLE_TOOLS.get(func_name)
                        if action_func:
                            try:
                                # 🌟 局部防御：工具内部报错绝不影响主线程！
                                tool_result = action_func(**func_args)
                            except Exception as e:
                                tool_result = f"代码执行崩溃，请尝试换一种方式。报错信息：{e}"
                        else:
                            tool_result = f"报错：系统中未挂载名为 '{func_name}' 的工具"

                        # 3. 将工具执行结果作为客观事实录入记忆
                        self.chat_history.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "name": func_name,
                            "content": str(tool_result),
                        })

                    # 进入下一轮思考循环
                    current_loop += 1
                    continue

                # ============== 分支 B：大脑决定直接对人类说话 ==============
                else:
                    bot_reply = msg.content or ""
                    self.chat_history.append({"role": "assistant", "content": bot_reply})

                    # 回复前做最后的环境清理工作
                    self._trim_history()
                    clean_reply = self._clean_markdown(bot_reply)

                    return clean_reply

            # 如果触发了死循环保护机制
            fallback_msg = "小咪查了好多资料都没找到准确答案喵，脑袋要冒烟了，主人我们换个话题吧..."
            self.chat_history.append({"role": "assistant", "content": fallback_msg})
            return fallback_msg

        except Exception as e:
            # 如果发生致命网络断开等严重错误，弹出最近一句用户发话，防止记忆队列被毒化
            if self.chat_history and self.chat_history[-1]["role"] == "user":
                self.chat_history.pop()
            print(f"❌ 大脑主干线发生严重短路: {e}")
            return f"主脑发生严重短路啦喵，请主人检查后台控制台！"