"""
============================================================
课程冲突检测服务模块
从 MySQL 读取课程数据，检测时间重叠的课程对
============================================================
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from models.orm_models import Course

logger = logging.getLogger(__name__)


class ConflictDetector:
    """
    课程冲突检测器
    两门课程冲突的判定条件：
      1. 同一用户
      2. 同一星期
      3. 周次范围有交集（如第1-8周 与 第5-18周 存在交集）
      4. 上课时间段有重叠（时间区间交叉）
    """

    def _time_to_minutes(self, time_str: str) -> int:
        """
        将 HH:MM 格式的时间转换为从 00:00 开始的分钟数

        例如：
            "08:00" → 480
            "09:40" → 580

        Args:
            time_str: 时间字符串，格式 HH:MM

        Returns:
            int: 分钟数
        """
        try:
            parts = time_str.split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except (ValueError, IndexError, AttributeError):
            logger.warning(f"时间格式解析失败：{time_str}，将返回 0")
            return 0

    def _time_overlap(self, start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
        """
        判断两个时间区间是否存在重叠

        两区间不重叠的条件：A 结束 <= B 开始，或 B 结束 <= A 开始
        取反即为重叠条件

        Args:
            start_a, end_a: 课程 A 的时间区间
            start_b, end_b: 课程 B 的时间区间

        Returns:
            bool: True 表示时间重叠（冲突）
        """
        sa = self._time_to_minutes(start_a)
        ea = self._time_to_minutes(end_a)
        sb = self._time_to_minutes(start_b)
        eb = self._time_to_minutes(end_b)

        # 区间重叠：A 开始 < B 结束，且 B 开始 < A 结束
        return sa < eb and sb < ea

    def _week_overlap(
        self,
        sw_a: Optional[int], ew_a: Optional[int],
        sw_b: Optional[int], ew_b: Optional[int],
    ) -> bool:
        """
        判断两门课程的周次范围是否有交集

        若任一课程未设置周次，视为全学期（第1-25周），一定有交集

        Args:
            sw_a, ew_a: 课程 A 的起始/结束周次
            sw_b, ew_b: 课程 B 的起始/结束周次

        Returns:
            bool: True 表示周次有交集
        """
        # 未设置周次时默认为全学期
        sw_a = sw_a or 1
        ew_a = ew_a or 25
        sw_b = sw_b or 1
        ew_b = ew_b or 25

        # 周次区间重叠判断与时间区间相同
        return sw_a <= ew_b and sw_b <= ew_a

    def detect(
        self,
        db: Session,
        user_id: str,
        new_course_data: dict = None,
    ) -> dict:
        """
        执行课程冲突检测

        使用场景：
        - new_course_data 为 None：检测该用户所有已有课程之间的冲突
        - new_course_data 有值：检测新课程与所有已有课程的冲突

        Args:
            db:              数据库会话
            user_id:         用户 ID
            new_course_data: 新增课程数据字典（可选）

        Returns:
            dict: {
                "has_conflict": bool,
                "conflicts": [{"course_a": {...}, "course_b": {...}, "reason": "..."}],
                "summary": "..."
            }
        """
        # 从数据库查询该用户的所有课程
        existing_courses: List[Course] = (
            db.query(Course)
            .filter(Course.user_id == user_id)
            .all()
        )
        logger.info(f"用户 {user_id} 共有 {len(existing_courses)} 门课程，开始冲突检测")

        conflicts = []

        if new_course_data:
            # ── 场景 1：检测新课程与已有课程的冲突 ──────────────
            for existing in existing_courses:
                conflict_reason = self._check_two_courses(new_course_data, {
                    "id":          existing.id,
                    "name":        existing.name,
                    "day_of_week": existing.day_of_week,
                    "start_time":  existing.start_time,
                    "end_time":    existing.end_time,
                    "start_week":  existing.start_week,
                    "end_week":    existing.end_week,
                })
                if conflict_reason:
                    conflicts.append({
                        "course_a": {
                            "id":   new_course_data.get("id", "新课程"),
                            "name": new_course_data.get("name", "待添加课程"),
                            "day_of_week": new_course_data.get("day_of_week"),
                            "start_time":  new_course_data.get("start_time"),
                            "end_time":    new_course_data.get("end_time"),
                        },
                        "course_b": {
                            "id":   existing.id,
                            "name": existing.name,
                            "day_of_week": existing.day_of_week,
                            "start_time":  existing.start_time,
                            "end_time":    existing.end_time,
                        },
                        "reason": conflict_reason,
                    })
        else:
            # ── 场景 2：检测所有已有课程两两之间的冲突 ───────────
            # 使用双层循环，i < j 避免重复检测（A-B 和 B-A 算同一对）
            for i in range(len(existing_courses)):
                for j in range(i + 1, len(existing_courses)):
                    ca = existing_courses[i]
                    cb = existing_courses[j]
                    conflict_reason = self._check_two_courses(
                        {
                            "id": ca.id, "name": ca.name,
                            "day_of_week": ca.day_of_week,
                            "start_time": ca.start_time, "end_time": ca.end_time,
                            "start_week": ca.start_week, "end_week": ca.end_week,
                        },
                        {
                            "id": cb.id, "name": cb.name,
                            "day_of_week": cb.day_of_week,
                            "start_time": cb.start_time, "end_time": cb.end_time,
                            "start_week": cb.start_week, "end_week": cb.end_week,
                        }
                    )
                    if conflict_reason:
                        conflicts.append({
                            "course_a": {
                                "id": ca.id, "name": ca.name,
                                "day_of_week": ca.day_of_week,
                                "start_time": ca.start_time, "end_time": ca.end_time,
                            },
                            "course_b": {
                                "id": cb.id, "name": cb.name,
                                "day_of_week": cb.day_of_week,
                                "start_time": cb.start_time, "end_time": cb.end_time,
                            },
                            "reason": conflict_reason,
                        })

        # 生成检测摘要
        has_conflict = len(conflicts) > 0
        if has_conflict:
            summary = f"⚠️ 检测到 {len(conflicts)} 处课程时间冲突，请及时处理！"
        else:
            summary = "✅ 未发现课程时间冲突，课表安排合理。"

        logger.info(f"冲突检测完成：{summary}")
        return {
            "has_conflict": has_conflict,
            "conflicts":    conflicts,
            "summary":      summary,
        }

    def _check_two_courses(self, course_a: dict, course_b: dict) -> Optional[str]:
        """
        检查两门课程是否冲突，返回冲突原因或 None

        Args:
            course_a: 课程 A 的字典数据
            course_b: 课程 B 的字典数据

        Returns:
            str | None: 冲突原因描述，无冲突则返回 None
        """
        # 不同天的课程不会冲突
        if course_a.get("day_of_week") != course_b.get("day_of_week"):
            return None

        # 检查周次是否有交集
        if not self._week_overlap(
            course_a.get("start_week"), course_a.get("end_week"),
            course_b.get("start_week"), course_b.get("end_week"),
        ):
            return None  # 周次不重叠，不冲突

        # 检查时间是否重叠
        if self._time_overlap(
            course_a.get("start_time", ""), course_a.get("end_time", ""),
            course_b.get("start_time", ""), course_b.get("end_time", ""),
        ):
            day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            day = day_names[course_a.get("day_of_week", 0)]
            return (
                f"{day} {course_a.get('start_time')}~{course_a.get('end_time')} 与 "
                f"{course_b.get('start_time')}~{course_b.get('end_time')} 时间段重叠"
            )

        return None


# 全局冲突检测器单例
conflict_detector = ConflictDetector()
