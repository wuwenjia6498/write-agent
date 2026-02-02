"""
工作流管理路由
负责9步SOP流程的状态管理和执行，支持数据库持久化
包含数据库操作重试机制，应对临时网络抖动
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
import time

from services.workflow_engine import workflow_engine
from services.db_service import db_service

router = APIRouter()


# ============================================================================
# 数据库操作重试机制
# ============================================================================
MAX_RETRIES = 3
RETRY_DELAY = 1  # 秒


def db_retry(operation_name: str = "数据库操作"):
    """
    数据库操作重试装饰器
    用于应对临时网络抖动，最多重试 3 次
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(MAX_RETRIES):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        print(f"[WARN] {operation_name}失败 (尝试 {attempt + 1}/{MAX_RETRIES})，{RETRY_DELAY}秒后重试: {e}")
                        time.sleep(RETRY_DELAY)
                    else:
                        print(f"[ERROR] {operation_name}失败，已达最大重试次数: {e}")
            raise last_error
        return wrapper
    return decorator


def extract_word_count(step1_output: str, brief: str) -> int:
    """
    从用户输入或 Step 1 分析结果中提取字数要求
    
    优先级顺序（防止 AI 误解用户意图）：
    1. 用户原始 brief 中的明确字数 - 最高优先级，用户说了算
    2. Step 1 AI 分析结果 - 次优先级，AI 推断
    3. 默认值 1500 - 兜底
    
    示例：
    - 用户输入「写一篇 2000 字的文章」→ 返回 2000
    - 用户输入「写一篇关于阅读的文章」+ Step 1 分析「期望字数：1500」→ 返回 1500
    - 都没有字数信息 → 返回 1500（默认）
    
    Returns:
        int: 提取到的字数（范围 500-10000），默认 1500
    """
    # 常见字数表达模式（按匹配精确度排序）
    patterns = [
        r'期望字数[：:]\s*(\d+)',      # "期望字数：2000"
        r'字数要求[：:]\s*(\d+)',      # "字数要求：1500"
        r'字数限制[：:]\s*(\d+)',      # "字数限制：2000"
        r'字数[：:]\s*(\d+)',          # "字数：1800"
        r'(\d{3,4})字左右',            # "2000字左右"
        r'(\d{3,4})字以内',            # "1500字以内"
        r'约(\d{3,4})字',              # "约2000字"
        r'(\d+)\s*字',                 # "2000字" (最宽松的匹配)
    ]
    
    def _extract_from_text(text: str) -> int:
        """从文本中提取字数，返回 0 表示未找到"""
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                word_count = int(match.group(1))
                # 合理范围检查：500-10000字
                if 500 <= word_count <= 10000:
                    return word_count
        return 0
    
    # ================================================================
    # 优先级 1: 用户原始 brief（用户明确说的字数最重要）
    # ================================================================
    if brief:
        user_word_count = _extract_from_text(brief)
        if user_word_count > 0:
            return user_word_count
    
    # ================================================================
    # 优先级 2: Step 1 AI 分析结果（AI 推断的字数）
    # ================================================================
    if step1_output:
        ai_word_count = _extract_from_text(step1_output)
        if ai_word_count > 0:
            return ai_word_count
    
    # ================================================================
    # 优先级 3: 默认字数
    # ================================================================
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
    {"step_id": 1, "step_name": "理解需求", "description": "明确需求，保存文档", "is_checkpoint": False},
    {"step_id": 2, "step_name": "信息搜索", "description": "深度调研，审阅确认", "is_checkpoint": True},
    {"step_id": 3, "step_name": "选题讨论", "description": "避免方向错误，减少返工", "is_checkpoint": True},
    {"step_id": 4, "step_name": "协作文档", "description": "明确AI与用户分工", "is_checkpoint": False},
    {"step_id": 5, "step_name": "风格建模", "description": "确认风格DNA，锁定创作基调", "is_checkpoint": True},
    {"step_id": 6, "step_name": "挂起等待", "description": "获取真实数据前不创作", "is_checkpoint": True},
    {"step_id": 7, "step_name": "初稿创作", "description": "融入个人视角，严禁空洞", "is_checkpoint": False},
    {"step_id": 8, "step_name": "四遍审校", "description": "内容→DNA对齐→风格→细节", "is_checkpoint": False},
    {"step_id": 9, "step_name": "文章配图", "description": "提供配图方案与Markdown代码", "is_checkpoint": False}
]


