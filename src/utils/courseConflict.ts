// 课程时间冲突检测工具函数

/** 将 "HH:MM" 转为分钟数，便于比较 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export interface ConflictTarget {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  name: string;
}

/**
 * 检查 candidate 是否与 existing 列表中的某课程存在时间冲突。
 * excludeId: 编辑时排除自身。
 * 返回所有冲突课程名称列表，空数组表示无冲突。
 */
export function detectConflicts(
  candidate: ConflictTarget,
  existingCourses: ConflictTarget[],
  excludeId?: string
): ConflictTarget[] {
  const s1 = timeToMinutes(candidate.start_time);
  const e1 = timeToMinutes(candidate.end_time);

  return existingCourses.filter(c => {
    if (excludeId && c.id === excludeId) return false; // 编辑时排除自身
    if (c.day_of_week !== candidate.day_of_week) return false; // 不同天无冲突
    const s2 = timeToMinutes(c.start_time);
    const e2 = timeToMinutes(c.end_time);
    // 时间段重叠条件：s1 < e2 && s2 < e1
    return s1 < e2 && s2 < e1;
  });
}
