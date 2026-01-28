"""
工作流管理路由
负责9步SOP流程的状态管理和执行，支持数据库持久化
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import json
import asyncio
import re

from services.workflow_engine import workflow_engine
from services.db_service import db_service

router = APIRouter()


def extract_word_count(step1_output: str, brief: str) -> int:
    """
    从 Step 1 输出或原始 brief 中提取字数要求
    返回提取到的字数，默认返回 1500
    """
    # 常见字数表达模式
    patterns = [
        r'期望字数[：:]\s*(\d+)',
        r'字数[：:]\s*(\d+)',
        r'(\d+)\s*字',
        r'字数要求[：:]\s*(\d+)',
        r'字数限制[：:]\s*(\d+)',
        r'(\d{3,4})字左右',
        r'(\d{3,4})字以内',
        r'约(\d{3,4})字',
    ]
    
    # 合并搜索文本
    search_text = f"{step1_output}\n{brief}"
    
    for pattern in patterns:
        match = re.search(pattern, search_text)
        if match:
            word_count = int(match.group(1))
            # 合理范围检查：500-10000字
            if 500 <= word_count <= 10000:
                return word_count
    
    # 默认字数
    return 1500


class StepStatus(str, Enum):
    """步骤状态枚举"""
    PENDING = "pending"                    # 等待执行
    IN_PROGRESS = "processing"             # 执行中
    WAITING_CONFIRM = "waiting_confirm"    # 等待用户确认（卡点）
    COMPLETED = "completed"                # 已完成
    CANCELLED = "cancelled"                # 已取消
    ERROR = "error"                        # 执行错误


# 9步SOP定义
WORKFLOW_STEPS = [
    {"step_id": 1, "step_name": "理解需求 & 保存Brief", "description": "明确需求，保存文档", "is_checkpoint": False},
    {"step_id": 2, "step_name": "信息搜索与知识管理", "description": "强制调研，确保准确性", "is_checkpoint": False},
    {"step_id": 3, "step_name": "选题讨论（必做）", "description": "避免方向错误，减少返工", "is_checkpoint": True},
    {"step_id": 4, "step_name": "创建协作文档", "description": "明确AI与用户分工", "is_checkpoint": False},
    {"step_id": 5, "step_name": "风格与素材检索", "description": "学习风格，调用真实素材", "is_checkpoint": False},
    {"step_id": 6, "step_name": "挂起等待", "description": "获取真实数据前不创作", "is_checkpoint": True},
    {"step_id": 7, "step_name": "初稿创作", "description": "融入个人视角，严禁空洞", "is_checkpoint": False},
    {"step_id": 8, "step_name": "三遍审校机制", "description": "内容审校 → 风格审校 → 细节打磨", "is_checkpoint": False},
    {"step_id": 9, "step_name": "文章配图", "description": "提供配图方案与Markdown代码", "is_checkpoint": False}
]


class CreateWorkflowRequest(BaseModel):
    """创建工作流请求"""
    channel_id: str = Field(..., description="频道ID (slug)")
    brief: str = Field(..., description="需求简述")
    title: Optional[str] = Field(None, description="任务标题")


class ConfirmStepRequest(BaseModel):
    """确认卡点请求"""
    selected_topic: Optional[str] = Field(None, description="选定的选题 (Step 3)")
    user_materials: Optional[str] = Field(None, description="用户提供的素材 (Step 6)")


class ExecuteStepRequest(BaseModel):
    """执行步骤请求"""
    selected_topic: Optional[str] = Field(None, description="选定的选题")
    materials: Optional[str] = Field(None, description="用户素材")


@router.post("/create")
async def create_workflow(request: CreateWorkflowRequest):
    """
    创建新的工作流会话
    
    - 在数据库中创建 writing_task 记录
    - 返回任务 ID 供后续操作使用
    """
    try:
        # 如果没有标题，从 brief 中自动生成
        title = request.title
        if not title and request.brief:
            # 提取 brief 前50个字符作为标题，去除换行
            title = request.brief.replace('\n', ' ').strip()[:50]
            if len(request.brief) > 50:
                title += '...'
        
        # 在数据库创建任务
        task = db_service.create_task(
            channel_id=request.channel_id,
            title=title,
            brief_data={
                "brief": request.brief,
                "created_at": datetime.now().isoformat()
            }
        )
        
        # 添加初始 Think Aloud
        db_service.add_think_aloud_log(
            task_id=task["id"],
            step=0,
            log_content=f"[系统] 创建写作任务\n频道: {request.channel_id}\n需求: {request.brief[:100]}..."
        )
        
        return {
            "success": True,
            "task_id": task["id"],
            "session_id": task["id"],  # 兼容旧接口
            "channel_id": request.channel_id,
            "current_step": 1,
            "status": "processing",
            "steps": WORKFLOW_STEPS,
            "created_at": task["created_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("/{task_id}")
async def get_workflow(task_id: str):
    """
    获取工作流任务状态
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "task_id": task["id"],
        "session_id": task["id"],  # 兼容旧接口
        "channel_id": task["channel_slug"],
        "current_step": task["current_step"],
        "status": task["status"],
        "brief_data": task["brief_data"],
        "draft_content": task["draft_content"],
        "final_content": task["final_content"],
        "think_aloud_logs": task["think_aloud_logs"],
        "steps": WORKFLOW_STEPS
    }


