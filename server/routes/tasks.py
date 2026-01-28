"""
任务管理路由
负责写作任务的查询和管理
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from services.db_service import db_service

router = APIRouter()


class TaskSummary(BaseModel):
    """任务摘要"""
    id: str
    title: Optional[str]
    channel_slug: Optional[str]
    current_step: int
    status: str
    created_at: str
    updated_at: str
    brief: Optional[str] = None  # 需求简述，用于显示任务名称


class TaskDetail(BaseModel):
    """任务详情"""
    id: str
    title: Optional[str]
    channel_id: str
    channel_slug: Optional[str]
    current_step: int
    status: str
    brief_data: Optional[Dict[str, Any]]
    knowledge_base_data: Optional[str]
    draft_content: Optional[str]
    final_content: Optional[str]
    think_aloud_logs: Optional[List[Dict[str, Any]]]
    created_at: str
    updated_at: str
    completed_at: Optional[str]


@router.get("/")
async def list_tasks(
    channel_slug: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
) -> List[TaskSummary]:
    """获取任务列表"""
    tasks = db_service.get_all_tasks(
        channel_slug=channel_slug,
        status=status,
        limit=limit
    )
    result = []
    for t in tasks:
        # 从 brief_data 中提取 brief 作为备用标题
        brief = None
        if t.get("brief_data") and isinstance(t["brief_data"], dict):
            brief = t["brief_data"].get("brief")
        
        result.append(TaskSummary(
            id=t["id"],
            title=t.get("title"),
            channel_slug=t.get("channel_slug"),
            current_step=t["current_step"],
            status=t["status"],
            created_at=t["created_at"],
            updated_at=t["updated_at"],
            brief=brief
        ))
    return result


@router.get("/{task_id}")
async def get_task_detail(task_id: str) -> TaskDetail:
    """获取任务详情"""
    task = db_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return TaskDetail(
        id=task["id"],
        title=task.get("title"),
        channel_id=task["channel_id"],
        channel_slug=task.get("channel_slug"),
        current_step=task["current_step"],
        status=task["status"],
        brief_data=task.get("brief_data"),
        knowledge_base_data=task.get("knowledge_base_data"),
        draft_content=task.get("draft_content"),
        final_content=task.get("final_content"),
        think_aloud_logs=task.get("think_aloud_logs"),
        created_at=task["created_at"],
        updated_at=task["updated_at"],
        completed_at=task.get("completed_at")
    )


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """删除任务"""
    success = db_service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "message": "任务已删除"}