class CreateWorkflowRequest(BaseModel):
    """创建工作流请求"""
    channel_id: str = Field(..., description="频道ID (slug)")
    brief: str = Field(..., description="需求简述")
    title: Optional[str] = Field(None, description="任务标题")


class ConfirmStepRequest(BaseModel):
    """确认卡点请求"""
    # Step 2: 调研确认
    knowledge_confirmed: Optional[bool] = Field(None, description="调研确认 (Step 2)")
    edited_knowledge: Optional[str] = Field(None, description="用户编辑后的调研内容 (Step 2)")
    # Step 3: 选题确认
    selected_topic: Optional[str] = Field(None, description="选定的选题 (Step 3)")
    # Step 5: 风格确认
    style_confirmed: Optional[bool] = Field(None, description="风格确认 (Step 5)")
    user_style_profile: Optional[Dict[str, Any]] = Field(None, description="用户自定义的风格配置 (Step 5)")
    selected_sample: Optional[Dict[str, Any]] = Field(None, description="v3.5: 选定的标杆样文 (Step 5)")
    # Step 6: 素材确认
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
    - 包含重试机制应对临时网络问题
    - 返回任务 ID 供后续操作使用
    """
    # 如果没有标题，从 brief 中自动生成
    title = request.title
    if not title and request.brief:
        # 提取 brief 前50个字符作为标题，去除换行
        title = request.brief.replace('\n', ' ').strip()[:50]
        if len(request.brief) > 50:
            title += '...'
    
    brief_data = {
        "brief": request.brief,
        "created_at": datetime.now().isoformat()
    }
    
    # 带重试的数据库创建
    @db_retry("创建任务")
    def create_task_with_retry():
        return db_service.create_task(
            channel_id=request.channel_id,
            title=title,
            brief_data=brief_data
        )
    
    try:
        task = create_task_with_retry()
        
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
        raise HTTPException(
            status_code=503, 
            detail=f"数据库连接失败，请检查网络后重试。错误: {str(e)}"
        )


@router.get("/{task_id}")
async def get_workflow(task_id: str):
    """
    获取工作流任务状态
    """
    @db_retry("获取任务")
    def get_task_with_retry():
        return db_service.get_task(task_id)
    
    try:
        task = get_task_with_retry()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"数据库连接失败: {str(e)}")
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "task_id": task["id"],
        "session_id": task["id"],  # 兼容旧接口
        "channel_id": task["channel_slug"],
        "current_step": task["current_step"],
        "status": task["status"],
        "brief_data": task["brief_data"],
        "knowledge_base_data": task.get("knowledge_base_data"),  # Step 2 调研全文
        "knowledge_summary": task.get("knowledge_summary"),      # Step 2 调研摘要
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
            # Step 2: 信息搜索与知识管理（卡点）
            step1_output = brief_data.get("step_1_output", "")
            result = await workflow_engine.execute_step_2(step1_output, channel_id)
            
            # 获取搜索来源（如果有）
            knowledge_sources = result.get("knowledge_sources", [])
            
            # 存储调研全文和摘要到专用字段
            db_service.update_knowledge_data(
                task_id=task_id,
                knowledge_base_data=result["output"],
                knowledge_summary=result.get("knowledge_summary", "")
            )
            
            # 同时保存到 brief_data 便于后续步骤引用（包含来源信息）
            db_service.update_brief_data(task_id, {
                "step_2_output": result["output"],
                "knowledge_sources": knowledge_sources  # 真实搜索来源
            })
            db_service.add_think_aloud_log(task_id, 2, result["think_aloud"])
            
            # 设置为等待确认状态（调研卡点）
            db_service.update_task_to_waiting(task_id, 2, {
                "knowledge_summary": result.get("knowledge_summary", ""),
                "knowledge_sources": knowledge_sources,
                "waiting_for": "knowledge_confirmation"
            })
            
            return {
                "success": True,
                "step_id": step_id,
                "is_checkpoint": True,
                "status": "waiting_confirm",
                "result": result,
                "message": "请审阅调研结论，可编辑后确认"
            }
            
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
            # Step 5: 风格建模与素材检索（卡点 - 需用户确认风格）
            if not selected_topic:
                selected_topic = brief_data.get("selected_topic", "")
            
            result = await workflow_engine.execute_step_5(
                selected_topic, 
                channel_id,
                task_id=task_id  # 传入 task_id 用于持久化
            )
            
            # 保存风格画像和检索结果（包括样文推荐数据）
            style_profile = result.get("style_profile", {})
            classified_materials = result.get("classified_materials", {"long": [], "short": []})
            db_service.update_brief_data(task_id, {
                "step_5_output": result["output"],
                "retrieved_materials": result.get("retrieved_materials", []),
                "classified_materials": classified_materials,  # 分类素材
                "style_profile": style_profile,
                # v3.5: 保存样文推荐数据
                "selected_sample": result.get("selected_sample"),
                "all_samples": result.get("all_samples", [])
            })
            db_service.add_think_aloud_log(task_id, 5, result.get("think_aloud", ""))
            
            # 设置为等待确认状态（风格确认卡点）
            db_service.update_task_to_waiting(task_id, 5, {
                "style_profile": style_profile,
                "waiting_for": "style_confirmation"
            })
            
            return {
                "success": True,
                "step_id": step_id,
                "is_checkpoint": True,
                "status": "waiting_confirm",
                "result": result,
                "message": "请确认风格画像后继续创作"
            }
            
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
            # Step 7: 初稿创作（v3.6 - 单一标杆驱动 + 调研事实地基）
            if not selected_topic:
                selected_topic = brief_data.get("selected_topic", "")
            if not materials:
                materials = brief_data.get("user_materials", "")
            
            step5_output = brief_data.get("step_5_output", "")
            
            # 优先使用用户自定义的风格配置，否则使用原始风格画像
            style_profile = brief_data.get("user_style_profile") or brief_data.get("style_profile", {})
            
            # v3.5: 获取所选的单一标杆样文
            selected_sample = brief_data.get("selected_sample")
            
            # v3.6: 获取 Step 2 调研摘要（事实地基）
            knowledge_summary = task.get("knowledge_summary", "") or ""
            
            # 从 Step 1 的分析结果中提取字数要求
            step1_output = brief_data.get("step_1_output", "")
            original_brief = brief_data.get("brief", "")
            word_count = extract_word_count(step1_output, original_brief)
            
            result = await workflow_engine.execute_step_7(
                selected_topic, step5_output, materials, channel_id, word_count, 
                style_profile, selected_sample,
                knowledge_summary=knowledge_summary  # v3.6: 传入调研摘要
            )
            
            # 保存初稿
            db_service.update_task_step(
                task_id, 7, "processing",
                draft_content=result["output"]
            )
            db_service.update_brief_data(task_id, {"step_7_output": result["output"]})
            db_service.add_think_aloud_log(task_id, 7, result["think_aloud"])
            
        elif step_id == 8:
            # Step 8: 四遍审校（含风格对齐检查）
            draft = task.get("draft_content") or brief_data.get("step_7_output", "")
            # 优先使用用户自定义的风格配置
            style_profile = brief_data.get("user_style_profile") or brief_data.get("style_profile", {})
            
            # 从 Step 1 的分析结果中提取字数要求
            step1_output = brief_data.get("step_1_output", "")
            original_brief = brief_data.get("brief", "")
            word_count = extract_word_count(step1_output, original_brief)
            
            result = await workflow_engine.execute_step_8(draft, channel_id, word_count, style_profile)
            
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
    if current_step == 2 and request.knowledge_confirmed:
        # Step 2: 调研确认
        updates["knowledge_confirmed"] = True
        
        # 如果用户编辑了调研内容，保存修改
        if request.edited_knowledge:
            db_service.update_knowledge_data(
                task_id=task_id,
                knowledge_base_data=request.edited_knowledge,
                knowledge_summary=task.get("knowledge_summary", "")  # 摘要保持不变
            )
            db_service.add_think_aloud_log(
                task_id, 2,
                f"[用户确认] 已编辑并确认调研结论（{len(request.edited_knowledge)} 字）"
            )
        else:
            db_service.add_think_aloud_log(
                task_id, 2,
                "[用户确认] 已确认调研结论，进入选题阶段"
            )
    elif current_step == 3 and request.selected_topic:
        updates["selected_topic"] = request.selected_topic
        db_service.add_think_aloud_log(
            task_id, 3, 
            f"[用户确认] 选定选题:\n{request.selected_topic[:200]}..."
        )
    elif current_step == 5 and request.style_confirmed:
        # Step 5: 风格确认（可编辑任务简报）
        updates["style_confirmed"] = True
        
        # v3.5: 保存选定的标杆样文
        if request.selected_sample:
            updates["selected_sample"] = request.selected_sample
            sample_title = request.selected_sample.get("title", "未命名")
            db_service.add_think_aloud_log(
                task_id, 5, 
                f"[用户确认] 选定标杆样文: 「{sample_title}」\n"
                f"后续创作将严格复刻此样文的写作风格与结构逻辑"
            )
        
        # 如果用户自定义了风格配置，保存为最高指令
        if request.user_style_profile:
            updates["user_style_profile"] = request.user_style_profile
            custom_guidelines = request.user_style_profile.get("writing_guidelines", [])
            custom_req = request.user_style_profile.get("custom_requirement", "")
            
            log_content = f"[用户确认] 已自定义风格配置（覆盖样文默认特征）\n"
            log_content += f"- 创作指南: {len(custom_guidelines)} 条\n"
            if custom_req:
                log_content += f"- 特殊要求: {custom_req[:100]}..."
            db_service.add_think_aloud_log(task_id, 5, log_content)
        elif not request.selected_sample:
            db_service.add_think_aloud_log(
                task_id, 5,
                "[用户确认] 无标杆样文，将使用频道基础人设进行创作"
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


@router.post("/{task_id}/regenerate-summary")
async def regenerate_summary(task_id: str):
    """
    重新生成调研摘要
    
    当用户修改了调研全文后，可调用此接口重新生成 300 字以内的摘要
    """
    from services.ai_service import ai_service
    
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    knowledge_base = task.get("knowledge_base_data", "")
    if not knowledge_base:
        raise HTTPException(status_code=400, detail="调研全文为空，无法生成摘要")
    
    # 生成摘要的 prompt（纯文本格式，禁止 Markdown）
    summary_prompt = """你是一位擅长信息提炼的编辑。请将调研资料提炼为简洁的核心要点。

