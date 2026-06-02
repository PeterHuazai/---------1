"""
============================================================
邮件、报告、建议路由模块
提供邮件发送、学习报告生成、智能建议接口
============================================================
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from database import get_db
from models.orm_models import User
from routers.auth import get_current_user
from services.email_service import email_service
from services.report_service import report_service
from services.advice_service import advice_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["邮件与智能功能"])


# ── 邮件接口 ──────────────────────────────────────────────────

class EmailSendRequest(BaseModel):
    """手动发送邮件请求体"""
    to:      EmailStr = Field(..., description="收件人邮箱")
    subject: str      = Field(..., min_length=1, max_length=100)
    html:    str      = Field(..., min_length=1)


@router.post("/email/send", tags=["邮件发送"], summary="手动发送邮件")
def send_email(
    req: EmailSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    手动发送一封邮件（管理员或高级功能使用）

    邮件通过 163 SMTP 服务发送，并记录到 email_logs 表
    """
    result = email_service.send_email(
        to_email=req.to,
        subject=req.subject,
        html_content=req.html,
        db=db,
        user_id=current_user.id,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/email/test", tags=["邮件发送"], summary="发送测试邮件到绑定邮箱")
def send_test_email(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    向当前用户绑定的邮箱发送一封测试邮件
    用于验证邮件配置是否正确
    """
    if not current_user.email:
        raise HTTPException(status_code=400, detail="您尚未绑定邮箱，请先在个人中心绑定邮箱")

    html = email_service.build_test_email_html(
        username=current_user.full_name or current_user.username
    )
    result = email_service.send_email(
        to_email=current_user.email,
        subject="学习助手 · 邮件配置验证",
        html_content=html,
        db=db,
        user_id=current_user.id,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return {"message": f"测试邮件已发送至 {current_user.email}，请查收"}


@router.get("/email/logs", tags=["邮件发送"], summary="查看邮件发送记录")
def get_email_logs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查看当前用户的邮件发送历史（最近 N 条）"""
    from models.orm_models import EmailLog
    logs = (
        db.query(EmailLog)
        .filter(EmailLog.user_id == current_user.id)
        .order_by(EmailLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id":         log.id,
            "to_email":   log.to_email,
            "subject":    log.subject,
            "status":     log.status,
            "error_msg":  log.error_msg,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]


# ── 学习报告接口 ──────────────────────────────────────────────

@router.get("/report", tags=["学习报告"], summary="生成学习统计报告")
def generate_report(
    period: str = "week",   # "week" 或 "month"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    生成学习统计报告

    - period=week：统计最近 7 天（周报）
    - period=month：统计最近 30 天（月报）

    数据来源：MySQL 中当前用户的打卡记录和任务完成情况
    """
    if period not in ("week", "month"):
        raise HTTPException(status_code=400, detail="period 参数只能是 week 或 month")

    report = report_service.generate(db=db, user_id=current_user.id, period=period)
    return report


@router.post("/report/email", tags=["学习报告"], summary="生成报告并发送到邮箱")
def send_report_email(
    period: str = "week",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    生成学习报告并通过邮件发送给用户

    需要用户已绑定邮箱
    """
    if not current_user.email:
        raise HTTPException(status_code=400, detail="请先绑定邮箱才能接收报告")

    # 生成报告数据
    report = report_service.generate(db=db, user_id=current_user.id, period=period)
    username = current_user.full_name or current_user.username

    # 构建邮件 HTML
    period_label = report.get("period_label", "学习报告")
    subject_stats_html = "".join([
        f"<tr><td style='padding:6px 12px;border-bottom:1px solid #f0f0f0'>{s['course_name']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center'>{s['study_minutes']}分钟</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center'>{s['checkin_count']}次</td></tr>"
        for s in report.get("subject_stats", [])
    ]) or "<tr><td colspan='3' style='padding:12px;text-align:center;color:#aaa'>暂无打卡数据</td></tr>"

    html = f"""
    <div style='font-family:PingFang SC,Microsoft YaHei,sans-serif;max-width:560px;margin:0 auto;background:#f5f7fa;padding:24px;'>
      <div style='background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)'>
        <div style='background:#165DFF;padding:20px 28px'>
          <h2 style='color:#fff;margin:0'>📊 {username} 的{period_label}</h2>
          <p style='color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px'>{report["start_date"]} ~ {report["end_date"]}</p>
        </div>
        <div style='padding:24px 28px'>
          <div style='display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px'>
            <div style='background:#f0f5ff;border-radius:8px;padding:12px;text-align:center'>
              <div style='font-size:24px;font-weight:700;color:#165DFF'>{report["total_checkins"]}</div>
              <div style='font-size:12px;color:#888;margin-top:4px'>总打卡次数</div>
            </div>
            <div style='background:#f0f5ff;border-radius:8px;padding:12px;text-align:center'>
              <div style='font-size:24px;font-weight:700;color:#165DFF'>{report["total_study_hours"]}h</div>
              <div style='font-size:12px;color:#888;margin-top:4px'>学习总时长</div>
            </div>
            <div style='background:#f0fff4;border-radius:8px;padding:12px;text-align:center'>
              <div style='font-size:24px;font-weight:700;color:#00b96b'>{report["completed_tasks"]}</div>
              <div style='font-size:12px;color:#888;margin-top:4px'>完成任务</div>
            </div>
            <div style='background:#fff7e6;border-radius:8px;padding:12px;text-align:center'>
              <div style='font-size:24px;font-weight:700;color:#fa8c16'>{report["streak_days"]}</div>
              <div style='font-size:12px;color:#888;margin-top:4px'>连续打卡天</div>
            </div>
          </div>
          <h3 style='font-size:14px;color:#333;margin:0 0 12px'>各科目学习情况</h3>
          <table style='width:100%;border-collapse:collapse;font-size:13px'>
            <thead><tr style='background:#f5f7fa'>
              <th style='padding:8px 12px;text-align:left;color:#888'>科目/目标</th>
              <th style='padding:8px 12px;text-align:center;color:#888'>学习时长</th>
              <th style='padding:8px 12px;text-align:center;color:#888'>打卡次数</th>
            </tr></thead>
            <tbody>{subject_stats_html}</tbody>
          </table>
        </div>
        <div style='background:#f5f7fa;padding:14px 28px;border-top:1px solid #e5e6eb'>
          <p style='color:#aaa;font-size:12px;margin:0'>此报告由学习助手自动生成，请勿直接回复。</p>
        </div>
      </div>
    </div>
    """

    result = email_service.send_email(
        to_email=current_user.email,
        subject=f"学习助手 · {username}的{period_label}（{report['start_date']} ~ {report['end_date']}）",
        html_content=html,
        db=db,
        user_id=current_user.id,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return {"message": f"{period_label}已发送至 {current_user.email}，请查收"}


# ── 智能学习建议接口 ──────────────────────────────────────────

@router.get("/advice", tags=["智能建议"], summary="获取智能学习建议")
def get_learning_advice(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    根据近 14 天的打卡数据和任务完成情况，
    生成个性化学习建议和综合评分

    返回：
    - score：综合评分（0-100）
    - overall_rating：评级（优秀/良好/一般/需加油）
    - suggestions：建议列表（3-6 条）
    - stats：原始统计数据
    """
    return advice_service.generate(db=db, user_id=current_user.id)
