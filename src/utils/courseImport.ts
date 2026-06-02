/**
 * 课程导入解析工具
 * 支持两种格式：
 * 1. 学校标准课表格式（行=节次，列=星期，单元格=课程信息）
 * 2. 平铺列表格式（每行一门课，列为字段名）
 */

export interface ParsedCourse {
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  teacher: string | null;
  course_type: string | null;
  start_week: number | null;
  end_week: number | null;
  color: string;
  notes: string | null;
  credits: number | null;
}

const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#722ED1', '#14C9C9', '#F7BA1E', '#3491FA'];

/** 节次到时间映射 */
const TIME_SLOT_MAP: Record<string, { start: string; end: string }> = {
  '第一二节': { start: '08:00', end: '09:35' },
  '第1-2节': { start: '08:00', end: '09:35' },
  '一二': { start: '08:00', end: '09:35' },
  '1-2': { start: '08:00', end: '09:35' },
  '第三四节': { start: '09:55', end: '11:30' },
  '第3-4节': { start: '09:55', end: '11:30' },
  '三四': { start: '09:55', end: '11:30' },
  '3-4': { start: '09:55', end: '11:30' },
  '第五六节': { start: '14:00', end: '15:35' },
  '第5-6节': { start: '14:00', end: '15:35' },
  '五六': { start: '14:00', end: '15:35' },
  '5-6': { start: '14:00', end: '15:35' },
  '第七八节': { start: '15:55', end: '17:30' },
  '第7-8节': { start: '15:55', end: '17:30' },
  '七八': { start: '15:55', end: '17:30' },
  '7-8': { start: '15:55', end: '17:30' },
  '第九十节': { start: '19:00', end: '20:35' },
  '第九十十一节': { start: '19:00', end: '21:00' },
  '9-10': { start: '19:00', end: '20:35' },
};

/** 星期名称到数字映射 (0=周一) */
const DAY_NAME_MAP: Record<string, number> = {
  '星期一': 0, '周一': 0, '一': 0, 'Monday': 0, 'Mon': 0, '1': 0,
  '星期二': 1, '周二': 1, '二': 1, 'Tuesday': 1, 'Tue': 1, '2': 1,
  '星期三': 2, '周三': 2, '三': 2, 'Wednesday': 2, 'Wed': 2, '3': 2,
  '星期四': 3, '周四': 3, '四': 3, 'Thursday': 3, 'Thu': 3, '4': 3,
  '星期五': 4, '周五': 4, '五': 4, 'Friday': 4, 'Fri': 4, '5': 4,
  '星期六': 5, '周六': 5, '六': 5, 'Saturday': 5, 'Sat': 5, '6': 5,
  '星期日': 6, '星期天': 6, '周日': 6, '周天': 6, '七': 6, 'Sunday': 6, 'Sun': 6, '7': 6,
};

/** 解析周次信息，提取开始/结束周 */
function parseWeekRange(weekStr: string): { start_week: number | null; end_week: number | null } {
  const rangeMatch = weekStr.match(/(\d+)-(\d+)/);
  if (rangeMatch) return { start_week: parseInt(rangeMatch[1]), end_week: parseInt(rangeMatch[2]) };
  const singleMatch = weekStr.match(/(\d+)/);
  if (singleMatch) return { start_week: parseInt(singleMatch[1]), end_week: parseInt(singleMatch[1]) };
  return { start_week: 1, end_week: 20 };
}

/** 解析单个课程格子内容
 * 格式: \n课程名\n教师\n周次([周])[01-02节]\n教室\n
 */
function parseCellContent(cell: string): Array<{ name: string; teacher: string; location: string; weekStr: string }> {
  const results: Array<{ name: string; teacher: string; location: string; weekStr: string }> = [];

  // 清洗
  const cleaned = cell.replace(/\r/g, '').trim();
  if (!cleaned) return results;

  // 按空行（双\n）分割多课
  const blocks = cleaned.split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 1) continue;

    const name = lines[0];
    // 跳过空名称或看起来像标题行的内容
    if (!name || name.includes('学年') || name.includes('打印') || name.includes('班级')) continue;

    let teacher = '';
    let location = '';
    let weekStr = '1-18';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // 周次行：包含 [周] 或 节 或数字-数字([周])
      if (line.match(/[\[\(]周[\]\)]/) || line.match(/\d+.*?节/)) {
        weekStr = line;
      } else if (line.match(/楼|室|馆|厅|场|号|#/) || location === '') {
        // 地点行
        if (!teacher && i === 1 && !line.match(/\d/)) {
          teacher = line;
        } else if (line.match(/楼|室|馆|厅|场|号/) || (i > 2 && !teacher)) {
          location = line;
        } else if (!teacher) {
          teacher = line;
        } else {
          location = line;
        }
      } else if (!teacher) {
        teacher = line;
      } else if (!location) {
        location = line;
      }
    }

    if (name) {
      results.push({ name, teacher, location, weekStr });
    }
  }

  return results;
}

/** 识别时间槽行 */
function getTimeSlot(rowLabel: string): { start: string; end: string } | null {
  const normalized = rowLabel.trim();
  // 直接匹配
  for (const [key, val] of Object.entries(TIME_SLOT_MAP)) {
    if (normalized.includes(key)) return val;
  }
  // 根据 "第N节" 模式匹配
  const match = normalized.match(/第?(\d+)[、-](\d+)节?/);
  if (match) {
    const first = parseInt(match[1]);
    if (first === 1) return { start: '08:00', end: '09:35' };
    if (first === 3) return { start: '09:55', end: '11:30' };
    if (first === 5) return { start: '14:00', end: '15:35' };
    if (first === 7) return { start: '15:55', end: '17:30' };
    if (first === 9) return { start: '19:00', end: '20:35' };
  }
  return null;
}

