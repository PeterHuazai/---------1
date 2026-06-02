"""
============================================================
页面 5 — 智能建议
基于学习数据生成个性化改进建议和综合评分
============================================================
"""

import streamlit as st
import plotly.graph_objects as go
from datetime import date, timedelta
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, page_header, sidebar_nav

st.set_page_config(page_title="智能建议", page_icon="💡", layout="wide")
require_login()
sidebar_nav()

user_id = st.session_state.user_id
today   = date.today()
page_header("💡 智能学习建议", "根据您的学习数据，生成个性化改进建议")
st.divider()

# ══════════════════════════════════════════════════════════════
# 数据收集（近 30 天）
# ══════════════════════════════════════════════════════════════
start_30 = (today - timedelta(days=29)).strftime("%Y-%m-%d")
today_str = today.strftime("%Y-%m-%d")

# 近30天打卡统计
df_checkin = run_query(
    """SELECT COUNT(DISTINCT checkin_date) AS days,
              COALESCE(SUM(duration_minutes), 0) AS total_min,
              COALESCE(AVG(duration_minutes), 0) AS avg_min
       FROM checkins
       WHERE user_id = :uid AND checkin_date >= :sd""",
    {"uid": user_id, "sd": start_30},
)
checkin_days  = int(df_checkin["days"].iloc[0])   if not df_checkin.empty else 0
total_min     = int(df_checkin["total_min"].iloc[0]) if not df_checkin.empty else 0
avg_min       = float(df_checkin["avg_min"].iloc[0]) if not df_checkin.empty else 0.0

# 连续打卡天数
df_dates = run_query(
    """SELECT DISTINCT checkin_date FROM checkins
       WHERE user_id = :uid
       ORDER BY checkin_date DESC
       LIMIT 60""",
    {"uid": user_id},
)
streak = 0
if not df_dates.empty:
    dates = sorted(df_dates["checkin_date"].tolist(), reverse=True)
    # 将日期字符串转为 date 对象
    from datetime import datetime as dt
    date_objs = [dt.strptime(str(d)[:10], "%Y-%m-%d").date() for d in dates]
    for i, d in enumerate(date_objs):
        if d == today - timedelta(days=i) or d == today - timedelta(days=i+1):
            streak += 1
        else:
            break

# 任务统计
df_tasks = run_query(
    """SELECT status, COUNT(*) AS cnt FROM tasks
       WHERE user_id = :uid
       GROUP BY status""",
    {"uid": user_id},
)
task_map    = dict(zip(df_tasks["status"], df_tasks["cnt"])) if not df_tasks.empty else {}
total_tasks = sum(task_map.values())
done_tasks  = task_map.get("done", 0)
exp_tasks   = task_map.get("expired", 0)
completion_rate = round(done_tasks / max(total_tasks, 1) * 100)

# 课程数量
df_course_cnt = run_query(
    "SELECT COUNT(*) AS cnt FROM courses WHERE user_id = :uid",
    {"uid": user_id},
)
course_cnt = int(df_course_cnt["cnt"].iloc[0]) if not df_course_cnt.empty else 0

# ══════════════════════════════════════════════════════════════
# 生成综合评分（规则引擎，0-100 分）
# ══════════════════════════════════════════════════════════════
score_items = []

# 维度 1：打卡坚持度（30天内打卡天数，满30=40分）
persist_score = min(40, round(checkin_days / 30 * 40))
score_items.append(("坚持度", persist_score, 40,
                    f"近30天打卡 {checkin_days} 天"))

# 维度 2：学习时长（日均60分钟=30分，最高30分）
duration_score = min(30, round(avg_min / 60 * 30))
score_items.append(("时长达标", duration_score, 30,
                    f"日均 {avg_min:.0f} 分钟"))

# 维度 3：任务完成率（完成率=20分，每过期1个扣2分）
task_score = max(0, round(completion_rate / 100 * 20) - exp_tasks * 2)
score_items.append(("任务管理", task_score, 20,
                    f"完成率 {completion_rate}%，已过期 {exp_tasks} 项"))