【严格要求】
- 总字数：200-300字
- 要点数：3-5个核心发现
- 格式：纯文本，禁止使用任何 Markdown 或 HTML 标签

【输出格式示例】
核心发现：
1. 第一个要点的一句话概括
2. 第二个要点的一句话概括
3. 第三个要点的一句话概括

创作建议：一句话说明这些发现对文章创作的指导意义。

【禁止事项】
- 不要使用 # ## ### 等标题符号
- 不要使用 ** __ 等加粗符号  
- 不要使用 <strong> <b> 等 HTML 标签
- 直接输出纯文本即可"""

    try:
        knowledge_summary = await ai_service.generate_content(
            system_prompt=summary_prompt,
            user_message=f"请提炼以下内容的核心要点：\n\n{knowledge_base}",
            temperature=0.3
        )
        
        # 保存新摘要
        db_service.update_knowledge_data(
            task_id=task_id,
            knowledge_base_data=knowledge_base,  # 全文保持不变
            knowledge_summary=knowledge_summary
        )
        
        db_service.add_think_aloud_log(
            task_id, 2,
            f"[摘要更新] 已根据最新调研内容重新生成摘要（{len(knowledge_summary)} 字）"
        )
        
        return {
            "success": True,
            "knowledge_summary": knowledge_summary,
            "message": "摘要生成成功"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"摘要生成失败: {str(e)}")


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
    try:
        return db_service.get_all_tasks(limit=20)
    except Exception as e:
        print(f"[WARN] 获取任务列表失败: {e}")
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


# ============================================================================
# v3.5: 样文智能推荐 (Smart Match)
# ============================================================================

class SelectSampleRequest(BaseModel):
    """选择样文请求"""
    sample_id: str = Field(..., description="选中的样文 ID")


@router.get("/{task_id}/recommend-samples")
async def recommend_samples(task_id: str):
    """
    v3.5: 样文智能推荐
    
    基于 Step 1 的 Brief 分析，从当前频道的样文库中推荐最匹配的样文。
    
    匹配逻辑：
    1. 提取 Brief 中的关键词
    2. 与样文的 custom_tags 进行匹配（最高权重）
    3. 与样文的 6 维特征关键词进行匹配
    4. 返回匹配度最高的样文，并给出推荐理由
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    channel_slug = task["channel_slug"]
    brief_data = task.get("brief_data", {})
    
    # 获取频道信息
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # 提取 Brief 关键词
    step1_output = brief_data.get("step_1_output", "")
    selected_topic = brief_data.get("selected_topic", "")
    original_brief = brief_data.get("brief", "")
    
    # 合并文本提取关键词
    combined_text = f"{step1_output}\n{selected_topic}\n{original_brief}"
    keywords = extract_keywords_from_text(combined_text)
    
    # 获取样文并计算匹配分数
    samples = db_service.get_style_samples_for_matching(
        channel_id=channel['id'],
        keywords=keywords
    )
    
    if not samples:
        return {
            "success": True,
            "has_recommendation": False,
            "message": "该频道暂无已分析的样文，请先在频道管理中添加样文",
            "samples": [],
            "keywords": keywords
        }
    
    # 生成推荐理由
    top_sample = samples[0] if samples else None
    recommendation_reason = ""
    
    if top_sample and top_sample.get("match_score", 0) > 0:
        matched_tags = top_sample.get("matched_tags", [])
        if matched_tags:
            recommendation_reason = f"此样文标签 {', '.join(matched_tags)} 与本次选题高度契合"
        else:
            recommendation_reason = "此样文的写作风格与本次创作需求较为匹配"
    elif top_sample:
        recommendation_reason = "基于频道默认样文推荐"
    
    return {
        "success": True,
        "has_recommendation": bool(top_sample),
        "selected_sample": top_sample,
        "recommendation_reason": recommendation_reason,
        "all_samples": samples,
        "keywords": keywords,
        "message": "请选择一篇样文作为本次创作的风格标杆"
    }


