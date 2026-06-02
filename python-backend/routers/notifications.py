"""
============================================================
站内通知路由模块
提供通知列表、标记已读、批量标记已读、删除通知等接口
============================================================
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from models.orm_models import Notification, User
from routers.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["站内通知"])


# ── 请求体 ────────────────────────────────────────────────────

class NotificationCreate(BaseModel):
    """创建系统通知请求体（管理员推送专用）"""
    title:      str = Field(..., min_length=1, max_length=200)
    content:    str = Field(..., min_length=1)
    type:       str = Field("system", pattern="^(course|task|system)$")
    related_id: Optional[str] = None


# ── API 接口 ──────────────────────────────────────────────────

@router.get("/", summary="获取我的通知列表")
def list_notifications(
    is_read:      Optional[bool] = Query(None, description="true=已读 / false=未读"),
    notif_type:   Optional[str]  = Query(None, description="course / task / system"),
    page:         int  = Query(1,  ge=1),
    limit:        int  = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    获取当前用户的站内通知，支持已读状态和类型筛选

    返回分页数据及未读总数（供前端徽章显示使用）
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if notif_type:
        query = query.filter(Notification.type == notif_type)

    total        = query.count()
    unread_total = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    items = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total":        total,
        "unread_total": unread_total,
        "page":         page,
        "items": [
            {
                "id":         n.id,
                "title":      n.title,
                "content":    n.content,
                "type":       n.type,
                "is_read":    n.is_read,
                "related_id": n.related_id,
                "created_at": n.created_at.isoformat() if n.created_at else "",
            }
            for n in items
        ],
    }


@router.get("/unread-count", summary="获取未读通知数量")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """返回当前用户的未读通知数量（用于顶部导航栏徽章）"""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"unread_count": count}


@router.put("/{notif_id}/read", summary="标记单条通知已读")
def mark_one_read(
    notif_id:     str,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """将指定通知标记为已读（仅允许操作自己的通知）"""
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="通知不存在")

    notif.is_read = True
    db.commit()
    return {"message": "已标记为已读"}


@router.put("/read-all", summary="全部标记已读")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """将当前用户所有未读通知一次性标记为已读"""
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()
    logger.info(f"用户 {current_user.username} 全部已读，共 {updated} 条")
    return {"message": f"已将 {updated} 条通知标记为已读", "updated": updated}


@router.delete("/{notif_id}", summary="删除通知")
def delete_notification(
    notif_id:     str,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """删除指定通知（物理删除）"""
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="通知不存在")

    db.delete(notif)
    db.commit()
    return {"message": "通知已删除"}


@router.delete("/", summary="清空全部通知")
def delete_all_notifications(
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """清空当前用户的全部通知"""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .delete()
    )
    db.commit()
    return {"message": f"已清空 {count} 条通知", "deleted": count}
