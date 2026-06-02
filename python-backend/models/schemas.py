"""
============================================================
数据模型定义模块
使用 Pydantic v2 定义所有请求/响应数据结构，提供自动校验
============================================================
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from enum import Enum


# ── 邮件相关模型 ─────────────────────────────────────────────

class EmailRequest(BaseModel):
    """邮件发送请求体"""

    # 收件人邮箱，使用 EmailStr 自动校验格式
    to: EmailStr = Field(..., description="收件人邮箱地址")
    # 邮件主题
    subject: str = Field(..., min_length=1, max_length=100, description="邮件主题")
    # 邮件正文（支持 HTML 格式）
    html: str = Field(..., min_length=1, description="邮件 HTML 正文")


class EmailResponse(BaseModel):
    """邮件发送响应体"""
    success: bool
    message: str


# ── 课程冲突检测相关模型 ─────────────────────────────────────

class CourseSlot(BaseModel):
    """单个课程时间段信息"""

    # 课程 ID
    id: str = Field(..., description="课程 UUID")
    # 课程名称
    name: str = Field(..., description="课程名称")
    # 星期几（0=周一, 1=周二, ..., 6=周日）
    day_of_week: int = Field(..., ge=0, le=6, description="星期几（0=周一）")
    # 开始时间，格式 HH:MM
    start_time: str = Field(..., description="开始时间，格式 HH:MM")
    # 结束时间，格式 HH:MM
    end_time: str = Field(..., description="结束时间，格式 HH:MM")
    # 起始周次
    start_week: Optional[int] = Field(None, ge=1, le=25, description="起始周次")
    # 结束周次
    end_week: Optional[int] = Field(None, ge=1, le=25, description="结束周次")


class ConflictPair(BaseModel):
    """检测到的一对冲突课程"""

    # 课程 A
    course_a: CourseSlot
    # 课程 B
    course_b: CourseSlot
    # 冲突说明
    reason: str = Field(..., description="冲突原因描述")


class ConflictDetectRequest(BaseModel):
    """课程冲突检测请求体"""

    # 用户 ID（从 Supabase 获取该用户的所有课程）
    user_id: str = Field(..., description="用户 UUID")
    # 待检测的新课程（可选，若提供则检测新课程与已有课程的冲突）
    new_course: Optional[CourseSlot] = Field(None, description="新增课程，不填则检测全部")


class ConflictDetectResponse(BaseModel):
    """课程冲突检测响应体"""

    # 是否存在冲突
    has_conflict: bool
    # 冲突对列表
    conflicts: List[ConflictPair]
    # 检测说明
    summary: str


# ── 学习统计报告相关模型 ─────────────────────────────────────

class ReportPeriod(str, Enum):
    """报告周期枚举"""
    WEEK = "week"    # 周报
    MONTH = "month"  # 月报


class ReportRequest(BaseModel):
    """学习统计报告生成请求体"""

    # 用户 ID
    user_id: str = Field(..., description="用户 UUID")
    # 报告周期
    period: ReportPeriod = Field(ReportPeriod.WEEK, description="报告周期：week/month")


class SubjectStat(BaseModel):
    """单科学习统计"""
    course_name: str
    study_minutes: int      # 学习分钟数
    checkin_count: int      # 打卡次数


class ReportData(BaseModel):
    """学习统计报告数据"""

    # 报告周期类型
    period: ReportPeriod
    # 报告开始日期（ISO 格式）
    start_date: str
    # 报告结束日期（ISO 格式）
    end_date: str
    # 总打卡次数
    total_checkins: int
    # 总学习分钟数
    total_study_minutes: int
    # 已完成任务数
    completed_tasks: int
    # 未完成任务数
    pending_tasks: int
    # 各科目学习统计
    subject_stats: List[SubjectStat]
    # 打卡连续天数
    streak_days: int


# ── 智能学习建议相关模型 ─────────────────────────────────────

class AdviceRequest(BaseModel):
    """智能学习建议请求体"""

    # 用户 ID
    user_id: str = Field(..., description="用户 UUID")


class AdviceResponse(BaseModel):
    """智能学习建议响应体"""

    # 建议列表（每条建议为一段文字）
    suggestions: List[str]
    # 综合评价（如：优秀/良好/需加油）
    overall_rating: str
    # 评分（0-100）
    score: int
