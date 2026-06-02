"""
============================================================
学习统计报告生成服务模块
从 MySQL 读取打卡记录和任务数据，生成周报/月报统计摘要
============================================================
"""

import logging
from datetime import datetime, timedelta, date
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.orm_models import Checkin, Task, TaskStatus, Goal

logger = logging.getLogger(__name__)


class ReportService:
    """
    学习统计报告服务
    支持生成周报（最近 7 天）和月报（最近 30 天）
    """

    def generate(self, db: Session, user_id: str, period: str) -> dict:
        """
        生成学习统计报告

        Args:
            db:        数据库会话
            user_id:   用户 ID
            period:    报告周期，"week" 或 "month"

        Returns:
            dict: 包含统计数据的报告字典
        """
        # ── 计算报告时间范围 ─────────────────────────────────
        today = date.today()
        if period == "week":
            # 周报：最近 7 天（含今天）
            start_date = today - timedelta(days=6)
            period_label = "周报"
        else:
            # 月报：最近 30 天（含今天）
            start_date = today - timedelta(days=29)
            period_label = "月报"

        end_date = today
        start_str = start_date.strftime("%Y-%m-%d")
        end_str   = end_date.strftime("%Y-%m-%d")

        logger.info(f"生成{period_label}：用户 {user_id}，时间范围 {start_str} ~ {end_str}")

        # ── 统计打卡数据 ─────────────────────────────────────
        # 查询该时间范围内的所有打卡记录（关联目标获取课程分类信息）
        checkins = (
            db.query(Checkin)
            .join(Goal, Checkin.goal_id == Goal.id)
            .filter(
                Checkin.user_id == user_id,
                Checkin.checkin_date >= start_str,
                Checkin.checkin_date <= end_str,
            )
            .add_columns(Goal.name.label("goal_name"), Goal.category)
            .all()
        )

        # 累计总打卡次数和总学习时长
        total_checkins = len(checkins)
        total_minutes  = sum(row.Checkin.duration_minutes for row in checkins)

        # 按目标/科目分类统计学习时长
        subject_map: dict[str, dict] = defaultdict(lambda: {"minutes": 0, "count": 0})
        for row in checkins:
            key = row.goal_name or row.category or "未分类"
            subject_map[key]["minutes"] += row.Checkin.duration_minutes
            subject_map[key]["count"]   += 1

        # 转换为列表，按学习时长降序排列（最努力的科目在前）
        subject_stats = [
            {
                "course_name":    name,
                "study_minutes":  data["minutes"],
                "checkin_count":  data["count"],
            }
            for name, data in sorted(
                subject_map.items(), key=lambda x: x[1]["minutes"], reverse=True
            )
        ]

        # ── 统计任务完成情况 ─────────────────────────────────
        # 查询截止日期在统计范围内的所有任务
        tasks = (
            db.query(Task)
            .filter(
                Task.user_id == user_id,
                Task.due_date >= datetime.combine(start_date, datetime.min.time()),
                Task.due_date <= datetime.combine(end_date, datetime.max.time()),
            )
            .all()
        )

        # 已完成任务数（状态为 done）
        completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.DONE)
        # 未完成任务数（pending 或 in_progress）
        pending_tasks   = sum(1 for t in tasks if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS))

        # ── 计算连续打卡天数 ─────────────────────────────────
        streak_days = self._calc_streak(db, user_id)

        # ── 组装报告数据 ─────────────────────────────────────
        report = {
            "period":               period,
            "period_label":         period_label,
            "start_date":           start_str,
            "end_date":             end_str,
            "total_checkins":       total_checkins,
            "total_study_minutes":  total_minutes,
            "total_study_hours":    round(total_minutes / 60, 1),   # 换算为小时
            "completed_tasks":      completed_tasks,
            "pending_tasks":        pending_tasks,
            "subject_stats":        subject_stats,
            "streak_days":          streak_days,
        }

        logger.info(
            f"报告生成完成：总打卡 {total_checkins} 次，"
            f"总学习 {total_minutes} 分钟，完成任务 {completed_tasks} 项"
        )
        return report

    def _calc_streak(self, db: Session, user_id: str) -> int:
        """
        计算用户从今天向前连续打卡的天数

        逻辑：从今天开始，每天检查是否有打卡记录，
              遇到第一个没有打卡的日期就停止计数

        Args:
            db:       数据库会话
            user_id:  用户 ID

        Returns:
            int: 连续打卡天数（今天没打卡则为 0）
        """
        streak = 0
        check_date = date.today()

        # 最多向前检查 365 天，防止无限循环
        for _ in range(365):
            date_str = check_date.strftime("%Y-%m-%d")
            # 查询该日期是否有打卡记录
            count = (
                db.query(func.count(Checkin.id))
                .filter(
                    Checkin.user_id == user_id,
                    Checkin.checkin_date == date_str,
                )
                .scalar()
            )
            if count and count > 0:
                streak    += 1
                check_date = check_date - timedelta(days=1)   # 继续向前检查
            else:
                break  # 该天没有打卡记录，连续中断

        return streak


# 全局报告服务单例
report_service = ReportService()