# 维度 4：课程管理（添加课程=满分10分）
course_score = min(10, course_cnt * 2)
score_items.append(("课表完整", course_score, 10,
                    f"已添加 {course_cnt} 门课程"))

total_score = sum(s for _, s, _, _ in score_items)

# ── 评分等级 ──────────────────────────────────────────────────
if total_score >= 85:
    grade, grade_color, grade_emoji = "优秀", "#00B96B", "🌟"
elif total_score >= 70:
    grade, grade_color, grade_emoji = "良好", "#165DFF", "👍"
elif total_score >= 55:
    grade, grade_color, grade_emoji = "一般", "#FF7D00", "💪"
else:
    grade, grade_color, grade_emoji = "需努力", "#FF4D4F", "🔥"

# ── 雷达图展示各维度 ─────────────────────────────────────────
col_score, col_radar = st.columns([1, 2], gap="large")

with col_score:
    st.markdown(f"""
        <div style='text-align:center;padding:30px 20px;background:#fff;
                    border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08)'>
            <p style='color:#888;font-size:14px;margin:0'>综合学习评分</p>
            <p style='font-size:64px;font-weight:800;margin:8px 0;color:{grade_color}'>
                {total_score}
            </p>
            <p style='font-size:24px;margin:0;color:{grade_color}'>{grade_emoji} {grade}</p>
            <hr style='border:none;border-top:1px solid #f0f0f0;margin:16px 0'>
            {''.join(
                f"<div style='display:flex;justify-content:space-between;margin:6px 0'>"
                f"<span style='color:#555;font-size:13px'>{name}</span>"
                f"<span style='font-weight:600;color:{grade_color}'>{s}/{mx}</span></div>"
                for name, s, mx, _ in score_items
            )}
        </div>
    """, unsafe_allow_html=True)

with col_radar:
    dims    = [item[0] for item in score_items]
    scores  = [item[1] for item in score_items]
    maxvals = [item[2] for item in score_items]
    # 归一化到 0-100
    normalized = [s/mx*100 for s, mx in zip(scores, maxvals)]

    fig = go.Figure(go.Scatterpolar(
        r=normalized + [normalized[0]],
        theta=dims + [dims[0]],
        fill="toself",
        fillcolor="rgba(22,93,255,0.15)",
        line=dict(color="#165DFF", width=2),
        marker=dict(size=6, color="#165DFF"),
    ))
    fig.update_layout(
        polar=dict(
            radialaxis=dict(visible=True, range=[0, 100],
                            gridcolor="#f0f0f0", tickfont_size=10),
            angularaxis=dict(tickfont_size=13),
        ),
        height=280,
        margin=dict(l=40, r=40, t=20, b=20),
        paper_bgcolor="#fff",
    )
    st.plotly_chart(fig, use_container_width=True)

st.divider()

# ══════════════════════════════════════════════════════════════
# 生成个性化建议
# ══════════════════════════════════════════════════════════════
st.markdown("#### 💡 个性化改进建议")

suggestions = []

# 建议 1：打卡坚持度
if checkin_days == 0:
    suggestions.append(("🚨 立即开始打卡",
        "近30天内您还没有任何打卡记录。从今天开始，每天记录学习时间，"
        "哪怕只有15分钟也很有价值！前往「打卡计划」页面创建您的第一个学习目标。",
        "#FF4D4F"))
elif checkin_days < 10:
    suggestions.append(("⏰ 提高打卡频率",
        f"近30天打卡 {checkin_days} 天，打卡率仅 {int(checkin_days/30*100)}%。"
        "建议设置每天定时提醒（如每晚21:00），养成记录习惯，目标每周打卡5天以上。",
        "#FF7D00"))
