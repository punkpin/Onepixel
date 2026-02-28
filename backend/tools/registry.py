import importlib
import os

AVAILABLE_TOOLS = {}
TOOL_SCHEMAS = []


def tool(name: str, description: str, parameters: dict):

    def decorator(func):
        # 1. 登记执行函数
        AVAILABLE_TOOLS[name] = func
        # 2. 登记说明书 (JSON Schema)
        TOOL_SCHEMAS.append({
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
            }
        })
        return func

    return decorator


def auto_discover_tools():

    tools_dir = os.path.dirname(__file__)
    for filename in os.listdir(tools_dir):
        if filename.endswith(".py") and filename not in ["__init__.py", "registry.py"]:
            module_name = filename[:-3]  # 去掉 .py 后缀
            # 动态导入模块，这一步会自动触发模块里的 @tool 装饰器
            importlib.import_module(f"tools.{module_name}")

    print(f"🔌 工具箱扫描完毕！已自动挂载 {len(AVAILABLE_TOOLS)} 个技能：{list(AVAILABLE_TOOLS.keys())}")