@router.post("/{task_id}/select-sample")
async def select_sample(task_id: str, request: SelectSampleRequest):
    """
    v3.5: 确认选择样文
    
    主编确认或手动选择一篇样文作为本次创作的唯一标杆。
    该样文的 6 维特征将用于 Step 7 初稿生成。
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 获取选中的样文详情
    sample = db_service.get_style_sample_by_id(request.sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样文不存在")
    
    # 保存选中的样文到任务数据
    db_service.update_brief_data(task_id, {
        "selected_sample_id": request.sample_id,
        "selected_sample": {
            "id": sample["id"],
            "title": sample["title"],
            "custom_tags": sample.get("custom_tags", []),
            "style_profile": sample.get("style_profile", {})
        }
    })
    
    db_service.add_think_aloud_log(
        task_id, 5,
        f"[样文选择] 已选定标杆样文：《{sample['title']}》\n"
        f"标签：{', '.join(sample.get('custom_tags', []))}\n"
        f"该样文的 6 维特征将作为 Step 7 创作的核心约束"
    )
    
    return {
        "success": True,
        "message": f"已选定样文《{sample['title']}》作为本次创作的风格标杆",
        "selected_sample": sample
    }


def extract_keywords_from_text(text: str) -> list:
    """从文本中提取关键词"""
    import re
    
    # 停用词
    stop_words = {'的', '是', '在', '和', '了', '与', '对', '为', '以', '等', 
                  '这', '那', '就', '也', '都', '要', '能', '会', '可以', '应该',
                  '一个', '我们', '他们', '什么', '怎么', '如何', '为什么',
                  '需要', '希望', '想要', '关于', '进行', '通过', '使用'}
    
    # 按标点和空格分词
    words = re.split(r'[，。、！？：；""''（）\s\n]+', text)
    
    # 过滤停用词和短词
    keywords = [
        w.strip() for w in words 
        if w.strip() and len(w.strip()) >= 2 and w.strip() not in stop_words
    ]
    
    # 去重并取前15个
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            unique_keywords.append(kw)
    
    return unique_keywords[:15]


# ============================================================================
# v3.5: 样文智能推荐 API (Smart Match)
# ============================================================================

class SelectSampleRequest(BaseModel):
    """选择样文请求"""
    sample_id: str = Field(..., description="所选样文 ID")


@router.get("/{task_id}/recommend-samples")
async def get_selected_samples(task_id: str):
    """
    获取推荐的样文列表（基于 Brief 意图与 custom_tags 匹配）
    
    匹配逻辑：
    1. 从 Step 1 的 Brief 中提取关键词
    2. 与频道内所有样文的 custom_tags 进行匹配
    3. 权重：custom_tags 完全匹配 > 6维特征关键词匹配
    4. 返回按匹配度排序的样文列表，最高分的作为推荐
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    channel_slug = task["channel_slug"]
    brief_data = task.get("brief_data", {})
    
    # 获取频道信息
    channel = db_service.get_channel_by_slug(channel_slug)
    if not channel:
        raise HTTPException(status_code=404, detail="频道不存在")
    
    # 从 Brief 中提取关键词
    brief = brief_data.get("brief", "")
    step1_output = brief_data.get("step_1_output", "")
    
    keywords = []
    
    # 从 Step 1 分析结果提取关键词
    import re
    keywords_match = re.search(r'关键词[：:]\s*(.+?)(?:\n|$)', step1_output)
    if keywords_match:
        keywords.extend([k.strip() for k in keywords_match.group(1).split('、') if k.strip()])
    
    topic_match = re.search(r'主题[：:]\s*(.+?)(?:\n|$)', step1_output)
    if topic_match:
        keywords.append(topic_match.group(1).strip())
    
    # 从原始 Brief 提取
    brief_keywords = re.split(r'[，。、！？：；""''（）\s]+', brief)
    keywords.extend([k for k in brief_keywords if len(k) >= 2])
    
    # 去重
    keywords = list(set(keywords))[:15]
    
    # 获取匹配的样文
    samples = db_service.get_style_samples_for_matching(channel['id'], keywords)
    
    # 构建推荐结果
    result = {
        "task_id": task_id,
        "channel_id": channel_slug,
        "extracted_keywords": keywords,
        "samples": samples,
        "recommended": None,
        "recommendation_reason": ""
    }
    
    # 选择最高分的作为推荐
    if samples:
        top_sample = samples[0]
        result["recommended"] = top_sample
        
        # 生成推荐理由
        if top_sample.get("matched_tags"):
            tags_str = "、".join(top_sample["matched_tags"][:3])
            result["recommendation_reason"] = f"此样文标签 [{tags_str}] 与本次选题高度契合"
        elif top_sample.get("match_score", 0) > 0:
            result["recommendation_reason"] = "此样文的写作风格与本次选题最为匹配"
        else:
            result["recommendation_reason"] = "此为该频道的默认参考样文"
    
    return result


