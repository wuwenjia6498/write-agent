"""
工作流管理路由
负责9步SOP流程的状态管理和执行
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import json
import asyncio

from services.workflow_engine import workflow_engine

router = APIRouter()

class StepStatus(str, Enum):
    """步骤状态枚举"""
    PENDING = "pending"          # 等待执行
    IN_PROGRESS = "in_progress"  # 执行中
    WAITING = "waiting"          # 等待用户输入（卡点）
    COMPLETED = "completed"      # 已完成
    SKIPPED = "skipped"          # 已跳过
    ERROR = "error"              # 执行错误

class WorkflowStep(BaseModel):
    """工作流步骤模型"""
    step_id: int = Field(..., ge=1, le=9, description="步骤编号 1-9")
    step_name: str = Field(..., description="步骤名称")
    status: StepStatus = Field(default=StepStatus.PENDING, description="步骤状态")
    is_checkpoint: bool = Field(default=False, description="是否为必须卡点")
    description: str = Field(..., description="步骤描述")
    output: Optional[str] = Field(None, description="步骤输出内容")
    think_aloud: Optional[str] = Field(None, description="Think Aloud 思考过程")
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class WorkflowSession(BaseModel):
    """工作流会话"""
    session_id: str = Field(..., description="会话ID")
    channel_id: str = Field(..., description="频道ID")
    brief: str = Field(..., description="需求简述")
    current_step: int = Field(default=1, ge=1, le=9, description="当前步骤")
    steps: List[WorkflowStep] = Field(..., description="所有步骤")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

# 9步SOP定义
WORKFLOW_STEPS = [
    {
        "step_id": 1,
        "step_name": "理解需求 & 保存Brief",
        "description": "明确需求，保存文档",
        "is_checkpoint": False
    },
    {
        "step_id": 2,
        "step_name": "信息搜索与知识管理",
        "description": "强制调研，确保准确性",
        "is_checkpoint": False
    },
    {
        "step_id": 3,
        "step_name": "选题讨论（必做）",
        "description": "避免方向错误，减少返工",
        "is_checkpoint": True  # 强制卡点
    },
    {
        "step_id": 4,
        "step_name": "创建协作文档",
        "description": "明确AI与用户分工",
        "is_checkpoint": False
    },
    {
        "step_id": 5,
        "step_name": "风格与素材检索",
        "description": "学习风格，调用真实素材",
        "is_checkpoint": False
    },
    {
        "step_id": 6,
        "step_name": "挂起等待",
        "description": "获取真实数据前不创作",
        "is_checkpoint": True  # 数据确认卡点
    },
    {
        "step_id": 7,
        "step_name": "初稿创作",
        "description": "融入个人视角，严禁空洞",
        "is_checkpoint": False
    },
    {
        "step_id": 8,
        "step_name": "三遍审校机制",
        "description": "内容审校 → 风格审校 → 细节打磨",
        "is_checkpoint": False
    },
    {
        "step_id": 9,
        "step_name": "文章配图",
        "description": "提供配图方案与Markdown代码",
        "is_checkpoint": False
    }
]

# 内存存储（实际应用应使用数据库）
sessions_db: Dict[str, WorkflowSession] = {}

@router.post("/create")
async def create_workflow(
    channel_id: str,
    brief: str
) -> WorkflowSession:
    """
    创建新的工作流会话
    
    Args:
        channel_id: 频道ID
        brief: 需求简述
    
    Returns:
        新创建的工作流会话
    """
    import uuid
    
    session_id = str(uuid.uuid4())
    
    # 初始化所有步骤
    steps = [
        WorkflowStep(
            step_id=step["step_id"],
            step_name=step["step_name"],
            description=step["description"],
            is_checkpoint=step["is_checkpoint"]
        )
        for step in WORKFLOW_STEPS
    ]
    
    # 第一步自动开始
    steps[0].status = StepStatus.IN_PROGRESS
    steps[0].started_at = datetime.now()
    
    session = WorkflowSession(
        session_id=session_id,
        channel_id=channel_id,
        brief=brief,
        current_step=1,
        steps=steps
    )
    
    sessions_db[session_id] = session
    
    return session

@router.get("/{session_id}")
async def get_workflow(session_id: str) -> WorkflowSession:
    """
    获取工作流会话状态
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return sessions_db[session_id]

