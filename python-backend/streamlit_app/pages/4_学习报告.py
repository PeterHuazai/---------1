"""
============================================================
页面 4 — 学习报告
周报/月报数据统计，使用多种 Plotly 图表可视化学习情况
============================================================
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import date, timedelta
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, page_header, sidebar_nav

st.set_page_config(page_title="学习报告", page_icon="📈", layout="wide")
require_login()
sidebar_nav()

user_id = st.session_state.user_id
page_header("📈 学习报告", "分析学习时长、打卡频率和课程分布")
st.divider()

# ── 选择报告周期 ──────────────────────────────────────────────
col_period, col_blank = st.columns([2, 6])
with col_period:
    period = st.selectbox("报告周期", ["本周", "本月", "近30天", "近90天"])

today = date.today()
if period == "本周":
    start = today - timedelta(days=today.weekday())
elif period == "本月":
    start = today.replace(day=1)
elif period == "近30天":
    start = today - timedelta(days=29)
else:   # 近90天
    start = today - timedelta(days=89)
end   = today
start_str = start.strftime("%Y-%m-%d")
end_str   = end.strftime("%Y-%m-%d")

# ── 查询数据 ──────────────────────────────────────────────────
# 每天的学习时长
df_daily = run_query(
    """SELECT checkin_date, SUM(duration_minutes) AS total_min, COUNT(*) AS checkins
       FROM checkins
       WHERE user_id = :uid AND checkin_date BETWEEN :s AND :e
       GROUP BY checkin_date
       ORDER BY checkin_date""",
    {"uid": user_id, "s": start_str, "e": end_str},
)

# 按目标分类统计
df_by_goal = run_query(
    """SELECT g.name AS goal_name, g.category,
              COUNT(c.id) AS checkin_cnt,
              COALESCE(SUM(c.duration_minutes), 0) AS total_min
       FROM goals g
       LEFT JOIN checkins c ON g.id = c.goal_id
           AND c.checkin_date BETWEEN :s AND :e
       WHERE g.user_id = :uid
       GROUP BY g.id, g.name, g.category""",
    {"uid": user_id, "s": start_str, "e": end_str},
)

# 任务完成情况
df_tasks = run_query(
    """SELECT type, status, COUNT(*) AS cnt
       FROM tasks
       WHERE user_id = :uid AND updated_at >= :s
       GROUP BY type, status""",
    {"uid": user_id, "s": start_str},
)

# 课程分布统计（学分）
df_course_credits = run_query(
    """SELECT course_type, SUM(credits) AS total_credits, COUNT(*) AS cnt
       FROM courses
       WHERE user_id = :uid
       GROUP BY course_type""",
    {"uid": user_id},
)

# ── 核心指标卡片 ──────────────────────────────────────────────
total_days    = len(pd.date_range(start, end, freq="D"))
checkin_days  = len(df_daily) if not df_daily.empty else 0
total_minutes = int(df_daily["total_min"].sum()) if not df_daily.empty else 0
avg_minutes   = round(total_minutes / max(checkin_days, 1))

c1, c2, c3, c4 = st.columns(4)
c1.metric("📅 统计天数",  f"{total_days} 天")
c2.metric("✅ 打卡天数",  f"{checkin_days} 天", f"出勤率 {int(checkin_days/total_days*100)}%")
c3.metric("⏱️ 累计学习",  f"{round(total_minutes/60,1)} 小时")
c4.metric("📊 日均时长",  f"{avg_minutes} 分钟")

st.divider()

# ── 图表区域 ──────────────────────────────────────────────────
row1_left, row1_right = st.columns([2, 1], gap="large")

# 左：每日学习时长柱状图 + 折线趋势
with row1_left:
    st.markdown("#### 📊 每日学习时长")
    if df_daily.empty:
        st.info(f"{period}内没有打卡记录")
    else:
        # 补全缺失日期
        all_dates = [str(d.date()) for d in pd.date_range(start, end, freq="D")]
        df_full = pd.DataFrame({"checkin_date": all_dates})
        df_merged = df_full.merge(df_daily, on="checkin_date", how="left").fillna(0)
        df_merged["checkin_date"] = pd.to_datetime(df_merged["checkin_date"])
        df_merged["total_min"] = df_merged["total_min"].astype(int)

        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(go.Bar(
            x=df_merged["checkin_date"],
            y=df_merged["total_min"],
            name="学习时长（分钟）",
            marker_color="#165DFF",
            opacity=0.8,
        ))
        # 7日移动平均线
        df_merged["ma7"] = df_merged["total_min"].rolling(7, min_periods=1).mean()
        fig.add_trace(go.Scatter(
            x=df_merged["checkin_date"],
            y=df_merged["ma7"],
            name="7日均线",
            line=dict(color="#FF7D00", width=2, dash="dash"),
        ))
        fig.update_layout(
            height=280,
            margin=dict(l=0, r=0, t=10, b=0),
            legend=dict(orientation="h", y=1.1),
            plot_bgcolor="#fafafa",
            barmode="overlay",
        )
        st.plotly_chart(fig, use_container_width=True)

# 右：学习目标分类饼图
with row1_right:
    st.markdown("#### 🎯 目标分类时长")
    if df_by_goal.empty or df_by_goal["total_min"].sum() == 0:
        st.info("暂无数据")
    else:
        df_pie = df_by_goal[df_by_goal["total_min"] > 0].copy()
        fig = px.pie(
            df_pie,
            values="total_min",
            names="category",
            color_discrete_sequence=["#165DFF","#00B96B","#FF7D00","#722ED1","#FF4D4F","#0FC6C2"],
            hole=0.4,
        )
        fig.update_layout(
            height=280,
            margin=dict(l=0, r=0, t=10, b=10),
            showlegend=True,
            legend=dict(orientation="h", y=-0.1),
        )
        fig.update_traces(textinfo="percent+label", textfont_size=12)
        st.plotly_chart(fig, use_container_width=True)

# ── 第二行图表 ────────────────────────────────────────────────
row2_left, row2_right = st.columns([1, 1], gap="large")

# 左：各目标打卡次数横向柱状图
with row2_left:
    st.markdown("#### 📋 各目标打卡次数")
    if df_by_goal.empty or df_by_goal["checkin_cnt"].sum() == 0:
        st.info("暂无打卡记录")
    else:
        df_bar = df_by_goal[df_by_goal["checkin_cnt"] > 0].sort_values("checkin_cnt", ascending=True)
        fig = px.bar(
            df_bar,
            x="checkin_cnt",
            y="goal_name",
            orientation="h",
            color="checkin_cnt",
            color_continuous_scale=["#c6e48b", "#196127"],
            labels={"checkin_cnt": "打卡次数", "goal_name": ""},
            text="checkin_cnt",
        )
        fig.update_layout(
            height=250,
            margin=dict(l=0, r=0, t=10, b=0),
            coloraxis_showscale=False,
            plot_bgcolor="#fafafa",
        )
        fig.update_traces(textposition="outside")
        st.plotly_chart(fig, use_container_width=True)

# 右：任务状态分布图
with row2_right:
    st.markdown("#### ✅ 任务完成状态")
    if df_tasks.empty:
        st.info("暂无任务数据")
    else:
        status_summary = df_tasks.groupby("status")["cnt"].sum().reset_index()
        status_labels  = {"pending":"待开始","in_progress":"进行中","done":"已完成","expired":"已过期"}
        status_colors  = {"pending":"#FF7D00","in_progress":"#165DFF","done":"#00B96B","expired":"#888"}
        status_summary["status_label"] = status_summary["status"].map(status_labels)
        status_summary["color"] = status_summary["status"].map(status_colors)

        fig = go.Figure(go.Pie(
            labels=status_summary["status_label"],
            values=status_summary["cnt"],
            marker=dict(colors=status_summary["color"].tolist()),
            hole=0.4,
            textinfo="percent+label",
        ))
        fig.update_layout(
            height=250,
            margin=dict(l=0, r=0, t=10, b=10),
            showlegend=False,
        )
        st.plotly_chart(fig, use_container_width=True)

# ── 课程学分统计 ──────────────────────────────────────────────
if not df_course_credits.empty:
    st.divider()
    st.markdown("#### 📚 课程学分分布")
    fig = px.bar(
        df_course_credits,
        x="course_type",
        y="total_credits",
        color="course_type",
        labels={"course_type": "课程类型", "total_credits": "总学分"},
        text="total_credits",
        color_discrete_sequence=["#165DFF","#00B96B","#FF7D00","#722ED1","#FF4D4F"],
    )
    fig.update_layout(
        height=200,
        margin=dict(l=0, r=0, t=10, b=0),
        showlegend=False,
        plot_bgcolor="#fafafa",
    )
    fig.update_traces(textposition="outside")
    st.plotly_chart(fig, use_container_width=True)
