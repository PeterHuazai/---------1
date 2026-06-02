"""
============================================================
Streamlit 主入口 — 首页仪表盘
展示用户学习总览数据、今日课程、待办任务等核心指标
============================================================
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import date, timedelta

# 导入公共工具模块（数据库查询、登录验证、UI 组件等）
from utils import require_login, run_query, metric_card, page_header, sidebar_nav

# ── 页面配置（必须是第一个 Streamlit 调用） ───────────────────
st.set_page_config(
    page_title="学习管理平台",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── 全局样式 ──────────────────────────────────────────────────
st.markdown("""
<style>
    /* 隐藏 Streamlit 默认顶部装饰 */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    .block-container { padding-top: 1.5rem; }
    /* 指标卡片容器间距 */
    div[data-testid="metric-container"] {
        background: #fff;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 1px 6px rgba(0,0,0,0.07);
    }
</style>
""", unsafe_allow_html=True)

# ── 登录检查（未登录则显示登录页并终止渲染） ──────────────────
require_login()

# ── 侧边栏导航 ────────────────────────────────────────────────
sidebar_nav()

with st.sidebar:
    st.markdown("### 📌 导航")
    st.page_link("app.py",                         label="🏠 首页仪表盘",  icon="📊")
    st.page_link("pages/1_课程表.py",               label="📅 课程表",      icon="📅")
    st.page_link("pages/2_任务管理.py",             label="✅ 任务管理",    icon="✅")
    st.page_link("pages/3_打卡计划.py",             label="🎯 打卡计划",    icon="🎯")
    st.page_link("pages/4_学习报告.py",             label="📈 学习报告",    icon="📈")
    st.page_link("pages/5_智能建议.py",             label="💡 智能建议",    icon="💡")
    st.page_link("pages/6_邮件通知.py",             label="📧 邮件通知",    icon="📧")

# ── 页面主体 ──────────────────────────────────────────────────
user_id = st.session_state.user_id
name    = st.session_state.full_name
today   = date.today()
today_str     = today.strftime("%Y-%m-%d")
week_ago_str  = (today - timedelta(days=6)).strftime("%Y-%m-%d")
day_of_week   = today.weekday()   # 0=周一, 6=周日

page_header(f"👋 你好，{name}！", f"今天是 {today.strftime('%Y年%m月%d日')}，星期{'一二三四五六日'[day_of_week]}")

st.divider()

# ── 第一行：核心指标卡片 ──────────────────────────────────────
c1, c2, c3, c4, c5 = st.columns(5)

# 查询今日课程数
df_today_courses = run_query(
    "SELECT COUNT(*) AS cnt FROM courses WHERE user_id = :uid AND day_of_week = :dow",
    {"uid": user_id, "dow": day_of_week},
)
today_courses = int(df_today_courses["cnt"].iloc[0]) if not df_today_courses.empty else 0

# 查询未完成任务数（状态为 pending 或 in_progress）
df_pending = run_query(
    "SELECT COUNT(*) AS cnt FROM tasks WHERE user_id = :uid AND status IN ('pending','in_progress')",
    {"uid": user_id},
)
pending_tasks = int(df_pending["cnt"].iloc[0]) if not df_pending.empty else 0

# 查询近 7 天打卡天数
df_streak = run_query(
    "SELECT COUNT(DISTINCT checkin_date) AS cnt FROM checkins WHERE user_id = :uid AND checkin_date >= :sd",
    {"uid": user_id, "sd": week_ago_str},
)
week_checkins = int(df_streak["cnt"].iloc[0]) if not df_streak.empty else 0

# 查询近 7 天学习总分钟数
df_minutes = run_query(
    "SELECT COALESCE(SUM(duration_minutes),0) AS total FROM checkins WHERE user_id = :uid AND checkin_date >= :sd",
    {"uid": user_id, "sd": week_ago_str},
)
week_minutes = int(df_minutes["total"].iloc[0]) if not df_minutes.empty else 0

# 查询今日是否已打卡
df_today_check = run_query(
    "SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = :uid AND checkin_date = :d",
    {"uid": user_id, "d": today_str},
)
today_checked = int(df_today_check["cnt"].iloc[0]) > 0 if not df_today_check.empty else False

with c1:
    st.metric("📅 今日课程", f"{today_courses} 节")
with c2:
    st.metric("📋 待完成任务", f"{pending_tasks} 项",
              delta="请及时处理" if pending_tasks > 3 else None,
              delta_color="inverse")
with c3:
    st.metric("🎯 本周打卡", f"{week_checkins}/7 天")
with c4:
    st.metric("⏱️ 本周学习", f"{round(week_minutes/60,1)} 小时")
with c5:
    st.metric("✅ 今日打卡", "已打卡 ✓" if today_checked else "未打卡")

st.divider()

# ── 第二行：今日课程 + 近期任务 ───────────────────────────────
left_col, right_col = st.columns([1, 1], gap="large")

with left_col:
    st.markdown("#### 📅 今日课程")
    day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    df_courses = run_query(
        """SELECT name, start_time, end_time, location, teacher, color
           FROM courses
           WHERE user_id = :uid AND day_of_week = :dow
           ORDER BY start_time""",
        {"uid": user_id, "dow": day_of_week},
    )
    if df_courses.empty:
        st.info(f"今天（{day_names[day_of_week]}）没有课程，好好休息！")
    else:
        for _, row in df_courses.iterrows():
            color = row.get("color") or "#165DFF"
            st.markdown(f"""
                <div style='display:flex;align-items:center;gap:12px;
                            padding:10px 14px;background:#fff;border-radius:8px;
                            border-left:4px solid {color};margin-bottom:8px;
                            box-shadow:0 1px 4px rgba(0,0,0,0.06)'>
                    <div style='flex:1'>
                        <p style='font-weight:600;margin:0;color:#1d2129'>{row['name']}</p>
                        <p style='color:#888;font-size:12px;margin:2px 0 0'>
                            🕐 {row['start_time']}–{row['end_time']}
                            {'　📍 ' + str(row['location']) if row['location'] else ''}
                            {'　👨‍🏫 ' + str(row['teacher']) if row['teacher'] else ''}
                        </p>
                    </div>
                </div>
            """, unsafe_allow_html=True)

with right_col:
    st.markdown("#### ⚡ 紧急任务（7天内截止）")
    soon = (today + timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    df_urgent = run_query(
        """SELECT name, course_name, due_date, status, type
           FROM tasks
           WHERE user_id = :uid
             AND status IN ('pending','in_progress')
             AND due_date <= :soon
           ORDER BY due_date ASC
           LIMIT 8""",
        {"uid": user_id, "soon": soon},
    )
    if df_urgent.empty:
        st.success("近期没有紧急任务，继续加油！")
    else:
        type_icons = {"homework": "📝", "exam": "📌", "lab": "🔬",
                      "paper": "📄", "quiz": "✏️", "other": "📋"}
        for _, row in df_urgent.iterrows():
            due = pd.to_datetime(row["due_date"])
            hours_left = (due - pd.Timestamp.now()).total_seconds() / 3600
            if hours_left < 24:
                badge_color, badge = "#FF4D4F", "今日截止"
            elif hours_left < 72:
                badge_color, badge = "#FF7D00", "3天内"
            else:
                badge_color, badge = "#165DFF", "本周内"
            icon = type_icons.get(row.get("type", "other"), "📋")
            st.markdown(f"""
                <div style='display:flex;justify-content:space-between;align-items:center;
                            padding:9px 14px;background:#fff;border-radius:8px;
                            margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,0.06)'>
                    <div>
                        <span style='font-weight:600'>{icon} {row['name']}</span>
                        <span style='color:#888;font-size:12px;margin-left:8px'>
                            {row['course_name'] or ''}
                        </span>
                    </div>
                    <span style='background:{badge_color};color:#fff;border-radius:4px;
                                 padding:2px 8px;font-size:12px'>{badge}</span>
                </div>
            """, unsafe_allow_html=True)

st.divider()

# ── 第三行：近 14 天打卡趋势折线图 ───────────────────────────
st.markdown("#### 📊 近 14 天学习时长趋势")

start_14 = (today - timedelta(days=13)).strftime("%Y-%m-%d")
df_trend = run_query(
    """SELECT checkin_date, SUM(duration_minutes) AS total_minutes
       FROM checkins
       WHERE user_id = :uid AND checkin_date >= :sd
       GROUP BY checkin_date
       ORDER BY checkin_date""",
    {"uid": user_id, "sd": start_14},
)

# 生成完整 14 天日期序列（没有打卡的天数补 0）
all_dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(13, -1, -1)]
df_full = pd.DataFrame({"checkin_date": all_dates})
if not df_trend.empty:
    df_merged = df_full.merge(df_trend, on="checkin_date", how="left").fillna(0)
else:
    df_merged = df_full.assign(total_minutes=0)

df_merged["学习时长(分钟)"] = df_merged["total_minutes"].astype(int)
df_merged["日期"] = df_merged["checkin_date"]

fig = px.area(
    df_merged,
    x="日期",
    y="学习时长(分钟)",
    color_discrete_sequence=["#165DFF"],
    template="plotly_white",
)
fig.update_layout(
    height=240,
    margin=dict(l=0, r=0, t=10, b=0),
    xaxis=dict(showgrid=False, tickangle=-30),
    yaxis=dict(gridcolor="#f0f0f0"),
    showlegend=False,
)
fig.update_traces(
    fill="tozeroy",
    line_width=2,
    fillcolor="rgba(22, 93, 255, 0.12)",
)
st.plotly_chart(fig, use_container_width=True)