@router.post("/{task_id}/execute-step/{step_id}")
async def execute_step(
    task_id: str,
    step_id: int,
    request: Optional[ExecuteStepRequest] = None
):
    """
    执行指定步骤的AI逻辑
    
    - 自动持久化状态到数据库
    - 卡点步骤 (Step 3, 6) 会暂停并等待用户确认
    - Think Aloud 实时写入数据库
    """
    # 获取任务
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    channel_id = task["channel_slug"]
    brief_data = task["brief_data"] or {}
    
    # 解析请求参数
    selected_topic = request.selected_topic if request else None
    materials = request.materials if request else None
    
    # 更新状态为执行中
    db_service.update_task_step(task_id, step_id, "processing")
    
    try:
        result = None
        
        # ====================================================================
        # 根据步骤ID执行对应逻辑
        # ====================================================================
        if step_id == 1:
            # Step 1: 理解需求
            brief = brief_data.get("brief", "")
            result = await workflow_engine.execute_step_1(brief, channel_id)
            
            # 保存输出
            db_service.update_brief_data(task_id, {"step_1_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 1, result["think_aloud"])
            
        elif step_id == 2:
            # Step 2: 信息搜索
            step1_output = brief_data.get("step_1_output", "")
            result = await workflow_engine.execute_step_2(step1_output, channel_id)
            
            db_service.update_brief_data(task_id, {"step_2_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 2, result["think_aloud"])
            
        elif step_id == 3:
            # Step 3: 选题讨论（卡点）
            step1_output = brief_data.get("step_1_output", "")
            result = await workflow_engine.execute_step_3(step1_output, channel_id)
            
            # 保存选题方案
            db_service.update_brief_data(task_id, {"step_3_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 3, result["think_aloud"])
            
            # 设置为等待确认状态
            db_service.update_task_to_waiting(task_id, 3, {
                "topics": result["output"],
                "waiting_for": "topic_selection"
            })
            
            return {
                "success": True,
                "step_id": step_id,
                "is_checkpoint": True,
                "status": "waiting_confirm",
                "result": result,
                "message": "请选择一个选题方向后继续"
            }
            
        elif step_id == 4:
            # Step 4: 创建协作文档
            if not selected_topic:
                selected_topic = brief_data.get("selected_topic", "")
            if not selected_topic:
                raise HTTPException(status_code=400, detail="需要提供选定的选题")
            
            result = await workflow_engine.execute_step_4(selected_topic)
            
            db_service.update_brief_data(task_id, {"step_4_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 4, result["think_aloud"])
            
        elif step_id == 5:
            # Step 5: 风格与素材检索 (RAG)
            if not selected_topic:
                selected_topic = brief_data.get("selected_topic", "")
            
            result = await workflow_engine.execute_step_5(
                selected_topic, 
                channel_id,
                task_id=task_id  # 传入 task_id 用于持久化
            )
            
            db_service.update_brief_data(task_id, {
                "step_5_output": result["output"],
                "retrieved_materials": result.get("retrieved_materials", [])
            })
            
        elif step_id == 6:
            # Step 6: 挂起等待（卡点）
            result = await workflow_engine.execute_step_6()
            
            db_service.update_brief_data(task_id, {"step_6_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 6, result["think_aloud"])
            
            # 设置为等待确认状态
            db_service.update_task_to_waiting(task_id, 6, {
                "checklist": result["output"],
                "waiting_for": "data_confirmation"
            })
            
            return {
                "success": True,
                "step_id": step_id,
                "is_checkpoint": True,
                "status": "waiting_confirm",
                "result": result,
                "message": "请确认所有素材已准备就绪后继续"
            }
            
        elif step_id == 7:
            # Step 7: 初稿创作
            if not selected_topic:
                selected_topic = brief_data.get("selected_topic", "")
            if not materials:
                materials = brief_data.get("user_materials", "")
            
            step5_output = brief_data.get("step_5_output", "")
            
            # 从 Step 1 的分析结果中提取字数要求
            step1_output = brief_data.get("step_1_output", "")
            original_brief = brief_data.get("brief", "")
            word_count = extract_word_count(step1_output, original_brief)
            
            result = await workflow_engine.execute_step_7(
                selected_topic, step5_output, materials, channel_id, word_count
            )
            
            # 保存初稿
            db_service.update_task_step(
                task_id, 7, "processing",
                draft_content=result["output"]
            )
            db_service.update_brief_data(task_id, {"step_7_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 7, result["think_aloud"])
            
        elif step_id == 8:
            # Step 8: 三遍审校
            draft = task.get("draft_content") or brief_data.get("step_7_output", "")
            
            # 从 Step 1 的分析结果中提取字数要求
            step1_output = brief_data.get("step_1_output", "")
            original_brief = brief_data.get("brief", "")
            word_count = extract_word_count(step1_output, original_brief)
            
            result = await workflow_engine.execute_step_8(draft, channel_id, word_count)
            
            # 保存终稿
            db_service.update_task_step(
                task_id, 8, "processing",
                final_content=result["output"]
            )
            db_service.update_brief_data(task_id, {"step_8_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 8, result["think_aloud"])
            
        elif step_id == 9:
            # Step 9: 文章配图
            final = task.get("final_content") or brief_data.get("step_8_output", "")
            result = await workflow_engine.execute_step_9(final)
            
            db_service.update_brief_data(task_id, {"step_9_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 9, result["think_aloud"])
            
            # 标记任务完成
            db_service.update_task_step(task_id, 9, "completed")
            
        else:
            raise HTTPException(status_code=400, detail="无效的步骤ID")
        
        # ====================================================================
        # 更新任务状态
        # ====================================================================
        if result and not result.get("is_checkpoint"):
            # 非卡点步骤，直接进入下一步
            next_step = step_id + 1 if step_id < 9 else 9
            status = "completed" if step_id == 9 else "processing"
            db_service.update_task_step(task_id, next_step, status)
        
        return {
            "success": True,
            "step_id": step_id,
            "is_checkpoint": False,
            "status": "completed" if step_id == 9 else "processing",
            "result": result,
            "next_step": step_id + 1 if step_id < 9 else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # 标记步骤错误
        db_service.update_task_step(task_id, step_id, "error")
        db_service.add_think_aloud_log(task_id, step_id, f"[ERROR] 执行失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/confirm")
async def confirm_checkpoint(task_id: str, request: ConfirmStepRequest):
    """
    确认卡点并继续执行
    
    用于 Step 3 选题确认和 Step 6 数据确认
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task["status"] != "waiting_confirm":
        raise HTTPException(status_code=400, detail="任务不在等待确认状态")
    
    current_step = task["current_step"]
    
    # 保存用户确认数据
    updates = {}
    if current_step == 3 and request.selected_topic:
        updates["selected_topic"] = request.selected_topic
        db_service.add_think_aloud_log(
            task_id, 3, 
            f"[用户确认] 选定选题:\n{request.selected_topic[:200]}..."
        )
    elif current_step == 6 and request.user_materials:
        updates["user_materials"] = request.user_materials
        db_service.add_think_aloud_log(
            task_id, 6,
            f"[用户确认] 提供素材:\n{request.user_materials[:200]}..."
        )
    
    if updates:
        db_service.update_brief_data(task_id, updates)
    
    # 更新状态，继续执行
    db_service.confirm_and_continue(task_id, {
        "confirmed_at": datetime.now().isoformat(),
        "step": current_step
    })
    
    return {
        "success": True,
        "message": "确认成功，继续执行下一步",
        "next_step": current_step + 1,
        "task_id": task_id
    }


@router.get("/{task_id}/think-aloud")
async def get_think_aloud(task_id: str):
    """
    获取任务的 Think Aloud 日志
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "task_id": task_id,
        "logs": task.get("think_aloud_logs", []),
        "current_step": task["current_step"],
        "status": task["status"]
    }


@router.get("/{task_id}/stream-think-aloud")
async def stream_think_aloud(task_id: str):
    """
    流式输出 Think Aloud（SSE）
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    async def event_generator():
        """生成 SSE 事件流"""
        yield f"data: {json.dumps({'type': 'start', 'task_id': task_id})}\n\n"
        
        logs = task.get("think_aloud_logs", [])
        for log in logs:
            yield f"data: {json.dumps({'type': 'log', 'data': log})}\n\n"
            await asyncio.sleep(0.1)
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


@router.get("/")
async def list_workflows():
    """
    获取所有工作流会话列表
    """
    # TODO: 实现从数据库获取任务列表
    return []


@router.post("/{task_id}/abort")
async def abort_workflow(task_id: str):
    """
    中止工作流执行
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 更新任务状态为已取消
    db_service.update_task_step(task_id, task["current_step"], "aborted")
    db_service.add_think_aloud_log(task_id, task["current_step"], "⏹️ 用户已中止任务")
    
    return {
        "success": True,
        "message": "任务已中止",
        "task_id": task_id,
        "stopped_at_step": task["current_step"]
    }
