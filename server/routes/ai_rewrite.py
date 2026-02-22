"""
AI 局部重写路由
提供划词重写（Inline Rewrite）和文章静默保存两个接口
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from services.ai_service import ai_service
from services.workflow_engine import workflow_engine
from services.db_service import db_service

router = APIRouter()


# ============================================================================
# 请求模型
# ============================================================================

class InlineRewriteRequest(BaseModel):
    """划词重写请求"""
    task_id: str = Field(..., description="任务 ID")
    channel_slug: str = Field(..., description="频道 slug，用于加载频道纪律红线")
    selected_text: str = Field(..., description="用户划选的原文片段")
    surrounding_context: str = Field("", description="选区前后各约 200 字的上下文")
    user_instruction: str = Field(..., description="用户给 AI 的修改指令")


class UpdateArticleRequest(BaseModel):
    """静默保存文章请求"""
    task_id: str = Field(..., description="任务 ID")
    content: str = Field(..., description="完整的最新文章内容")
    content_type: str = Field("final", description="draft 或 final，决定写入哪个字段")


# ============================================================================
# 接口：划词 AI 重写
# ============================================================================

@router.post("/inline-rewrite")
async def inline_rewrite(request: InlineRewriteRequest):
    """
    对用户划选的文本片段进行 AI 局部重写。

    流程：
    1. 根据 channel_slug 加载频道配置，提取频道纪律红线
    2. 组装"局部微创手术"System Prompt
    3. 调用 LLM 生成重写结果
    4. 仅返回重写后的纯文本，不含任何多余内容
    """
    if not request.selected_text.strip():
        raise HTTPException(status_code=400, detail="划选文本不能为空")
    if not request.user_instruction.strip():
        raise HTTPException(status_code=400, detail="修改指令不能为空")

    # 加载频道纪律红线
    channel_rules_prompt = ""
    try:
        channel_config = workflow_engine.load_channel_config(request.channel_slug)
        channel_rules_prompt = workflow_engine._build_channel_rules_prompt(channel_config)
    except FileNotFoundError:
        channel_rules_prompt = "（未找到频道配置，请保持专业、温润的语气）"

    # 加载全局写作约束（禁用书单）
    writing_constraints = workflow_engine.load_writing_constraints()
    banned_books = writing_constraints.get("banned_books", {})
    banned_books_list = "、".join(banned_books.get("list", [])) or "（暂无）"

    system_prompt = f"""你是一个顶尖的文字编辑，正在对文章进行局部微调。
【用户要求】：{request.user_instruction}
【需要修改的原文】：{request.selected_text}
【原文所在的上下文】（仅供参考连贯性，不需要输出上下文）：{request.surrounding_context}

【全局与频道纪律】：
1. 频道底线：{channel_rules_prompt}
2. 全局禁书（绝对不可使用）：{banned_books_list}

【你的任务】：
严格按照用户的要求，重写【需要修改的原文】。
【最高红线】：
1. 你只能输出重写后的文本，绝不输出多余废话。输出长度应与原文本体量相当。
2. **防禁书机制**：即便用户要求换书，也绝对禁止使用上述【全局禁书】名单中的书目。
3. **完美缝合机制**：确保你输出的文本能丝滑嵌回上下文。如果用户的要求会导致原文与上下文（如主人公名字、情节）产生逻辑冲突，请在满足用户要求的前提下，聪明地泛化或调整你输出的这部分措辞，尽最大努力保持整体逻辑的连贯。"""

    user_message = f"请重写以下文本：\n\n{request.selected_text}"

    result = await ai_service.generate_content(
        system_prompt=system_prompt,
        user_message=user_message,
        temperature=0.6,
        max_tokens=1024
    )

    if result.startswith("[ERROR]") or result.startswith("[WARNING]"):
        raise HTTPException(status_code=500, detail=result)

    return {
        "success": True,
        "rewritten_text": result.strip()
    }


# ============================================================================
# 接口：静默保存文章
# ============================================================================

@router.post("/update-article")
async def update_article(request: UpdateArticleRequest):
    """
    将前端编辑后的最新文章内容静默写回数据库。

    支持写入 draft_content 或 final_content 字段。
    """
    task = db_service.get_task(request.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if request.content_type not in ("draft", "final"):
        raise HTTPException(status_code=400, detail="content_type 必须为 draft 或 final")

    try:
        if request.content_type == "draft":
            db_service.update_task_step(
                request.task_id,
                task["current_step"],
                task["status"],
                draft_content=request.content
            )
        else:
            db_service.update_task_step(
                request.task_id,
                task["current_step"],
                task["status"],
                final_content=request.content
            )

        return {"success": True, "message": "文章已保存"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")
