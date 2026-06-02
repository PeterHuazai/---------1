"""
============================================================
管理员路由模块
提供用户封禁管理、关键词黑白名单 CRUD、联系消息管理等接口
所有接口均需要管理员权限（Depends(get_admin_user)）
============================================================
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from models.orm_models import User, KeywordFilter, ContactMessage, Notification
from routers.auth import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["管理员"])


# ── 通用分页参数 ──────────────────────────────────────────────

class Pagination(BaseModel):
    page:  int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)


# ══════════════════════════════════════════════════════════════
# 用户封禁管理
# ══════════════════════════════════════════════════════════════

class BanRequest(BaseModel):
    """封禁请求体"""
    user_id:    str           = Field(..., description="被封禁用户 ID")
    days:       Optional[int] = Field(None, ge=1, le=365,
                                      description="封禁天数，不填则永久封禁")
    reason:     Optional[str] = Field(None, max_length=200, description="封禁原因")


class UnbanRequest(BaseModel):
    """解封请求体"""
    user_id: str = Field(..., description="要解封的用户 ID")


@router.get("/users", summary="获取用户列表（管理员）")
def list_users(
    keyword:  Optional[str] = Query(None, description="搜索关键字（用户名/姓名/邮箱）"),
    banned:   Optional[bool] = Query(None, description="true=仅显示被封禁用户"),
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=100),
    admin:    User = Depends(get_admin_user),
    db:       Session = Depends(get_db),
):
    """获取全部用户列表，支持关键字搜索和封禁状态筛选"""
    query = db.query(User)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            User.username.like(like) |
            User.full_name.like(like) |
            User.email.like(like)
        )

    now = datetime.utcnow()
    if banned is True:
        query = query.filter(User.banned_until != None, User.banned_until > now)
    elif banned is False:
        query = query.filter(
            (User.banned_until == None) | (User.banned_until <= now)
        )

    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "page":  page,
        "items": [
            {
                "id":           u.id,
                "username":     u.username,
                "full_name":    u.full_name,
                "email":        u.email,
                "role":         u.role.value,
                "is_active":    u.is_active,
                "banned_until": u.banned_until.isoformat() if u.banned_until else None,
                "ban_reason":   u.ban_reason,
                "is_banned":    bool(u.banned_until and u.banned_until > now),
                "created_at":   u.created_at.isoformat() if u.created_at else "",
            }
            for u in users
        ],
    }


@router.post("/users/ban", summary="封禁用户")
def ban_user(
    req:   BanRequest,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db),
):
    """
    封禁指定用户
    - days=None：永久封禁（banned_until = 9999-12-31）
    - days=N：封禁 N 天后自动解封
    """
    target = db.query(User).filter(User.id == req.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="管理员不能封禁自己")
    if target.role.value == "admin":
        raise HTTPException(status_code=400, detail="不能封禁其他管理员账号")

    if req.days:
        target.banned_until = datetime.utcnow() + timedelta(days=req.days)
        duration_label = f"{req.days} 天"
    else:
        # 永久封禁：设为远未来时间
        target.banned_until = datetime(9999, 12, 31)
        duration_label = "永久"

    target.ban_reason = req.reason or "违规行为"
    db.commit()

    logger.info(
        f"管理员 {admin.username} 封禁用户 {target.username}，"
        f"时长={duration_label}，原因={target.ban_reason}"
    )
    return {
        "message":      f"用户 {target.username} 已被{duration_label}封禁",
        "banned_until": target.banned_until.isoformat(),
        "ban_reason":   target.ban_reason,
    }


@router.post("/users/unban", summary="解封用户")
def unban_user(
    req:   UnbanRequest,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db),
):
    """提前解除用户封禁"""
    target = db.query(User).filter(User.id == req.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    target.banned_until = None
    target.ban_reason   = None
    db.commit()

    logger.info(f"管理员 {admin.username} 解封用户 {target.username}")
    return {"message": f"用户 {target.username} 已解封"}


# ══════════════════════════════════════════════════════════════
# 关键词黑白名单管理
# ══════════════════════════════════════════════════════════════

class KeywordCreate(BaseModel):
    keyword:   str = Field(..., min_length=1, max_length=100, description="关键词文本")
    list_type: str = Field("blacklist", pattern="^(blacklist|whitelist)$",
                            description="类型：blacklist 黑名单 / whitelist 白名单")


class KeywordBatchCreate(BaseModel):
    keywords:  List[str] = Field(..., description="关键词列表")
    list_type: str        = Field("blacklist", pattern="^(blacklist|whitelist)$")


@router.get("/keywords", summary="获取关键词列表")
def list_keywords(
    list_type: Optional[str] = Query(None, description="blacklist / whitelist"),
    keyword:   Optional[str] = Query(None, description="关键词搜索"),
    page:      int = Query(1, ge=1),
    limit:     int = Query(50, ge=1, le=200),
    admin:     User = Depends(get_admin_user),
    db:        Session = Depends(get_db),
):
    """获取所有关键词，支持类型筛选和关键字搜索"""
    query = db.query(KeywordFilter)
    if list_type:
        query = query.filter(KeywordFilter.list_type == list_type)
    if keyword:
        query = query.filter(KeywordFilter.keyword.like(f"%{keyword}%"))

    total = query.count()
    items = (
        query.order_by(KeywordFilter.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page":  page,
        "items": [
            {
                "id":         kw.id,
                "keyword":    kw.keyword,
                "list_type":  kw.list_type,
                "created_at": kw.created_at.isoformat() if kw.created_at else "",
            }
            for kw in items
        ],
    }


@router.post("/keywords", status_code=201, summary="添加关键词")
def create_keyword(
    req:   KeywordCreate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db),
):
    """添加单个关键词到黑名单或白名单"""
    kw_lower = req.keyword.strip().lower()
    if not kw_lower:
        raise HTTPException(status_code=400, detail="关键词不能为空")

    # 同一类型下不重复
    exists = db.query(KeywordFilter).filter(
        KeywordFilter.keyword == kw_lower,
        KeywordFilter.list_type == req.list_type,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail=f"关键词 '{kw_lower}' 在{req.list_type}中已存在")

    kw = KeywordFilter(keyword=kw_lower, list_type=req.list_type, created_by=admin.id)
    db.add(kw)
    db.commit()
    db.refresh(kw)
    logger.info(f"管理员 {admin.username} 添加关键词：{kw_lower}（{req.list_type}）")
    return {"message": "关键词添加成功", "id": kw.id, "keyword": kw.keyword}


@router.post("/keywords/batch", summary="批量添加关键词")
def create_keywords_batch(
    req:   KeywordBatchCreate,
    admin: User = Depends(get_admin_user),
    db:    Session = Depends(get_db),
):
    """批量添加关键词（重复的会跳过）"""
    added, skipped = 0, 0
    for raw in req.keywords:
        kw_lower = raw.strip().lower()
        if not kw_lower:
            continue
        exists = db.query(KeywordFilter).filter(
            KeywordFilter.keyword == kw_lower,
            KeywordFilter.list_type == req.list_type,
        ).first()
        if exists:
            skipped += 1
            continue
        db.add(KeywordFilter(keyword=kw_lower, list_type=req.list_type, created_by=admin.id))
        added += 1
    db.commit()
    logger.info(f"管理员 {admin.username} 批量添加关键词：成功 {added} 个，跳过 {skipped} 个")
    return {"message": f"添加成功 {added} 个，重复跳过 {skipped} 个", "added": added, "skipped": skipped}


@router.delete("/keywords/{keyword_id}", summary="删除关键词")
def delete_keyword(
    keyword_id: str,
    admin:      User = Depends(get_admin_user),
    db:         Session = Depends(get_db),
):
    """删除指定关键词"""
    kw = db.query(KeywordFilter).filter(KeywordFilter.id == keyword_id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="关键词不存在")
    db.delete(kw)
    db.commit()
    return {"message": f"关键词 '{kw.keyword}' 已删除"}


# ══════════════════════════════════════════════════════════════
# 联系消息管理
# ══════════════════════════════════════════════════════════════

class ReplyRequest(BaseModel):
    reply: str = Field(..., min_length=1, max_length=2000, description="管理员回复内容")


@router.get("/contact-messages", summary="获取联系消息列表")
def list_contact_messages(
    is_read:  Optional[bool] = Query(None, description="true=已读 / false=未读"),
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=100),
    admin:    User = Depends(get_admin_user),
    db:       Session = Depends(get_db),
):
    """获取用户发来的所有联系消息，支持已读/未读筛选"""
    query = db.query(ContactMessage)
    if is_read is not None:
        query = query.filter(ContactMessage.is_read == is_read)

    total = query.count()
    msgs  = (
        query.order_by(ContactMessage.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # 批量查询用户信息
    user_ids = list({m.user_id for m in msgs})
    users_map: dict[str, User] = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: u for u in users}

    return {
        "total": total,
        "page":  page,
        "unread_count": db.query(ContactMessage).filter(ContactMessage.is_read == False).count(),
        "items": [
            {
                "id":           m.id,
                "user_id":      m.user_id,
                "sender_name":  users_map.get(m.user_id, None) and
                                (users_map[m.user_id].full_name or users_map[m.user_id].username),
                "subject":      m.subject,
                "content":      m.content,
                "is_read":      m.is_read,
                "reply":        m.reply,
                "replied_at":   m.replied_at.isoformat() if m.replied_at else None,
                "created_at":   m.created_at.isoformat() if m.created_at else "",
            }
            for m in msgs
        ],
    }


@router.put("/contact-messages/{msg_id}/read", summary="标记消息已读")
def mark_message_read(
    msg_id: str,
    admin:  User = Depends(get_admin_user),
    db:     Session = Depends(get_db),
):
    """将指定联系消息标记为已读"""
    msg = db.query(ContactMessage).filter(ContactMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="消息不存在")
    msg.is_read = True
    db.commit()
    return {"message": "已标记为已读"}


@router.post("/contact-messages/{msg_id}/reply", summary="回复联系消息")
def reply_contact_message(
    msg_id: str,
    req:    ReplyRequest,
    admin:  User = Depends(get_admin_user),
    db:     Session = Depends(get_db),
):
    """
    管理员回复指定联系消息

    回复后自动：
    1. 将消息标记为已读
    2. 向用户的站内通知表写入一条回复通知
    """
    msg = db.query(ContactMessage).filter(ContactMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="消息不存在")

    msg.reply      = req.reply
    msg.replied_at = datetime.utcnow()
    msg.is_read    = True

    # 写入站内通知
    notif = Notification(
        user_id=msg.user_id,
        title=f"管理员回复了您的消息：{msg.subject}",
        content=req.reply,
        type="system",
    )
    db.add(notif)
    db.commit()

    logger.info(f"管理员 {admin.username} 回复联系消息 {msg_id}")
    return {"message": "回复成功，用户已收到站内通知"}


# ══════════════════════════════════════════════════════════════
# 用户主动发送联系消息（普通用户可用）
# ══════════════════════════════════════════════════════════════

class ContactCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200, description="消息主题")
    content: str = Field(..., min_length=1, max_length=2000, description="消息正文")


@router.post("/contact", status_code=201, tags=["联系管理员"], summary="发送联系消息给管理员")
def send_contact_message(
    req:          ContactCreate,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    普通用户向管理员发送消息（每天最多 5 条）

    消息会：
    1. 写入 contact_messages 表
    2. 通过邮件通知管理员（需要 ADMIN_EMAIL 配置）
    """
    # 频率限制：同一用户今日已发消息数
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_count = (
        db.query(ContactMessage)
        .filter(
            ContactMessage.user_id == current_user.id,
            ContactMessage.created_at >= today_start,
        )
        .count()
    )
    if today_count >= 5:
        raise HTTPException(status_code=429, detail="今日联系消息已达上限（5条），请明天再试")

    msg = ContactMessage(
        user_id=current_user.id,
        subject=req.subject.strip(),
        content=req.content.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # 异步发送邮件通知管理员（失败不影响主流程）
    _notify_admin_by_email(
        sender_name=current_user.full_name or current_user.username,
        subject=req.subject,
        content=req.content,
        db=db,
    )

    logger.info(f"用户 {current_user.username} 发送联系消息：{req.subject}")
    return {"message": "消息已发送，管理员将尽快处理", "id": msg.id}


@router.get("/contact/my", tags=["联系管理员"], summary="查看我发送的联系消息")
def list_my_contact_messages(
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """查看当前用户发送的所有联系消息及管理员回复"""
    msgs = (
        db.query(ContactMessage)
        .filter(ContactMessage.user_id == current_user.id)
        .order_by(ContactMessage.created_at.desc())
        .all()
    )
    return [
        {
            "id":         m.id,
            "subject":    m.subject,
            "content":    m.content,
            "reply":      m.reply,
            "replied_at": m.replied_at.isoformat() if m.replied_at else None,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        }
        for m in msgs
    ]


# ── 内部工具：邮件通知管理员 ──────────────────────────────────

def _notify_admin_by_email(sender_name: str, subject: str, content: str, db: Session):
    """发送邮件提醒管理员有新的联系消息（忽略失败）"""
    try:
        from config import settings
        from services.email_service import email_service

        if not settings.admin_email:
            return

        html = email_service.build_admin_notification_html(
            sender_name=sender_name,
            subject=subject,
            content=content,
        )
        email_service.send_email(
            to_email=settings.admin_email,
            subject=f"[学习平台通知] 新用户消息：{subject}",
            html_content=html,
            db=db,
        )
    except Exception as e:
        logger.warning(f"管理员邮件通知发送失败：{e}")