/**
 * 解析课表格式（行=节次，列=星期）
 */
function parseTimetableFormat(data: string[][]): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  let colorIdx = 0;

  if (data.length < 3) return courses;

  // 找星期表头行（含"星期"或"Monday"字样）
  let headerRow = -1;
  let dayColMap: Record<number, number> = {};

  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r];
    const found: Record<number, number> = {};
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim();
      if (cell in DAY_NAME_MAP) {
        found[c] = DAY_NAME_MAP[cell];
      }
    }
    if (Object.keys(found).length >= 3) {
      headerRow = r;
      dayColMap = found;
      break;
    }
  }

  if (headerRow === -1) return courses;

  // 遍历时间槽行
  for (let r = headerRow + 1; r < data.length; r++) {
    const row = data[r];
    const rowLabel = String(row[0] || '').trim();
    const timeSlot = getTimeSlot(rowLabel);
    if (!timeSlot) continue;

    for (const [colStr, dayOfWeek] of Object.entries(dayColMap)) {
      const col = parseInt(colStr);
      const cellValue = String(row[col] || '').trim();
      if (!cellValue || cellValue === ' ') continue;

      const parsed = parseCellContent(cellValue);
      for (const p of parsed) {
        if (!p.name) continue;
        const { start_week, end_week } = parseWeekRange(p.weekStr);
        courses.push({
          name: p.name,
          day_of_week: dayOfWeek,
          start_time: timeSlot.start,
          end_time: timeSlot.end,
          location: p.location || '待填写',
          teacher: p.teacher || null,
          course_type: '必修',
          start_week,
          end_week,
          color: COLORS[colorIdx % COLORS.length],
          notes: null,
          credits: null,
        });
        colorIdx++;
      }
    }
  }

  return courses;
}

/**
 * 解析平铺列表格式（每行一门课）
 * 尝试识别列：课程名, 星期, 开始时间, 结束时间, 地点, 教师, 学分 等
 */
function parseFlatFormat(data: string[][]): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  if (data.length < 2) return courses;

  const headerRow = data[0].map(h => String(h || '').trim());

  // 列名识别
  const colIdx = {
    name: -1, day: -1, startTime: -1, endTime: -1,
    location: -1, teacher: -1, credits: -1, type: -1,
  };

  const fieldPatterns: Record<keyof typeof colIdx, RegExp> = {
    name: /课程名|课程|名称|name/i,
    day: /星期|周[一二三四五六日]|day|weekday/i,
    startTime: /开始|起始|上课时间|start/i,
    endTime: /结束|下课时间|end/i,
    location: /地点|教室|location|room/i,
    teacher: /教师|老师|teacher/i,
    credits: /学分|credits/i,
    type: /类型|课程类型|type/i,
  };

  headerRow.forEach((h, i) => {
    for (const [field, pattern] of Object.entries(fieldPatterns)) {
      if (pattern.test(h) && colIdx[field as keyof typeof colIdx] === -1) {
        colIdx[field as keyof typeof colIdx] = i;
      }
    }
  });

  if (colIdx.name === -1) return courses;

  let colorIdx = 0;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const name = String(row[colIdx.name] || '').trim();
    if (!name) continue;

    const dayStr = colIdx.day >= 0 ? String(row[colIdx.day] || '').trim() : '';
    const dayOfWeek = DAY_NAME_MAP[dayStr] ?? 0;

    const startTime = colIdx.startTime >= 0 ? String(row[colIdx.startTime] || '08:00').trim() : '08:00';
    const endTime = colIdx.endTime >= 0 ? String(row[colIdx.endTime] || '09:35').trim() : '09:35';
    const location = colIdx.location >= 0 ? String(row[colIdx.location] || '').trim() : '';
    const teacher = colIdx.teacher >= 0 ? String(row[colIdx.teacher] || '').trim() : '';
    const creditsRaw = colIdx.credits >= 0 ? parseFloat(String(row[colIdx.credits] || '')) : null;
    const courseType = colIdx.type >= 0 ? String(row[colIdx.type] || '必修').trim() : '必修';

    courses.push({
      name,
      day_of_week: dayOfWeek,
      start_time: startTime.padStart(5, '0'),
      end_time: endTime.padStart(5, '0'),
      location: location || '待填写',
      teacher: teacher || null,
      course_type: courseType,
      start_week: 1,
      end_week: 20,
      color: COLORS[colorIdx % COLORS.length],
      notes: null,
      credits: isNaN(creditsRaw as number) ? null : creditsRaw,
    });
    colorIdx++;
  }

  return courses;
}

/**
 * 主解析函数：从二维字符串数组解析课程列表
 * 自动识别格式（课表格式 vs 平铺格式）
 */
export function parseSheetData(data: string[][]): ParsedCourse[] {
  if (!data || data.length === 0) return [];

  // 尝试课表格式（行=节次，列=星期）
  const timetableResult = parseTimetableFormat(data);
  if (timetableResult.length > 0) return timetableResult;

  // 回退到平铺格式
  return parseFlatFormat(data);
}
