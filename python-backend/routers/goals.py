"""
============================================================
打卡与学习目标路由模块
提供目标设置、打卡记录、数据统计等接口
============================================================
"""

import logging
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from database import get_db
from models.orm_models import Goal, Checkin, GoalPeriod, User
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/goals", tags=["打卡计划"])


# ── 请求/响应数据模型 ─────────────────────────────────────────

class GoalCreate(BaseModel):
    """创建学习目标请求体"""
    name:         str         = Field(..., min_length=1, max_length=100)
    description:  Optional[str] = None
    period:       GoalPeriod  = GoalPeriod.DAILY
    target_value: int         = Field(60, ge=1, description="目标数值，如 60 分钟")
    unit:         str         = Field("分钟", max_length=20)
    category:     str         = Field("学习", max_length=50)


class CheckinCreate(BaseModel):
    """打卡记录请求体"""
    goal_id:          str           = Field(..., description="打卡对应的目标 ID")
    duration_minutes: int           = Field(0, ge=0, description="本次学习时长（分钟）")
    checkin_date:     Optional[str] = Field(None, description="打卡日期 YYYY-MM-DD，默认为今天")
    notes:            Optional[str] = None


# ── 目标接口 ──────────────────────────────────────────────────

@router.get("/", summary="获取我的学习目标列表")
def list_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有学习目标（含连续打卡天数统计）"""
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.is_active == True)
        .order_by(Goal.created_at.desc())
        .all()
    )

    result = []
    today_str = date.today().strftime("%Y-%m-%d")

    for goal in goals:
        # 统计该目标的总打卡次数
        total_checkins = (
            db.query(func.count(Checkin.id))
            .filter(Checkin.goal_id == goal.id)
            .scalar() or 0
        )
        # 今日是否已打卡
        today_checked = (
            db.query(func.count(Checkin.id))
            .filter(Checkin.goal_id == goal.id, Checkin.checkin_date == today_str)
            .scalar() or 0
        ) > 0

        result.append({
            "id":             goal.id,
            "name":           goal.name,
            "description":    goal.description,
            "period":         goal.period.value,
            "target_value":   goal.target_value,
            "unit":           goal.unit,
            "category":       goal.category,
            "total_checkins": total_checkins,
            "today_checked":  today_checked,
            "created_at":     goal.created_at.isoformat() if goal.created_at else "",
        })

    return result


@router.post("/", status_code=201, summary="新建学习目标")
def create_goal(
    req: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """新建学习目标"""
    goal = Goal(user_id=current_user.id, **req.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    logger.info(f"用户 {current_user.username} 新建目标：{req.name}")
    return {"message": "目标创建成功", "id": goal.id}


@router.delete("/{goal_id}", summary="删除学习目标")
def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除学习目标（标记为不活跃，不物理删除，保留打卡历史）"""
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="目标不存在")
    goal.is_active = False   # 软删除，保留历史数据
    db.commit()
    return {"message": "目标已停用"}


# ── 打卡接口 ──────────────────────────────────────────────────

@router.post("/checkins", status_code=201, summary="提交打卡记录")
def create_checkin(
    req: CheckinCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    提交一次打卡记录

    - checkin_date 不填则默认为今天
    - 同一目标同一天可以多次打卡（累计时长）
    """
    # 验证目标是否属于当前用户
    goal = db.query(Goal).filter(
        Goal.id == req.goal_id, Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="学习目标不存在")

    # 未提供日期时默认为今天
    checkin_date = req.checkin_date or date.today().strftime("%Y-%m-%d")

    checkin = Checkin(
        goal_id=req.goal_id,
        user_id=current_user.id,
        checkin_date=checkin_date,
        duration_minutes=req.duration_minutes,
        notes=req.notes,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    logger.info(
        f"用户 {current_user.username} 打卡：目标={goal.name}，"
        f"日期={checkin_date}，时长={req.duration_minutes}分钟"
    )
    return {
        "message":    "打卡成功！",
        "id":         checkin.id,
        "goal_name":  goal.name,
        "date":       checkin_date,
        "duration":   req.duration_minutes,
    }


@router.get("/checkins", summary="获取打卡记录列表")
def list_checkins(
    goal_id:    Optional[str] = Query(None, description="按目标筛选"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date:   Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取打卡记录，支持按目标和日期范围筛选"""
    query = db.query(Checkin).filter(Checkin.user_id == current_user.id)

    if goal_id:
        query = query.filter(Checkin.goal_id == goal_id)
    if start_date:
        query = query.filter(Checkin.checkin_date >= start_date)
    if end_date:
        query = query.filter(Checkin.checkin_date <= end_date)

    checkins = query.order_by(Checkin.checkin_date.desc(), Checkin.created_at.desc()).all()

    return [
        {
            "id":               c.id,
            "goal_id":          c.goal_id,
            "checkin_date":     c.checkin_date,
            "duration_minutes": c.duration_minutes,
            "notes":            c.notes,
            "created_at":       c.created_at.isoformat() if c.created_at else "",
        }
        for c in checkins
    ]


@router.get("/stats/summary", summary="获取打卡统计摘要")
def get_stats_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取当前用户的整体打卡统计摘要
    包含：总打卡次数、总学习时长、今日打卡情况
    """
    today_str = date.today().strftime("%Y-%m-%d")

    # 总打卡次数
    total_checkins = (
        db.query(func.count(Checkin.id))
        .filter(Checkin.user_id == current_user.id)
        .scalar() or 0
    )

    # 总学习时长（分钟）
    total_minutes = (
        db.query(func.sum(Checkin.duration_minutes))
        .filter(Checkin.user_id == current_user.id)
        .scalar() or 0
    )

    # 今日打卡次数和时长
    today_checkins = (
        db.query(func.count(Checkin.id))
        .filter(Checkin.user_id == current_user.id, Checkin.checkin_date == today_str)
        .scalar() or 0
    )
    today_minutes = (
        db.query(func.sum(Checkin.duration_minutes))
        .filter(Checkin.user_id == current_user.id, Checkin.checkin_date == today_str)
        .scalar() or 0
    )

    return {
        "total_checkins":   total_checkins,
        "total_minutes":    total_minutes,
        "total_hours":      round(total_minutes / 60, 1),
        "today_checkins":   today_checkins,
        "today_minutes":    today_minutes,
    }
