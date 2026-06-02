"""
============================================================
任务管理路由模块（作业/考试/实验报告等）
提供任务的增删改查，以及紧急程度自动标注
============================================================
"""

import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from models.orm_models import Task, TaskType, TaskStatus, User
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["任务管理"])


# ── 请求/响应数据模型 ─────────────────────────────────────────

class TaskCreate(BaseModel):
    """创建任务请求体"""
    name:          str            = Field(..., min_length=1, max_length=200)
    type:          TaskType       = TaskType.HOMEWORK
    due_date:      datetime       = Field(..., description="截止时间，ISO 格式如 2025-06-01T23:59:00")
    course_id:     Optional[str]  = None
    course_name:   Optional[str]  = None
    submit_method: Optional[str]  = None
    weight:        Optional[float]= Field(None, ge=0, le=100)
    notes:         Optional[str]  = None
    reminder_3d:   bool           = True
    reminder_1d:   bool           = True
    reminder_1h:   bool           = False


class TaskResponse(BaseModel):
    """任务信息响应体（包含计算字段）"""
    id:            str
    user_id:       str
    course_id:     Optional[str]
    course_name:   Optional[str]
    name:          str
    type:          str
    due_date:      str
    submit_method: Optional[str]
    weight:        Optional[float]
    notes:         Optional[str]
    status:        str
    urgency:       str             # 计算字段：紧急程度（urgent/warning/normal/done）
    hours_left:    Optional[float] # 计算字段：距截止剩余小时数
    reminder_3d:   bool
    reminder_1d:   bool
    reminder_1h:   bool
    created_at:    str


# ── API 接口 ──────────────────────────────────────────────────

@router.get("/", response_model=List[TaskResponse], summary="获取任务列表")
def list_tasks(
    task_type: Optional[str] = Query(None, description="按类型筛选：homework/exam/lab等"),
    task_status: Optional[str] = Query(None, description="按状态筛选：pending/done/expired"),
    course_id: Optional[str] = Query(None, description="按课程筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的任务列表，支持多条件筛选"""
    query = db.query(Task).filter(Task.user_id == current_user.id)

    if task_type:
        query = query.filter(Task.type == task_type)
    if task_status:
        query = query.filter(Task.status == task_status)
    if course_id:
        query = query.filter(Task.course_id == course_id)

    # 按截止时间升序排列（最紧急的在前）
    tasks = query.order_by(Task.due_date.asc()).all()

    # 自动更新已过期任务状态
    _auto_expire_tasks(db, tasks)

    return [_task_to_response(t) for t in tasks]


@router.post("/", response_model=TaskResponse, status_code=201, summary="添加任务")
def create_task(
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """添加新任务"""
    task = Task(user_id=current_user.id, **req.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    logger.info(f"用户 {current_user.username} 添加任务：{req.name}")
    return _task_to_response(task)


@router.get("/{task_id}", response_model=TaskResponse, summary="获取任务详情")
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定任务详情"""
    task = _get_user_task(db, task_id, current_user.id)
    return _task_to_response(task)


@router.put("/{task_id}/status", summary="更新任务状态")
def update_task_status(
    task_id: str,
    new_status: TaskStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新任务状态（pending → in_progress → done）
    前端点击「标记完成」按钮时调用此接口
    """
    task = _get_user_task(db, task_id, current_user.id)
    task.status = new_status
    db.commit()
    return {"message": f"任务状态已更新为：{new_status.value}"}


@router.put("/{task_id}", response_model=TaskResponse, summary="修改任务信息")
def update_task(
    task_id: str,
    req: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改任务信息"""
    task = _get_user_task(db, task_id, current_user.id)
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return _task_to_response(task)


@router.delete("/{task_id}", summary="删除任务")
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除指定任务"""
    task = _get_user_task(db, task_id, current_user.id)
    db.delete(task)
    db.commit()
    return {"message": "任务已删除"}


# ── 内部工具函数 ──────────────────────────────────────────────

def _get_user_task(db: Session, task_id: str, user_id: str) -> Task:
    """查询任务，不存在或不属于当前用户则抛出 404"""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


def _calc_urgency(task: Task) -> tuple:
    """
    计算任务紧急程度和剩余小时数

    Returns:
        (urgency: str, hours_left: float | None)
        urgency: "urgent"（24小时内）/ "warning"（7天内）/ "normal"（7天以上）/ "done" / "expired"
    """
    if task.status == TaskStatus.DONE:
        return "done", None

    now = datetime.utcnow()
    # 将数据库中的 datetime 和 now 统一转换进行比较
    due = task.due_date
    if due.tzinfo is not None:
        from datetime import timezone
        now = datetime.now(timezone.utc)

    hours_left = (due - now).total_seconds() / 3600

    if hours_left < 0:
        return "expired", 0.0
    elif hours_left <= 24:
        return "urgent", round(hours_left, 1)     # 24 小时内：红色紧急
    elif hours_left <= 168:                        # 168 = 7 * 24
        return "warning", round(hours_left, 1)    # 7 天内：黄色警告
    else:
        return "normal", round(hours_left, 1)     # 7 天以上：正常


def _auto_expire_tasks(db: Session, tasks: list):
    """
    批量检查并更新已过期任务的状态
    避免前端显示过期任务仍为"待处理"
    """
    now = datetime.utcnow()
    updated = False
    for task in tasks:
        if task.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
            due = task.due_date
            if due.tzinfo is None and due < now:
                task.status = TaskStatus.EXPIRED
                updated = True
    if updated:
        db.commit()


def _task_to_response(t: Task) -> TaskResponse:
    """ORM 对象转响应体，附加计算字段"""
    urgency, hours_left = _calc_urgency(t)
    return TaskResponse(
        id=t.id, user_id=t.user_id, course_id=t.course_id,
        course_name=t.course_name, name=t.name, type=t.type.value,
        due_date=t.due_date.isoformat() if t.due_date else "",
        submit_method=t.submit_method, weight=t.weight, notes=t.notes,
        status=t.status.value, urgency=urgency, hours_left=hours_left,
        reminder_3d=t.reminder_3d, reminder_1d=t.reminder_1d, reminder_1h=t.reminder_1h,
        created_at=t.created_at.isoformat() if t.created_at else "",
    )
