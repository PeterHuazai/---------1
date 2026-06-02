"""
============================================================
页面 1 — 课程表管理
周课表可视化、添加/删除课程、一键冲突检测
============================================================
"""

import streamlit as st
import pandas as pd
import plotly.figure_factory as ff
import plotly.graph_objects as go
import uuid
from datetime import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, run_write, page_header, sidebar_nav

st.set_page_config(page_title="课程表", page_icon="📅", layout="wide")
require_login()
sidebar_nav()

user_id = st.session_state.user_id
page_header("📅 课程表管理", "查看本周课程、添加新课程并检测时间冲突")
st.divider()

DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
# 课程颜色列表（供选择）
COLOR_OPTIONS = {
    "蓝色 #165DFF": "#165DFF", "绿色 #00B96B": "#00B96B",
    "橙色 #FF7D00": "#FF7D00", "紫色 #722ED1": "#722ED1",
    "红色 #FF4D4F": "#FF4D4F", "青色 #0FC6C2": "#0FC6C2",
}

# ── 查询当前用户的所有课程 ────────────────────────────────────
def load_courses():
    return run_query(
        """SELECT id, name, day_of_week, start_time, end_time,
                  location, teacher, credits, course_type, color,
                  start_week, end_week, reminder_minutes, notes
           FROM courses WHERE user_id = :uid
           ORDER BY day_of_week, start_time""",
        {"uid": user_id},
    )

df_courses = load_courses()

# ── Tab 布局：课程表 / 添加课程 / 冲突检测 ─────────────────────
tab1, tab2, tab3 = st.tabs(["📊 周课表视图", "➕ 添加课程", "⚠️ 冲突检测"])


# ══════════════════════════════════════════════════════════════
# Tab 1：周课表甘特图可视化
# ══════════════════════════════════════════════════════════════
with tab1:
    if df_courses.empty:
        st.info("还没有添加任何课程，切换到「添加课程」标签页开始吧！")
    else:
        # 将 HH:MM 时间转换为用于绘图的日期时间字符串
        # Plotly 甘特图要求 datetime 格式，这里用 2000-01-0X（X为星期几）作为日期
        chart_data = []
        for _, row in df_courses.iterrows():
            day_idx = int(row["day_of_week"])
            # 日期：2000-01-01 为周一，2000-01-07 为周日
            base_date = f"2000-01-{day_idx + 1:02d}"
            color = row.get("color") or "#165DFF"
            chart_data.append({
                "Task":   f"{'周一二三四五六日'[day_idx]} {row['name']}",
                "Start":  f"{base_date} {row['start_time']}:00",
                "Finish": f"{base_date} {row['end_time']}:00",
                "Resource": row["name"],
                "Color":  color,
                "Label":  (
                    f"{row['name']}<br>"
                    f"{row['start_time']}–{row['end_time']}<br>"
                    f"{'📍'+str(row['location']) if row['location'] else ''}"
                ),
            })

        # 构建 Plotly 甘特条形图
        fig = go.Figure()
        day_colors = {}
        for item in chart_data:
            day_label = item["Task"][:2]
            color = item["Color"]
            fig.add_trace(go.Bar(
                name=item["Resource"],
                y=[item["Task"]],
                x=[
                    (datetime.strptime(item["Finish"], "%Y-%m-%d %H:%M:%S") -
                     datetime.strptime(item["Start"],  "%Y-%m-%d %H:%M:%S")).seconds / 3600
                ],
                base=[item["Start"][:10] + " " +
                      item["Start"][11:16]],
                orientation="h",
                marker_color=color,
                hovertext=item["Label"],
                hoverinfo="text",
                textposition="inside",
                text=item["Resource"],
            ))

        fig.update_layout(
            barmode="overlay",
            height=max(300, len(chart_data) * 45 + 80),
            margin=dict(l=0, r=0, t=10, b=0),
            xaxis=dict(
                type="date",
                tickformat="%H:%M",
                dtick=3600000,  # 1 小时间隔（毫秒）
                showgrid=True, gridcolor="#f0f0f0",
            ),
            yaxis=dict(autorange="reversed"),
            showlegend=False,
            plot_bgcolor="#fafafa",
        )
        st.plotly_chart(fig, use_container_width=True)

        # 课程列表表格
        st.markdown("#### 课程列表")
        display_df = df_courses[["name", "day_of_week", "start_time", "end_time",
                                  "teacher", "location", "credits"]].copy()
        display_df["day_of_week"] = display_df["day_of_week"].apply(
            lambda x: DAY_NAMES[int(x)] if pd.notna(x) else ""
        )
        display_df.columns = ["课程名称", "星期", "开始", "结束", "老师", "地点", "学分"]
        st.dataframe(display_df, use_container_width=True, hide_index=True)

        # 删除课程
        st.markdown("#### 删除课程")
        course_options = {f"{row['name']} ({DAY_NAMES[int(row['day_of_week'])]} {row['start_time']})": row["id"]
                          for _, row in df_courses.iterrows()}
        selected_del = st.selectbox("选择要删除的课程", options=list(course_options.keys()))
        if st.button("🗑️ 删除", type="primary"):
            ok = run_write("DELETE FROM courses WHERE id = :id AND user_id = :uid",
                           {"id": course_options[selected_del], "uid": user_id})
            if ok:
                st.success("课程已删除")
                st.rerun()


