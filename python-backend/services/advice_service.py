"""
============================================================
智能学习建议生成服务模块
根据用户近期打卡数据、任务完成情况，生成个性化学习建议
============================================================
"""

import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.orm_models import Checkin, Task, TaskStatus, Goal

logger = logging.getLogger(__name__)

# 评分权重配置（总分 100 分）
SCORE_WEIGHT_CHECKIN   = 40   # 打卡频率占 40 分
SCORE_WEIGHT_TASK      = 35   # 任务完成率占 35 分
SCORE_WEIGHT_DURATION  = 25   # 日均学习时长占 25 分


class AdviceService:
    """
    智能学习建议服务
    基于规则引擎分析学习数据，生成针对性建议文本
    （不依赖外部 AI 接口，纯本地计算，适合实验环境使用）
    """

    def generate(self, db: Session, user_id: str) -> dict:
        """
        分析用户近 14 天的学习数据，生成评分和建议

        Args:
            db:       数据库会话
            user_id:  用户 ID

        Returns:
            dict: {
                "score": int,           # 综合得分 0-100
                "overall_rating": str,  # 评级：优秀/良好/一般/需加油
                "suggestions": [str],   # 建议列表
                "stats": dict,          # 原始统计数据（供前端展示）
            }
        """
        # ── 统计近 14 天数据 ─────────────────────────────────
        today      = date.today()
        start_date = today - timedelta(days=13)
        start_str  = start_date.strftime("%Y-%m-%d")
        end_str    = today.strftime("%Y-%m-%d")

        # 1. 打卡天数和总学习时长
        checkin_rows = (
            db.query(
                Checkin.checkin_date,
                func.sum(Checkin.duration_minutes).label("daily_minutes"),
                func.count(Checkin.id).label("daily_count"),
            )
            .filter(
                Checkin.user_id == user_id,
                Checkin.checkin_date >= start_str,
                Checkin.checkin_date <= end_str,
            )
            .group_by(Checkin.checkin_date)
            .all()
        )

        checkin_days   = len(checkin_rows)                            # 打卡天数
        total_days     = 14                                           # 统计区间总天数
        total_minutes  = sum(row.daily_minutes for row in checkin_rows)
        avg_minutes    = total_minutes / max(checkin_days, 1)         # 打卡日的日均时长

        # 2. 任务完成率
        all_tasks = (
            db.query(Task)
            .filter(Task.user_id == user_id)
            .all()
        )
        total_tasks     = len(all_tasks)
        completed_count = sum(1 for t in all_tasks if t.status == TaskStatus.DONE)
        task_rate       = completed_count / max(total_tasks, 1)       # 完成率 0~1

        # 3. 过期未完成的任务数（重要的负向指标）
        expired_tasks = (
            db.query(func.count(Task.id))
            .filter(
                Task.user_id == user_id,
                Task.status == TaskStatus.EXPIRED,
            )
            .scalar() or 0
        )

        # 4. 目标设置数量
        goal_count = (
            db.query(func.count(Goal.id))
            .filter(Goal.user_id == user_id, Goal.is_active == True)
            .scalar() or 0
        )

        logger.info(
            f"用户 {user_id} 近14天数据：打卡 {checkin_days} 天，"
            f"均学 {avg_minutes:.0f} 分/天，任务完成率 {task_rate:.0%}"
        )

        # ── 计算综合评分 ─────────────────────────────────────
        score = self._calc_score(
            checkin_days=checkin_days,
            total_days=total_days,
            avg_minutes=avg_minutes,
            task_rate=task_rate,
            expired_tasks=expired_tasks,
        )

        # ── 生成建议文本 ─────────────────────────────────────
        suggestions = self._build_suggestions(
            checkin_days=checkin_days,
            total_days=total_days,
            avg_minutes=avg_minutes,
            task_rate=task_rate,
            expired_tasks=expired_tasks,
            goal_count=goal_count,
            score=score,
        )

        # ── 确定评级 ─────────────────────────────────────────
        overall_rating = self._score_to_rating(score)

        return {
            "score":          score,
            "overall_rating": overall_rating,
            "suggestions":    suggestions,
            "stats": {
                "checkin_days":   checkin_days,
                "total_days":     total_days,
                "avg_minutes":    round(avg_minutes),
                "task_rate":      round(task_rate * 100),
                "expired_tasks":  expired_tasks,
                "goal_count":     goal_count,
            },
        }

    def _calc_score(
        self,
        checkin_days: int,
        total_days: int,
        avg_minutes: float,
        task_rate: float,
        expired_tasks: int,
    ) -> int:
        """
        计算综合学习评分（0-100）

        评分维度：
        - 打卡频率（40分）：打卡天数 / 总天数 × 40
        - 任务完成率（35分）：完成率 × 35
        - 日均学习时长（25分）：120分钟为满分基准
        - 过期任务扣分：每个过期任务扣 5 分，最多扣 20 分
        """
        # 打卡频率得分（0-40）
        checkin_score  = (checkin_days / max(total_days, 1)) * SCORE_WEIGHT_CHECKIN

        # 任务完成率得分（0-35）
        task_score     = task_rate * SCORE_WEIGHT_TASK

        # 日均学习时长得分（0-25）：以 120 分钟/天为满分基准
        duration_score = min(avg_minutes / 120, 1.0) * SCORE_WEIGHT_DURATION

        # 基础得分
        raw_score = checkin_score + task_score + duration_score

        # 过期任务扣分（每个扣 5 分，最多扣 20 分）
        penalty = min(expired_tasks * 5, 20)

        # 最终得分，限定在 0-100 范围内，取整
        final_score = max(0, min(100, int(raw_score - penalty)))
        return final_score

    def _score_to_rating(self, score: int) -> str:
        """根据分数返回评级文字"""
        if score >= 85:
            return "优秀 🏆"
        elif score >= 70:
            return "良好 👍"
        elif score >= 55:
            return "一般 📈"
        else:
            return "需加油 💪"

    def _build_suggestions(
        self,
        checkin_days: int,
        total_days: int,
        avg_minutes: float,
        task_rate: float,
        expired_tasks: int,
        goal_count: int,
        score: int,
    ) -> list[str]:
        """
        根据各项指标生成个性化建议文本列表

        建议逻辑（基于规则引擎）：
        - 每个维度独立评估，低于阈值则生成对应建议
        - 优秀时给予正向激励
        - 最终返回 3-6 条建议

        Returns:
            list[str]: 建议文本列表
        """
        suggestions = []
        checkin_rate = checkin_days / max(total_days, 1)  # 打卡率

        # ── 建议 1：打卡频率 ──────────────────────────────────
        if checkin_rate < 0.3:
            suggestions.append(
                f"📅 近 {total_days} 天仅打卡 {checkin_days} 天，打卡率偏低。"
                "建议设置每日提醒，养成固定打卡习惯，哪怕每天只学 20 分钟也很有价值！"
            )
        elif checkin_rate < 0.6:
            suggestions.append(
                f"📅 近 {total_days} 天打卡 {checkin_days} 天，坚持得不错！"
                "试着做到每天打卡，保持学习节奏，避免三天打鱼两天晒网。"
            )
        else:
            suggestions.append(
                f"🎯 太棒了！近 {total_days} 天坚持打卡 {checkin_days} 天，打卡率达 "
                f"{checkin_rate:.0%}！持续保持这种自律精神。"
            )

        # ── 建议 2：学习时长 ──────────────────────────────────
        if avg_minutes < 30:
            suggestions.append(
                f"⏱️ 打卡日平均学习仅 {avg_minutes:.0f} 分钟，时间稍短。"
                "建议尝试「番茄工作法」：每次专注 25 分钟，休息 5 分钟，逐步延长学习时长。"
            )
        elif avg_minutes < 60:
            suggestions.append(
                f"⏱️ 打卡日平均学习 {avg_minutes:.0f} 分钟，基础不错。"
                "若能坚持到每天 60-90 分钟，学习效果会显著提升。"
            )
        elif avg_minutes < 120:
            suggestions.append(
                f"⏱️ 打卡日平均学习 {avg_minutes:.0f} 分钟，表现良好！"
                "注意劳逸结合，每学习 50 分钟建议休息 10 分钟，保护视力和注意力。"
            )
        else:
            suggestions.append(
                f"⏱️ 打卡日平均学习 {avg_minutes:.0f} 分钟，学习投入度很高！"
                "记得适当休息，保证充足睡眠，高质量的学习比单纯的长时间更重要。"
            )

        # ── 建议 3：任务完成率 ────────────────────────────────
        if task_rate < 0.4:
            suggestions.append(
                f"📋 任务完成率仅 {task_rate:.0%}，有较多任务积压。"
                "建议每周一整理本周所有任务，按截止时间排序，优先处理最紧急的。"
            )
        elif task_rate < 0.7:
            suggestions.append(
                f"📋 任务完成率 {task_rate:.0%}，还有提升空间。"
                "尝试将大任务拆分为小步骤，每完成一步就记录进展，减少拖延感。"
            )
        else:
            suggestions.append(
                f"📋 任务完成率高达 {task_rate:.0%}，执行力很强！"
                "继续保持，及时完成任务是良好学业表现的重要保障。"
            )

        # ── 建议 4：过期任务专项建议 ──────────────────────────
        if expired_tasks > 0:
            suggestions.append(
                f"⚠️ 有 {expired_tasks} 项任务已过期未处理。"
                "建议尽快与老师沟通是否可以补交，同时开启任务提醒功能，"
                "避免下次错过截止时间。"
            )

        # ── 建议 5：目标设置建议 ──────────────────────────────
        if goal_count == 0:
            suggestions.append(
                "🎯 您还没有设置学习目标。建议在「打卡计划」页面创建 1-3 个具体目标，"
                "如「每日背 30 个英语单词」或「每周读完一章教材」，有目标的学习更高效！"
            )
        elif goal_count >= 5:
            suggestions.append(
                f"🎯 您设置了 {goal_count} 个学习目标，积极性很高！"
                "目标太多有时会分散注意力，建议聚焦于最重要的 2-3 个，深入突破。"
            )

        # ── 建议 6：综合激励 ──────────────────────────────────
        if score >= 85:
            suggestions.append(
                "🏆 综合评分优秀，您是学习的榜样！"
                "在保持当前节奏的基础上，可以尝试向同学分享学习经验，教是最好的学。"
            )
        elif score < 50:
            suggestions.append(
                "💡 学习习惯养成需要时间，不要灰心！"
                "从今天开始，每天完成一件小事：打开平台记录今天学了什么，"
                "哪怕 10 分钟也是进步。坚持 21 天就能形成习惯！"
            )

        return suggestions


# 全局建议服务单例
advice_service = AdviceService()