@router.post("/{session_id}/step/{step_id}/complete")
async def complete_step(
    session_id: str,
    step_id: int,
    output: Optional[str] = None,
    think_aloud: Optional[str] = None
) -> WorkflowSession:
    """
    完成指定步骤
    
    Args:
        session_id: 会话ID
        step_id: 步骤ID (1-9)
        output: 步骤输出内容
        think_aloud: Think Aloud 思考过程
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session = sessions_db[session_id]
    
    # 验证步骤
    if step_id < 1 or step_id > 9:
        raise HTTPException(status_code=400, detail="无效的步骤ID")
    
    current_step = session.steps[step_id - 1]
    
    # 更新当前步骤
    current_step.status = StepStatus.COMPLETED
    current_step.completed_at = datetime.now()
    current_step.output = output
    current_step.think_aloud = think_aloud
    
    # 如果不是最后一步，激活下一步
    if step_id < 9:
        next_step = session.steps[step_id]
        next_step.status = StepStatus.IN_PROGRESS
        next_step.started_at = datetime.now()
        session.current_step = step_id + 1
    else:
        # 工作流完成
        session.current_step = 9
    
    session.updated_at = datetime.now()
    
    return session

@router.post("/{session_id}/step/{step_id}/wait")
async def set_step_waiting(
    session_id: str,
    step_id: int,
    think_aloud: Optional[str] = None
) -> WorkflowSession:
    """
    设置步骤为等待状态（卡点）
    
    用于Step 3（选题讨论）和Step 6（等待数据）
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session = sessions_db[session_id]
    current_step = session.steps[step_id - 1]
    
    current_step.status = StepStatus.WAITING
    current_step.think_aloud = think_aloud
    session.updated_at = datetime.now()
    
    return session

@router.get("/")
async def list_workflows() -> List[WorkflowSession]:
    """
    获取所有工作流会话列表
    """
    return list(sessions_db.values())

@router.post("/{session_id}/execute-step/{step_id}")
async def execute_step(
    session_id: str,
    step_id: int,
    selected_topic: Optional[str] = None,
    materials: Optional[str] = None
):
    """
    执行指定步骤的AI逻辑
    
    Args:
        session_id: 会话ID
        step_id: 步骤ID (1-9)
        selected_topic: 选定的选题（Step 4+需要）
        materials: 用户提供的素材（Step 7需要）
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session = sessions_db[session_id]
    channel_id = session.channel_id
    
    # 更新步骤状态为执行中
    session.steps[step_id - 1].status = StepStatus.IN_PROGRESS
    session.steps[step_id - 1].started_at = datetime.now()
    
    try:
        # 根据步骤ID执行对应逻辑
        if step_id == 1:
            result = await workflow_engine.execute_step_1(session.brief, channel_id)
        elif step_id == 2:
            # 需要Step 1的输出
            step1_output = session.steps[0].output or ""
            result = await workflow_engine.execute_step_2(step1_output, channel_id)
        elif step_id == 3:
            step1_output = session.steps[0].output or ""
            result = await workflow_engine.execute_step_3(step1_output, channel_id)
        elif step_id == 4:
            if not selected_topic:
                raise HTTPException(status_code=400, detail="需要提供选定的选题")
            result = await workflow_engine.execute_step_4(selected_topic)
        elif step_id == 5:
            if not selected_topic:
                raise HTTPException(status_code=400, detail="需要提供选定的选题")
            result = await workflow_engine.execute_step_5(selected_topic, channel_id)
        elif step_id == 6:
            result = await workflow_engine.execute_step_6()
        elif step_id == 7:
            if not selected_topic or not materials:
                raise HTTPException(status_code=400, detail="需要提供选题和素材")
            step5_output = session.steps[4].output or ""
            result = await workflow_engine.execute_step_7(
                selected_topic, step5_output, materials, channel_id
            )
        elif step_id == 8:
            step7_output = session.steps[6].output or ""
            result = await workflow_engine.execute_step_8(step7_output, channel_id)
        elif step_id == 9:
            step8_output = session.steps[7].output or ""
            result = await workflow_engine.execute_step_9(step8_output)
        else:
            raise HTTPException(status_code=400, detail="无效的步骤ID")
        
        # 更新步骤输出和Think Aloud
        session.steps[step_id - 1].output = result.get("output", "")
        session.steps[step_id - 1].think_aloud = result.get("think_aloud", "")
        
        # 如果是卡点，设置为等待状态
        if result.get("is_checkpoint"):
            session.steps[step_id - 1].status = StepStatus.WAITING
        else:
            # 否则标记为完成，并激活下一步
            session.steps[step_id - 1].status = StepStatus.COMPLETED
            session.steps[step_id - 1].completed_at = datetime.now()
            
            if step_id < 9:
                session.steps[step_id].status = StepStatus.IN_PROGRESS
                session.steps[step_id].started_at = datetime.now()
                session.current_step = step_id + 1
        
        session.updated_at = datetime.now()
        
        return {
            "success": True,
            "result": result,
            "session": session
        }
        
    except Exception as e:
        # 标记步骤为错误状态
        session.steps[step_id - 1].status = StepStatus.ERROR
        session.steps[step_id - 1].output = f"执行失败: {str(e)}"
        session.updated_at = datetime.now()
        
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/stream-think-aloud/{step_id}")
async def stream_think_aloud(session_id: str, step_id: int):
    """
    流式输出Think Aloud思考过程（SSE）
    """
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    session = sessions_db[session_id]
    
    async def event_generator():
        """生成SSE事件流"""
        # 发送初始状态
        yield f"data: {json.dumps({'type': 'start', 'step': step_id})}\n\n"
        
        # 模拟Think Aloud流式输出
        think_aloud = session.steps[step_id - 1].think_aloud or "正在思考..."
        
        for char in think_aloud:
            yield f"data: {json.dumps({'type': 'content', 'content': char})}\n\n"
            await asyncio.sleep(0.02)  # 模拟打字效果
        
        # 发送完成信号
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )

