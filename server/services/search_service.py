# -*- coding: utf-8 -*-
"""
搜索服务模块 - 使用 Tavily API 进行真实网络搜索

Tavily 是专为 AI 应用设计的搜索 API，提供：
- 高质量的搜索结果
- 自动提取页面内容
- 支持学术搜索模式
"""

import os
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class SearchResult:
    """搜索结果数据类"""
    title: str
    url: str
    content: str  # 页面摘要或提取的内容
    score: float  # 相关性评分
    published_date: Optional[str] = None


class SearchService:
    """
    搜索服务类
    
    支持的搜索引擎：
    1. Tavily API（推荐，专为 AI 设计）
    2. 可扩展支持其他搜索 API
    """
    
    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY", "")
        self.tavily_base_url = "https://api.tavily.com"
        
        if not self.tavily_api_key:
            print("[WARN] TAVILY_API_KEY 未配置，搜索功能将不可用")
            print("       请在 .env 文件中添加: TAVILY_API_KEY=your_api_key")
            print("       获取 API Key: https://tavily.com/")
    
    def is_available(self) -> bool:
        """检查搜索服务是否可用"""
        return bool(self.tavily_api_key)
    
    def _clean_text(self, text: str) -> str:
        """
        清理文本中的特殊字符，避免 Windows 编码问题
        """
        if not text:
            return ""
        # 替换不间断空格和其他特殊空白字符
        text = text.replace('\xa0', ' ')  # 不间断空格
        text = text.replace('\u200b', '')  # 零宽空格
        text = text.replace('\u200c', '')  # 零宽非连接符
        text = text.replace('\u200d', '')  # 零宽连接符
        text = text.replace('\ufeff', '')  # BOM
        # 移除其他不可打印字符
        text = ''.join(c if c.isprintable() or c in '\n\r\t' else ' ' for c in text)
        return text.strip()
    
    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: str = "advanced",  # "basic" 或 "advanced"
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None
    ) -> List[SearchResult]:
        """
        执行网络搜索
        
        Args:
            query: 搜索关键词
            max_results: 最大返回结果数
            search_depth: 搜索深度，"advanced" 会提取更多页面内容
            include_domains: 仅搜索这些域名
            exclude_domains: 排除这些域名
            
        Returns:
            搜索结果列表
        """
        if not self.is_available():
            print("[WARN] 搜索服务不可用，返回空结果")
            return []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "api_key": self.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": search_depth,
                    "include_answer": False,  # 不需要 AI 答案，只要搜索结果
                    "include_raw_content": False,
                }
                
                if include_domains:
                    payload["include_domains"] = include_domains
                if exclude_domains:
                    payload["exclude_domains"] = exclude_domains
                
                response = await client.post(
                    f"{self.tavily_base_url}/search",
                    json=payload
                )
                
                if response.status_code != 200:
                    print(f"[ERROR] Tavily 搜索失败: {response.status_code} - {response.text}")
                    return []
                
                data = response.json()
                results = []
                
                for item in data.get("results", []):
                    # 清理特殊字符（如不间断空格），避免 Windows 编码问题
                    title = self._clean_text(item.get("title", ""))
                    content = self._clean_text(item.get("content", ""))
                    
                    results.append(SearchResult(
                        title=title,
                        url=item.get("url", ""),
                        content=content,
                        score=item.get("score", 0.0),
                        published_date=item.get("published_date")
                    ))
                
                print(f"[搜索] 获得 {len(results)} 条结果")
                return results
                
        except Exception as e:
            print(f"[ERROR] 搜索异常: {e}")
            return []
    
    async def search_for_research(
        self,
        topic: str,
        context: str = ""
    ) -> Dict[str, Any]:
        """
        为调研目的执行搜索，返回格式化的搜索结果
        
        Args:
            topic: 调研主题
            context: 额外上下文（如用户的需求描述）
            
        Returns:
            {
                "sources": [...],  # 来源列表
                "context": "..."   # 整合后的搜索内容，用于传给 AI
            }
        """
        # 构建搜索查询
        search_queries = [
            f"{topic} 研究 学术",
            f"{topic} 专家观点 分析",
            f"{topic} 数据 报告"
        ]
        
        all_results: List[SearchResult] = []
        
        # 执行多次搜索，获取更全面的结果
        for query in search_queries:
            results = await self.search(
                query=query,
                max_results=3,
                search_depth="advanced"
            )
            all_results.extend(results)
        
        # 去重（按 URL）
        seen_urls = set()
        unique_results = []
        for r in all_results:
            if r.url not in seen_urls:
                seen_urls.add(r.url)
                unique_results.append(r)
        
        # 按相关性排序
        unique_results.sort(key=lambda x: x.score, reverse=True)
        
        # 限制最终结果数量
        final_results = unique_results[:8]
        
        # 格式化来源信息
        sources = [
            {
                "title": r.title,
                "url": r.url,
                "published_date": r.published_date
            }
            for r in final_results
        ]
        
        # 整合搜索内容作为 AI 上下文
        context_parts = []
        for i, r in enumerate(final_results, 1):
            context_parts.append(f"""
【来源{i}】{r.title}
链接：{r.url}
内容摘要：{r.content[:500] if r.content else '无摘要'}
""")
        
        combined_context = "\n".join(context_parts)
        
        return {
            "sources": sources,
            "context": combined_context,
            "query_count": len(search_queries),
            "result_count": len(final_results)
        }


# 单例实例
search_service = SearchService()