elif checkin_days < 20:
    suggestions.append(("📈 再进一步",
        f"近30天打卡 {checkin_days} 天，打卡率 {int(checkin_days/30*100)}%，"
        "已有不错的基础！尝试「不断链」挑战：每天都打卡，即使某天只学了10分钟也要记录。",
        "#165DFF"))
else:
    suggestions.append(("🌟 坚持优秀",
        f"近30天打卡 {checkin_days} 天，打卡率高达 {int(checkin_days/30*100)}%！"
        f"连续打卡 {streak} 天，保持这份坚持，学习成果一定会越来越显著！",
        "#00B96B"))

# 建议 2：学习时长
if avg_min < 30:
    suggestions.append(("⏱️ 增加学习时长",
        f"打卡日平均学习 {avg_min:.0f} 分钟，略显不足。"
        "建议尝试「番茄工作法」：每次专注 25 分钟，休息 5 分钟，"
        "积少成多，每天 2-3 个番茄钟即可达到 60 分钟目标。",
        "#FF7D00"))
elif avg_min < 60:
    suggestions.append(("⏱️ 学习时长提升空间",
        f"打卡日平均学习 {avg_min:.0f} 分钟，基础不错。"
        "若能坚持到每天 60-90 分钟，学习效果会显著提升。"
        "可以尝试拆分学习时间：早晚各30-45分钟。",
        "#165DFF"))
elif avg_min > 180:
    suggestions.append(("⚠️ 注意劳逸结合",
        f"打卡日平均学习 {avg_min:.0f} 分钟，学习非常刻苦！"
        "但长时间连续学习会导致效率下降，记得每学习50分钟休息10分钟，"
        "保持良好睡眠，才能高效学习。",
        "#722ED1"))

# 建议 3：任务管理
if exp_tasks > 0:
    suggestions.append(("📋 处理过期任务",
        f"您有 {exp_tasks} 项任务已过期！请尽快联系老师说明情况，"
        "或重新规划剩余任务的完成时间。未来添加任务时请务必设置提前提醒。",
        "#FF4D4F"))
if total_tasks > 0 and completion_rate < 50:
    suggestions.append(("📝 提高任务完成率",
        f"任务完成率仅 {completion_rate}%，建议将大任务拆分为小步骤，"
        "每天完成1-2个子任务。设置截止前3天和1天的邮件提醒，避免遗忘。",
        "#FF7D00"))

# 建议 4：课程管理
if course_cnt == 0:
    suggestions.append(("📅 完善课程表",
        "您还没有添加任何课程！前往「课程表」页面录入本学期的所有课程，"
        "系统将帮您检测时间冲突，并可在首页查看今日课程安排。",
        "#FF7D00"))

# 建议 5：积极鼓励
if total_score >= 80:
    suggestions.append(("🏆 继续保持",
        "您的学习管理做得非常好！建议尝试更高阶目标："
        "在「学习报告」中分析自己的学习曲线，找出效率最高的时间段，"
        "集中精力攻克难点科目。",
        "#00B96B"))

# 渲染建议卡片
for title, content, color in suggestions:
    st.markdown(f"""
        <div style='padding:16px 20px;background:#fff;border-radius:12px;
                    border-left:5px solid {color};margin-bottom:12px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.07)'>
            <p style='font-weight:700;color:#1d2129;margin:0 0 8px'>{title}</p>
            <p style='color:#555;font-size:14px;line-height:1.7;margin:0'>{content}</p>
        </div>
    """, unsafe_allow_html=True)

st.divider()

# ── 连续打卡激励 ──────────────────────────────────────────────
if streak > 0:
    st.markdown(f"""
        <div style='text-align:center;padding:20px;background:linear-gradient(135deg,#165DFF,#722ED1);
                    border-radius:16px;color:#fff'>
            <p style='font-size:36px;margin:0'>🔥</p>
            <p style='font-size:22px;font-weight:700;margin:8px 0'>连续打卡 {streak} 天！</p>
            <p style='opacity:0.85;margin:0'>坚持就是胜利，继续加油！</p>
        </div>
    """, unsafe_allow_html=True)