@router.post("/{task_id}/select-sample")
async def select_sample(task_id: str, request: SelectSampleRequest):
    """
    确认选择某篇样文作为本次创作的唯一标杆
    
    选中后：
    1. 该样文的 style_profile 将作为 Step 7 的强制约束
    2. 若主编在 Step 5 微调了创作指南，则覆盖样文默认特征
    """
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 获取所选样文的详情
    sample = db_service.get_style_sample_by_id(request.sample_id)
    
    if not sample:
        raise HTTPException(status_code=404, detail="样文不存在")
    
    # 保存选定的样文到 brief_data
    db_service.update_brief_data(task_id, {
        "selected_sample_id": request.sample_id,
        "selected_sample_title": sample.get("title"),
        "selected_sample_profile": sample.get("style_profile"),
        "selected_sample_tags": sample.get("custom_tags", [])
    })
    
    db_service.add_think_aloud_log(
        task_id, 5,
        f"[样文选择] 已选定《{sample.get('title')}》作为本次创作的唯一标杆\n"
        f"标签：{', '.join(sample.get('custom_tags', []))}"
    )
    
    return {
        "success": True,
        "message": f"已选定《{sample.get('title')}》作为写作标杆",
        "sample_id": request.sample_id,
        "sample_title": sample.get("title"),
        "style_profile": sample.get("style_profile")
    }
