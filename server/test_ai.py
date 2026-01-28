"""
测试 AI API 连接
"""
import asyncio
import os
from dotenv import load_dotenv, dotenv_values
from anthropic import AsyncAnthropic
from pathlib import Path

# 强制从 .env 文件加载，覆盖系统环境变量
env_file = Path(__file__).parent / ".env"
env_values = dotenv_values(env_file)

async def test_ai():
    # 直接使用从文件读取的值
    api_key = env_values.get("ANTHROPIC_API_KEY")
    base_url = env_values.get("ANTHROPIC_BASE_URL")
    model = env_values.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    
    print(f"API Key: {api_key[:20]}...")
    print(f"Base URL: {base_url}")
    print(f"Model: {model}")
    print("\n开始测试...")
    
    try:
        client = AsyncAnthropic(
            api_key=api_key,
            base_url=base_url
        )
        
        response = await client.messages.create(
            model=model,
            max_tokens=100,
            temperature=0.7,
            system="你是一个测试助手。",
            messages=[{
                "role": "user",
                "content": "请说'你好，测试成功！'"
            }]
        )
        
        print(f"\n响应类型: {type(response)}")
        print(f"响应对象: {response}")
        print(f"\n响应内容类型: {type(response.content)}")
        print(f"响应内容: {response.content}")
        
        if hasattr(response.content, '__iter__'):
            print(f"\n第一个内容块类型: {type(response.content[0])}")
            print(f"第一个内容块: {response.content[0]}")
            
            if hasattr(response.content[0], 'text'):
                print(f"\n✅ 成功！文本内容: {response.content[0].text}")
            else:
                print(f"\n❌ 错误：content[0] 没有 text 属性")
                print(f"可用属性: {dir(response.content[0])}")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ai())
