"""
============================================================
SQLAlchemy ORM 数据模型定义
每个类对应 MySQL 中的一张表，字段注释说明各列用途
============================================================
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, Text, ForeignKey, Enum as SAEnum, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from database import Base


# ── 工具函数 ──────────────────────────────────────────────────

def gen_uuid() -> str:
    """生成随机 UUID 字符串，用作主键默认值"""
    return str(uuid.uuid4())


# ── 枚举类型定义 ──────────────────────────────────────────────

class UserRole(str, enum.Enum):
    """用户角色枚举"""
    STUDENT = "student"   # 普通学生
    ADMIN   = "admin"     # 管理员


class TaskType(str, enum.Enum):
    """任务类型枚举"""
    HOMEWORK   = "homework"    # 作业
    EXAM       = "exam"        # 考试
    LAB        = "lab"         # 实验报告
    PAPER      = "paper"       # 课程论文
    QUIZ       = "quiz"        # 随堂测验
    OTHER      = "other"       # 其他


class TaskStatus(str, enum.Enum):
    """任务状态枚举"""
    PENDING     = "pending"     # 未开始
    IN_PROGRESS = "in_progress" # 进行中
    DONE        = "done"        # 已完成
    EXPIRED     = "expired"     # 已过期


class GoalPeriod(str, enum.Enum):
    """学习目标周期枚举"""
    DAILY   = "daily"    # 每日
    WEEKLY  = "weekly"   # 每周
    MONTHLY = "monthly"  # 每月


# ── 用户表 ────────────────────────────────────────────────────

class User(Base):
    """
    用户表（users）
    存储用户账号信息及个人资料
    """
    __tablename__ = "users"

    # 主键：UUID 字符串，避免自增 ID 泄漏用户数量
    id          = Column(String(36), primary_key=True, default=gen_uuid, comment="用户唯一标识 UUID")
    # 用户名，唯一索引，用于登录
    username    = Column(String(50), unique=True, nullable=False, index=True, comment="登录用户名")
    # 密码哈希值（使用 bcrypt 加密存储，绝不明文保存）
    password_hash = Column(String(100), nullable=False, comment="bcrypt 加密后的密码")
    # 真实姓名
    full_name   = Column(String(50), nullable=True, comment="真实姓名")
    # 学校名称
    school      = Column(String(100), nullable=True, comment="所在学校")
    # 所学专业
    major       = Column(String(100), nullable=True, comment="所学专业")
    # 年级，如"2023级"
    grade       = Column(String(20), nullable=True, comment="年级，如 2023级")
    # 邮箱，用于接收提醒邮件
    email       = Column(String(100), nullable=True, index=True, comment="绑定邮箱，用于接收提醒")
    # 头像 URL
    avatar_url  = Column(String(500), nullable=True, comment="头像图片 URL")
    # 用户角色
    role        = Column(SAEnum(UserRole), default=UserRole.STUDENT, nullable=False, comment="用户角色")
    # 是否激活
    is_active   = Column(Boolean, default=True, nullable=False, comment="账号是否激活")
    # 创建时间，自动填充
    created_at  = Column(DateTime, server_default=func.now(), comment="注册时间")
    # 更新时间，每次修改自动更新
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="最后更新时间")

    # ── 关联关系 ──────────────────────────────────────────────
    # 一个用户拥有多门课程，删除用户时级联删除其课程
    courses     = relationship("Course",       back_populates="user", cascade="all, delete-orphan")
    tasks       = relationship("Task",         back_populates="user", cascade="all, delete-orphan")
    goals       = relationship("Goal",         back_populates="user", cascade="all, delete-orphan")
    email_logs  = relationship("EmailLog",     back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


# ── 课程表 ────────────────────────────────────────────────────

class Course(Base):
    """
    课程表（courses）
    存储用户的课程信息，支持冲突检测
    """
    __tablename__ = "courses"

    id              = Column(String(36), primary_key=True, default=gen_uuid, comment="课程 UUID")
    # 外键关联用户，删除用户时级联删除
    user_id         = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="所属用户 ID")
    name            = Column(String(100), nullable=False, comment="课程名称")
    # 星期几：0=周一, 1=周二, ..., 6=周日
    day_of_week     = Column(Integer, nullable=False, comment="星期几：0=周一，6=周日")
    start_time      = Column(String(5), nullable=False, comment="开始时间，格式 HH:MM，如 08:00")
    end_time        = Column(String(5), nullable=False, comment="结束时间，格式 HH:MM，如 09:40")
    location        = Column(String(100), nullable=True, comment="上课地点")
    teacher         = Column(String(50), nullable=True, comment="任课老师姓名")
    credits         = Column(Float, nullable=True, comment="课程学分")
    # 课程类型：必修/选修/通识/实践等
    course_type     = Column(String(20), nullable=True, comment="课程类型：必修/选修/通识等")
    # 前端显示用的颜色标签，如 #165DFF
    color           = Column(String(7), nullable=True, comment="课程卡片颜色，十六进制如 #165DFF")
    # 上课周次范围
    start_week      = Column(Integer, nullable=True, comment="起始周次，如第 1 周")
    end_week        = Column(Integer, nullable=True, comment="结束周次，如第 18 周")
    # 上课提醒提前分钟数：0=不提醒, 15=提前15分钟, 30=提前30分钟等
    reminder_minutes = Column(Integer, default=15, comment="上课前多少分钟发提醒邮件，0 表示不提醒")
    notes           = Column(Text, nullable=True, comment="课程备注")
    created_at      = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    # 关联到用户
    user = relationship("User", back_populates="courses")

    # 复合索引：按用户ID + 星期查询课程（常用查询场景）
    __table_args__ = (
        Index("ix_courses_user_day", "user_id", "day_of_week"),
    )


# ── 任务表（作业/考试/实验等） ──────────────────────────────────

class Task(Base):
    """
    任务表（tasks）
    存储作业、考试、实验报告等各类学习任务
    """
    __tablename__ = "tasks"

    id            = Column(String(36), primary_key=True, default=gen_uuid, comment="任务 UUID")
    user_id       = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="所属用户 ID")
    # 可选关联课程，任务可能来自某门课
    course_id     = Column(String(36), ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, comment="关联课程 ID（可空）")
    course_name   = Column(String(100), nullable=True, comment="课程名称冗余字段，避免联表查询")
    name          = Column(String(200), nullable=False, comment="任务名称，如《数据结构第3次作业》")
    # 任务类型，使用枚举限制取值范围
    type          = Column(SAEnum(TaskType), default=TaskType.HOMEWORK, nullable=False, comment="任务类型")
    # 截止时间/考试时间
    due_date      = Column(DateTime, nullable=False, comment="截止时间或考试时间")
    submit_method = Column(String(100), nullable=True, comment="提交方式，如纸质/网上/现场")
    # 成绩占比，0.0~100.0
    weight        = Column(Float, nullable=True, comment="成绩占比，如 30.0 表示占总评 30%")
    notes         = Column(Text, nullable=True, comment="任务备注")
    # 任务状态
    status        = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False, comment="任务状态")
    # 各档提醒开关
    reminder_3d   = Column(Boolean, default=True, comment="是否在截止前 3 天发邮件提醒")
    reminder_1d   = Column(Boolean, default=True, comment="是否在截止前 1 天发邮件提醒")
    reminder_1h   = Column(Boolean, default=False, comment="是否在截止前 1 小时发邮件提醒")
    created_at    = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    user   = relationship("User", back_populates="tasks")
    course = relationship("Course")

    # 索引：按用户ID + 截止时间查询（任务列表常用排序）
    __table_args__ = (
        Index("ix_tasks_user_due", "user_id", "due_date"),
    )


# ── 学习目标表 ────────────────────────────────────────────────

class Goal(Base):
    """
    学习目标表（goals）
    存储用户设定的学习目标，用于打卡统计
    """
    __tablename__ = "goals"

    id           = Column(String(36), primary_key=True, default=gen_uuid, comment="目标 UUID")
    user_id      = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="所属用户 ID")
    name         = Column(String(100), nullable=False, comment="目标名称，如《每日背 50 个单词》")
    description  = Column(Text, nullable=True, comment="目标详细描述")
    # 目标周期
    period       = Column(SAEnum(GoalPeriod), default=GoalPeriod.DAILY, nullable=False, comment="目标周期：daily/weekly/monthly")
    # 目标数值，如每日学习 120 分钟
    target_value = Column(Integer, default=60, nullable=False, comment="目标数值，单位由 unit 字段决定")
    unit         = Column(String(20), default="分钟", nullable=False, comment="数值单位，如 分钟/次/页")
    # 目标分类，如专业课/英语/运动
    category     = Column(String(50), default="学习", nullable=False, comment="目标分类")
    is_active    = Column(Boolean, default=True, comment="是否启用该目标")
    created_at   = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    user     = relationship("User", back_populates="goals")
    checkins = relationship("Checkin", back_populates="goal", cascade="all, delete-orphan")


# ── 打卡记录表 ────────────────────────────────────────────────

class Checkin(Base):
    """
    打卡记录表（checkins）
    每次打卡对应一条记录，记录学习时长和备注
    """
    __tablename__ = "checkins"

    id               = Column(String(36), primary_key=True, default=gen_uuid, comment="打卡记录 UUID")
    goal_id          = Column(String(36), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, comment="关联目标 ID")
    user_id          = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="打卡用户 ID")
    # 打卡日期（仅日期部分，格式 YYYY-MM-DD）
    checkin_date     = Column(String(10), nullable=False, comment="打卡日期，格式 YYYY-MM-DD")
    # 本次学习时长（分钟）
    duration_minutes = Column(Integer, default=0, nullable=False, comment="本次学习时长（分钟）")
    notes            = Column(Text, nullable=True, comment="打卡备注，如学习心得")
    created_at       = Column(DateTime, server_default=func.now(), comment="打卡时间")

    goal = relationship("Goal", back_populates="checkins")

    # 索引：按用户ID + 打卡日期查询（统计报告常用）
    __table_args__ = (
        Index("ix_checkins_user_date", "user_id", "checkin_date"),
    )


# ── 邮件发送日志表 ────────────────────────────────────────────

class EmailLog(Base):
    """
    邮件发送日志表（email_logs）
    记录每次邮件发送的详情，便于排查问题和统计
    """
    __tablename__ = "email_logs"

    id          = Column(String(36), primary_key=True, default=gen_uuid, comment="日志 UUID")
    user_id     = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, comment="关联用户 ID（可空）")
    # 收件人地址
    to_email    = Column(String(100), nullable=False, comment="收件人邮箱")
    # 邮件主题
    subject     = Column(String(200), nullable=False, comment="邮件主题")
    # 发送状态：success=成功, failed=失败
    status      = Column(String(10), nullable=False, comment="发送状态：success/failed")
    # 失败时记录错误信息
    error_msg   = Column(Text, nullable=True, comment="发送失败时的错误信息")
    created_at  = Column(DateTime, server_default=func.now(), comment="发送时间")

    user = relationship("User", back_populates="email_logs")


# ── 站内通知表 ────────────────────────────────────────────────

class Notification(Base):
    """
    站内通知表（notifications）
    存储上课提醒、任务提醒、系统通知等
    """
    __tablename__ = "notifications"

    id         = Column(String(36), primary_key=True, default=gen_uuid, comment="通知 UUID")
    user_id    = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, comment="接收通知的用户 ID")
    title      = Column(String(200), nullable=False, comment="通知标题")
    content    = Column(Text, nullable=False, comment="通知内容")
    # 通知类型：course=上课提醒, task=任务提醒, system=系统通知
    type       = Column(String(20), default="system", nullable=False, comment="通知类型：course/task/system")
    # 是否已读
    is_read    = Column(Boolean, default=False, nullable=False, comment="是否已读")
    related_id = Column(String(36), nullable=True, comment="关联的课程或任务 ID")
    created_at = Column(DateTime, server_default=func.now(), comment="通知创建时间")

    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )
