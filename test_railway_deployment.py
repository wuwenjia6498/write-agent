# -*- coding: utf-8 -*-
"""
测试 Railway 部署的后端服务
"""

import requests
import json

def test_railway_backend(railway_url):
    """
    测试 Railway 后端各个端点
    
    Args:
        railway_url: Railway 部署的 URL，例如：https://xxx.railway.app
    """
    
    # 移除末尾的斜杠
    railway_url = railway_url.rstrip('/')
    
    print(f"[INFO] 测试 Railway 后端：{railway_url}\n")
    
    # 测试 1: 根路径健康检查
    print("[TEST 1] 根路径健康检查...")
    try:
        response = requests.get(f"{railway_url}/", timeout=10)
        print(f"  状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [SUCCESS] {data.get('message', '')}")
            print(f"  版本: {data.get('version', '')}")
        else:
            print(f"  [FAILED] 返回状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] 连接失败: {e}")
        return False
    
    # 测试 2: 健康检查端点
    print("\n[TEST 2] 健康检查端点...")
    try:
        response = requests.get(f"{railway_url}/health", timeout=10)
        print(f"  状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [SUCCESS] 服务健康")
            print(f"  环境: {data.get('environment', '')}")
        else:
            print(f"  [WARN] 健康检查未通过")
    except Exception as e:
        print(f"  [WARN] 健康检查失败: {e}")
    
    # 测试 3: 频道列表 API
    print("\n[TEST 3] 频道列表 API...")
    try:
        response = requests.get(f"{railway_url}/api/channels", timeout=10)
        print(f"  状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [SUCCESS] 找到 {len(data)} 个频道：")
            for channel in data:
                print(f"    - {channel.get('name', '')} ({channel.get('slug', '')})")
        else:
            print(f"  [FAILED] 无法获取频道列表")
            print(f"  响应: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  [ERROR] API 调用失败: {e}")
        return False
    
    # 测试 4: CORS 配置
    print("\n[TEST 4] CORS 配置检查...")
    try:
        # 模拟前端请求
        headers = {
            'Origin': 'https://your-vercel-app.vercel.app',
            'Access-Control-Request-Method': 'GET'
        }
        response = requests.options(f"{railway_url}/api/channels", headers=headers, timeout=10)
        
        if 'access-control-allow-origin' in response.headers:
            print(f"  [SUCCESS] CORS 配置正确")
            print(f"  允许的源: {response.headers.get('access-control-allow-origin')}")
        else:
            print(f"  [WARN] 可能存在 CORS 问题")
    except Exception as e:
        print(f"  [WARN] CORS 测试失败: {e}")
    
    print("\n" + "="*50)
    print("[SUCCESS] 所有关键测试通过！后端部署成功！")
    print("="*50)
    
    return True

if __name__ == "__main__":
    print("\n" + "="*50)
    print("Railway 后端部署测试脚本")
    print("="*50 + "\n")
    
    # 从用户输入获取 Railway URL
    railway_url = input("请输入你的 Railway 后端 URL (例如 https://xxx.railway.app): ").strip()
    
    if not railway_url:
        print("[ERROR] 未提供 URL")
        exit(1)
    
    if not railway_url.startswith('http'):
        railway_url = 'https://' + railway_url
    
    print()
    success = test_railway_backend(railway_url)
    
    if success:
        print(f"\n[NEXT] 下一步：在 Vercel 中设置环境变量")
        print(f"  变量名: NEXT_PUBLIC_API_URL")
        print(f"  变量值: {railway_url}")
        print(f"\n  设置后重新部署 Vercel 项目即可！")
    else:
        print("\n[INFO] 部署存在问题，请检查 Railway 日志")
        print("  1. 进入 Railway Dashboard")
        print("  2. 点击项目 → Deployments")
        print("  3. 查看最新部署的日志")
