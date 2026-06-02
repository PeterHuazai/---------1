"""
============================================================
页面 3 — 打卡计划
学习目标设置、每日打卡记录、日历热力图可视化
============================================================
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import uuid
from datetime import date, timedelta
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, run_write, page_header, sidebar_nav

st.set_page_config(page_title="打卡计划", page_icon="🎯", layout="wide")
require_login()
sidebar_nav()

user_id   = st.session_state.user_id
today_str = date.today().strftime("%Y-%m-%d")
page_header("🎯 打卡计划", "设定学习目标，每日打卡记录学习时长")
st.divider()

# ── 查询用户的学习目标 ────────────────────────────────────────
df_goals = run_query(
    """SELECT g.id, g.name, g.category, g.target_value, g.unit, g.period,
              COUNT(c.id) AS total_checkins,
              COALESCE(SUM(c.duration_minutes), 0) AS total_minutes,
              MAX(CASE WHEN c.checkin_date = :today THEN 1 ELSE 0 END) AS today_checked
       FROM goals g
       LEFT JOIN checkins c ON g.id = c.goal_id
       WHERE g.user_id = :uid AND g.is_active = 1
       GROUP BY g.id, g.name, g.category, g.target_value, g.unit, g.period""",
    {"uid": user_id, "today": today_str},
)

tab_checkin, tab_goals, tab_heatmap = st.tabs(["✅ 立即打卡", "🎯 我的目标", "🗓️ 打卡热力图"])


# ══════════════════════════════════════════════════════════════
# Tab 1：快速打卡
# ══════════════════════════════════════════════════════════════
with tab_checkin:
    if df_goals.empty:
        st.warning("您还没有设置学习目标，请先在「我的目标」中添加目标！")
    else:
        # 显示目标卡片，可点击打卡
        st.markdown("#### 选择目标，记录本次学习")
        for _, goal in df_goals.iterrows():
            already = int(goal.get("today_checked", 0)) == 1
            with st.expander(
                f"{'✅' if already else '⭕'} {goal['name']}（{goal['category']}）"
                f"  — 累计打卡 {goal['total_checkins']} 次",
                expanded=not already,
            ):
                if already:
                    st.success("今日已打卡！")

                with st.form(f"checkin_{goal['id']}"):
                    col1, col2 = st.columns(2)
                    with col1:
                        duration = st.number_input(
                            f"本次学习时长（{goal['unit']}）",
                            min_value=0, max_value=600,
                            value=int(goal["target_value"]),
                            step=5,
                        )
                        checkin_date = st.date_input(
                            "打卡日期",
                            value=date.today(),
                            key=f"date_{goal['id']}",
                        )
                    with col2:
                        notes = st.text_area("学习心得（可选）", height=100, key=f"note_{goal['id']}")

                    if st.form_submit_button("🎯 提交打卡", use_container_width=True, type="primary"):
                        ok = run_write(
                            """INSERT INTO checkins (id, goal_id, user_id, checkin_date, duration_minutes, notes)
                               VALUES (:id, :gid, :uid, :date, :dur, :notes)""",
                            {
                                "id":    str(uuid.uuid4()),
                                "gid":   goal["id"],
                                "uid":   user_id,
                                "date":  checkin_date.strftime("%Y-%m-%d"),
                                "dur":   duration,
                                "notes": notes or None,
                            },
                        )
                        if ok:
                            st.success(f"🎉 打卡成功！本次学习 {duration} {goal['unit']}")
                            st.balloons()
                            st.rerun()


# ══════════════════════════════════════════════════════════════
# Tab 2：我的目标管理
# ══════════════════════════════════════════════════════════════
with tab_goals:
    if not df_goals.empty:
        # 显示现有目标统计
        cols = st.columns(min(len(df_goals), 4))
        for idx, (_, goal) in enumerate(df_goals.iterrows()):
            with cols[idx % 4]:
                total_h = round(int(goal["total_minutes"]) / 60, 1)
                already = int(goal.get("today_checked", 0)) == 1
                st.metric(
                    label=goal["name"],
                    value=f"{goal['total_checkins']} 次",
                    delta=f"共 {total_h} 小时",
                )
                st.caption(f"{'✅ 今日已打卡' if already else '⭕ 今日未打卡'}")

    st.divider()
    st.markdown("#### 新建学习目标")
    with st.form("add_goal_form"):
        col1, col2 = st.columns(2)
        with col1:
            goal_name  = st.text_input("目标名称 *", placeholder="如：每日背50个英语单词")
            category   = st.selectbox("分类", ["学习", "专业课", "英语", "运动", "阅读", "编程", "其他"])
            period     = st.selectbox("周期", ["daily", "weekly", "monthly"],
                                       format_func=lambda x: {"daily":"每日","weekly":"每周","monthly":"每月"}[x])
        with col2:
            target_val = st.number_input("目标数值 *", min_value=1, value=60)
            unit       = st.text_input("单位", value="分钟", placeholder="分钟/次/页")
            description = st.text_area("描述（可选）", height=80)

        if st.form_submit_button("✅ 创建目标", use_container_width=True):
            if not goal_name:
                st.error("请填写目标名称")
            else:
                ok = run_write(
                    """INSERT INTO goals (id, user_id, name, description, period,
                                         target_value, unit, category, is_active)
                       VALUES (:id,:uid,:name,:desc,:period,:tv,:unit,:cat,1)""",
                    {
                        "id": str(uuid.uuid4()), "uid": user_id,
                        "name": goal_name, "desc": description or None,
                        "period": period, "tv": target_val,
                        "unit": unit, "cat": category,
                    },
                )
                if ok:
                    st.success(f"目标「{goal_name}」已创建！")
                    st.rerun()

    # 删除目标
    if not df_goals.empty:
        st.divider()
        st.markdown("#### 停用目标")
        del_opts = {row["name"]: row["id"] for _, row in df_goals.iterrows()}
        del_sel  = st.selectbox("选择要停用的目标", options=list(del_opts.keys()))
        if st.button("⏹️ 停用", type="secondary"):
            run_write("UPDATE goals SET is_active=0 WHERE id=:id AND user_id=:uid",
                      {"id": del_opts[del_sel], "uid": user_id})
            st.success("已停用")
            st.rerun()


# ══════════════════════════════════════════════════════════════
# Tab 3：打卡热力图（GitHub 风格日历图）
# ══════════════════════════════════════════════════════════════
with tab_heatmap:
    st.markdown("#### 📅 近 365 天打卡热力图")

    # 查询近 365 天每天的打卡次数
    start_365 = (date.today() - timedelta(days=364)).strftime("%Y-%m-%d")
    df_heat = run_query(
        """SELECT checkin_date, COUNT(*) AS cnt, SUM(duration_minutes) AS total_min
           FROM checkins
           WHERE user_id = :uid AND checkin_date >= :sd
           GROUP BY checkin_date""",
        {"uid": user_id, "sd": start_365},
    )

    # 构建 365 天完整日期序列
    all_dates = pd.date_range(start=start_365, end=date.today(), freq="D")
    df_full   = pd.DataFrame({"date": all_dates})
    df_full["date_str"] = df_full["date"].dt.strftime("%Y-%m-%d")

    if not df_heat.empty:
        df_heat = df_heat.rename(columns={"checkin_date": "date_str"})
        df_merged = df_full.merge(df_heat, on="date_str", how="left").fillna(0)
    else:
        df_merged = df_full.assign(cnt=0, total_min=0)

    df_merged["week"]    = df_merged["date"].dt.isocalendar().week.astype(int)
    df_merged["weekday"] = df_merged["date"].dt.weekday    # 0=周一
    df_merged["month"]   = df_merged["date"].dt.strftime("%m月")
    df_merged["cnt"]     = df_merged["cnt"].astype(int)
    df_merged["total_min"] = df_merged["total_min"].astype(int)

    # 构建热力图矩阵（行=星期，列=周次）
    # 为使周次连续，重新编号
    min_week = df_merged["week"].min()
    df_merged["week_idx"] = df_merged["week"] - min_week

    # 创建 7×N 矩阵（7天 × 周数）
    n_weeks = df_merged["week_idx"].max() + 1
    z = [[0] * n_weeks for _ in range(7)]
    text_matrix = [[""] * n_weeks for _ in range(7)]

    for _, row in df_merged.iterrows():
        wd = int(row["weekday"])
        wi = int(row["week_idx"])
        if 0 <= wd < 7 and 0 <= wi < n_weeks:
            z[wd][wi] = int(row["cnt"])
            text_matrix[wd][wi] = (
                f"{row['date_str']}<br>打卡 {int(row['cnt'])} 次<br>学习 {int(row['total_min'])} 分钟"
            )

    fig = go.Figure(go.Heatmap(
        z=z,
        text=text_matrix,
        hoverinfo="text",
        colorscale=[
            [0,   "#ebedf0"],   # 没有打卡 → 浅灰
            [0.01,"#c6e48b"],   # 打卡 1 次 → 浅绿
            [0.3, "#7bc96f"],
            [0.6, "#239a3b"],
            [1.0, "#196127"],   # 高频打卡 → 深绿
        ],
        showscale=False,
        xgap=3, ygap=3,
        zmin=0, zmax=max(df_merged["cnt"].max(), 1),
    ))

    fig.update_layout(
        height=200,
        margin=dict(l=40, r=0, t=20, b=20),
        yaxis=dict(
            tickvals=list(range(7)),
            ticktext=["周一","周二","周三","周四","周五","周六","周日"],
            showgrid=False,
        ),
        xaxis=dict(showticklabels=False, showgrid=False),
        plot_bgcolor="#fff",
        paper_bgcolor="#fff",
    )
    st.plotly_chart(fig, use_container_width=True)

    # 统计摘要
    total_days    = (df_merged["cnt"] > 0).sum()
    total_mins    = int(df_merged["total_min"].sum())
    total_checkins = int(df_merged["cnt"].sum())
    c1, c2, c3 = st.columns(3)
    c1.metric("打卡天数", f"{total_days} 天")
    c2.metric("打卡总次数", f"{total_checkins} 次")
    c3.metric("累计学习", f"{round(total_mins/60,1)} 小时")