# ══════════════════════════════════════════════════════════════
# Tab 2：添加课程表单
# ══════════════════════════════════════════════════════════════
with tab2:
    with st.form("add_course_form"):
        st.markdown("##### 基本信息")
        col1, col2 = st.columns(2)
        with col1:
            name         = st.text_input("课程名称 *", placeholder="如：数据结构")
            day_of_week  = st.selectbox("星期 *", options=range(7), format_func=lambda x: DAY_NAMES[x])
            start_time   = st.time_input("开始时间 *", value=datetime.strptime("08:00", "%H:%M").time())
            end_time     = st.time_input("结束时间 *", value=datetime.strptime("09:40", "%H:%M").time())
        with col2:
            teacher      = st.text_input("任课老师", placeholder="如：张老师")
            location     = st.text_input("上课地点", placeholder="如：教学楼A-301")
            credits      = st.number_input("学分", min_value=0.0, max_value=10.0, value=2.0, step=0.5)
            course_type  = st.selectbox("课程类型", ["必修", "选修", "通识", "实践", "其他"])

        st.markdown("##### 周次与提醒")
        col3, col4, col5 = st.columns(3)
        with col3:
            start_week = st.number_input("起始周次", min_value=1, max_value=25, value=1)
        with col4:
            end_week   = st.number_input("结束周次", min_value=1, max_value=25, value=16)
        with col5:
            color_name = st.selectbox("课程颜色", options=list(COLOR_OPTIONS.keys()))

        reminder_min = st.select_slider(
            "上课提醒提前时间",
            options=[0, 10, 15, 30, 60],
            value=15,
            format_func=lambda x: f"提前 {x} 分钟" if x > 0 else "不提醒",
        )
        notes = st.text_area("备注", placeholder="可填写课程要求、参考书目等")

        submitted = st.form_submit_button("✅ 添加课程", use_container_width=True)

    if submitted:
        if not name:
            st.error("请填写课程名称")
        elif start_time >= end_time:
            st.error("开始时间必须早于结束时间")
        else:
            course_id = str(uuid.uuid4())
            ok = run_write(
                """INSERT INTO courses
                   (id, user_id, name, day_of_week, start_time, end_time,
                    teacher, location, credits, course_type, color,
                    start_week, end_week, reminder_minutes, notes)
                   VALUES
                   (:id, :uid, :name, :dow, :st, :et,
                    :teacher, :loc, :credits, :ctype, :color,
                    :sw, :ew, :rm, :notes)""",
                {
                    "id": course_id, "uid": user_id, "name": name,
                    "dow": day_of_week,
                    "st":  start_time.strftime("%H:%M"),
                    "et":  end_time.strftime("%H:%M"),
                    "teacher": teacher or None, "loc": location or None,
                    "credits": credits, "ctype": course_type,
                    "color": COLOR_OPTIONS[color_name],
                    "sw": start_week, "ew": end_week,
                    "rm": reminder_min, "notes": notes or None,
                },
            )
            if ok:
                st.success(f"✅ 课程「{name}」添加成功！")
                st.rerun()


# ══════════════════════════════════════════════════════════════
# Tab 3：时间冲突检测
# ══════════════════════════════════════════════════════════════
with tab3:
    st.markdown("点击下方按钮，检测您的课程是否存在时间冲突。")
    if st.button("🔍 开始检测全部课程", type="primary", use_container_width=True):
        if df_courses.empty:
            st.info("您还没有添加任何课程")
        else:
            conflicts = []
            courses_list = df_courses.to_dict("records")

            # 两两比较检测冲突（O(n²) 算法，课程数量少时性能足够）
            for i in range(len(courses_list)):
                for j in range(i + 1, len(courses_list)):
                    ca, cb = courses_list[i], courses_list[j]
                    # 不同天不冲突
                    if ca["day_of_week"] != cb["day_of_week"]:
                        continue
                    # 周次检测
                    sw_a = ca.get("start_week") or 1
                    ew_a = ca.get("end_week")   or 25
                    sw_b = cb.get("start_week") or 1
                    ew_b = cb.get("end_week")   or 25
                    if not (sw_a <= ew_b and sw_b <= ew_a):
                        continue  # 周次不重叠
                    # 时间重叠检测：转换为分钟数比较
                    def t2m(t): h, m = t.split(":"); return int(h)*60+int(m)
                    if t2m(ca["start_time"]) < t2m(cb["end_time"]) and \
                       t2m(cb["start_time"]) < t2m(ca["end_time"]):
                        conflicts.append({
                            "课程A": ca["name"],
                            "课程B": cb["name"],
                            "星期": DAY_NAMES[int(ca["day_of_week"])],
                            "课程A时间": f"{ca['start_time']}–{ca['end_time']}",
                            "课程B时间": f"{cb['start_time']}–{cb['end_time']}",
                        })

            if conflicts:
                st.error(f"⚠️ 检测到 {len(conflicts)} 处时间冲突！")
                st.dataframe(pd.DataFrame(conflicts), use_container_width=True, hide_index=True)
            else:
                st.success("✅ 未发现任何课程时间冲突，课表安排合理！")
                st.balloons()
