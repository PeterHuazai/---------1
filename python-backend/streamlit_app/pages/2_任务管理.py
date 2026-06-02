"""
============================================================
页面 2 — 任务管理
作业/考试/实验报告的增删改查和状态跟踪
============================================================
"""

import streamlit as st
import pandas as pd
import uuid
from datetime import datetime, date, timedelta
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, run_write, page_header, sidebar_nav

st.set_page_config(page_title="任务管理", page_icon="✅", layout="wide")
require_login()
sidebar_nav()

user_id = st.session_state.user_id
page_header("✅ 任务管理", "管理作业、考试、实验报告等学习任务")
st.divider()

# 任务类型映射
TYPE_MAP   = {"homework":"📝 作业","exam":"📌 考试","lab":"🔬 实验","paper":"📄 论文","quiz":"✏️ 测验","other":"📋 其他"}
STATUS_MAP = {"pending":"⏳ 待开始","in_progress":"🔄 进行中","done":"✅ 已完成","expired":"⌛ 已过期"}
STATUS_COLOR= {"pending":"#FF7D00","in_progress":"#165DFF","done":"#00B96B","expired":"#888"}

# ── 侧边栏筛选器 ──────────────────────────────────────────────
with st.sidebar:
    st.markdown("#### 🔍 筛选")
    filter_status = st.multiselect(
        "状态",
        options=list(STATUS_MAP.keys()),
        default=["pending", "in_progress"],
        format_func=lambda x: STATUS_MAP[x],
    )
    filter_type = st.multiselect(
        "类型",
        options=list(TYPE_MAP.keys()),
        default=[],
        format_func=lambda x: TYPE_MAP[x],
    )

# ── 构建查询条件 ──────────────────────────────────────────────
where_clauses = ["user_id = :uid"]
params = {"uid": user_id}

if filter_status:
    placeholders = ", ".join([f":s{i}" for i in range(len(filter_status))])
    where_clauses.append(f"status IN ({placeholders})")
    for i, s in enumerate(filter_status):
        params[f"s{i}"] = s
if filter_type:
    placeholders = ", ".join([f":t{i}" for i in range(len(filter_type))])
    where_clauses.append(f"type IN ({placeholders})")
    for i, t in enumerate(filter_type):
        params[f"t{i}"] = t

where_sql = " AND ".join(where_clauses)

# 查询任务列表，截止时间升序
df_tasks = run_query(
    f"""SELECT id, name, type, course_name, due_date, status, weight, submit_method, notes
        FROM tasks WHERE {where_sql}
        ORDER BY due_date ASC""",
    params,
)

# 自动将截止时间已过且状态非done的任务标记为expired
if not df_tasks.empty:
    now = datetime.now()
    for idx, row in df_tasks.iterrows():
        if row["status"] in ("pending", "in_progress"):
            try:
                due = pd.to_datetime(row["due_date"])
                if due < pd.Timestamp(now):
                    run_write("UPDATE tasks SET status='expired' WHERE id=:id", {"id": row["id"]})
                    df_tasks.at[idx, "status"] = "expired"
            except Exception:
                pass

# ══════════════════════════════════════════════════════════════
# 主区域：任务列表 + 操作
# ══════════════════════════════════════════════════════════════
tab_list, tab_add = st.tabs(["📋 任务列表", "➕ 新建任务"])

with tab_list:
    if df_tasks.empty:
        st.info("没有符合筛选条件的任务")
    else:
        # 每行显示一个任务卡片
        for _, row in df_tasks.iterrows():
            due  = pd.to_datetime(row["due_date"])
            now  = pd.Timestamp.now()
            hrs  = (due - now).total_seconds() / 3600
            status = row["status"]
            color  = STATUS_COLOR.get(status, "#888")

            # 紧急程度标签
            if status == "done":
                urgency_html = ""
            elif status == "expired":
                urgency_html = "<span style='background:#888;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px'>已过期</span>"
            elif hrs <= 24:
                urgency_html = "<span style='background:#FF4D4F;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px'>今日截止</span>"
            elif hrs <= 72:
                urgency_html = "<span style='background:#FF7D00;color:#fff;border-radius:4px;padding:2px 8px;font-size:12px'>3天内</span>"
            else:
                urgency_html = ""

            with st.container():
                col_info, col_action = st.columns([4, 1])
                with col_info:
                    st.markdown(f"""
                        <div style='padding:12px 16px;background:#fff;border-radius:10px;
                                    border-left:4px solid {color};
                                    box-shadow:0 1px 5px rgba(0,0,0,0.06);margin-bottom:8px'>
                            <div style='display:flex;justify-content:space-between;align-items:center'>
                                <span style='font-weight:600;font-size:15px'>
                                    {TYPE_MAP.get(row['type'],'📋')} {row['name']}
                                </span>
                                {urgency_html}
                            </div>
                            <div style='color:#888;font-size:12px;margin-top:6px'>
                                {'📚 ' + str(row['course_name']) + '　' if row['course_name'] else ''}
                                ⏰ 截止：{due.strftime('%m月%d日 %H:%M')}
                                {'　权重：' + str(row['weight']) + '%' if row['weight'] else ''}
                            </div>
                        </div>
                    """, unsafe_allow_html=True)

                with col_action:
                    # 状态切换按钮
                    if status == "pending":
                        if st.button("▶ 开始", key=f"start_{row['id']}", use_container_width=True):
                            run_write("UPDATE tasks SET status='in_progress' WHERE id=:id", {"id": row["id"]})
                            st.rerun()
                    elif status == "in_progress":
                        if st.button("✅ 完成", key=f"done_{row['id']}", use_container_width=True, type="primary"):
                            run_write("UPDATE tasks SET status='done' WHERE id=:id", {"id": row["id"]})
                            st.rerun()
                    elif status == "done":
                        if st.button("↩ 撤销", key=f"undo_{row['id']}", use_container_width=True):
                            run_write("UPDATE tasks SET status='pending' WHERE id=:id", {"id": row["id"]})
                            st.rerun()

                    # 删除按钮
                    if st.button("🗑️", key=f"del_{row['id']}", use_container_width=True):
                        run_write("DELETE FROM tasks WHERE id=:id AND user_id=:uid",
                                  {"id": row["id"], "uid": user_id})
                        st.rerun()

        # 完成统计
        st.divider()
        total = len(df_tasks)
        done_count = (df_tasks["status"] == "done").sum()
        st.markdown(f"**共 {total} 项任务，已完成 {done_count} 项（{int(done_count/max(total,1)*100)}%）**")
        st.progress(int(done_count / max(total, 1) * 100))


# ══════════════════════════════════════════════════════════════
# 新建任务表单
# ══════════════════════════════════════════════════════════════
with tab_add:
    # 查询用户课程（供下拉选择）
    df_c = run_query(
        "SELECT id, name FROM courses WHERE user_id = :uid ORDER BY name",
        {"uid": user_id},
    )
    course_options = {"（不关联课程）": None}
    course_options.update({row["name"]: row["id"] for _, row in df_c.iterrows()})

    with st.form("add_task_form"):
        col1, col2 = st.columns(2)
        with col1:
            task_name  = st.text_input("任务名称 *", placeholder="如：第3章课后习题")
            task_type  = st.selectbox("任务类型", options=list(TYPE_MAP.keys()),
                                       format_func=lambda x: TYPE_MAP[x])
            course_sel = st.selectbox("关联课程", options=list(course_options.keys()))
        with col2:
            due_date   = st.date_input("截止日期 *", value=date.today() + timedelta(days=7))
            due_time   = st.time_input("截止时间", value=datetime.strptime("23:59", "%H:%M").time())
            weight     = st.number_input("成绩占比（%）", min_value=0.0, max_value=100.0, value=0.0, step=5.0)

        submit_method = st.text_input("提交方式", placeholder="如：提交到学习通 / 纸质上交")
        notes         = st.text_area("备注")

        col_r1, col_r2, col_r3 = st.columns(3)
        with col_r1: r3d = st.checkbox("截止前 3 天提醒", value=True)
        with col_r2: r1d = st.checkbox("截止前 1 天提醒", value=True)
        with col_r3: r1h = st.checkbox("截止前 1 小时提醒", value=False)

        submitted = st.form_submit_button("✅ 创建任务", use_container_width=True)

    if submitted:
        if not task_name:
            st.error("请填写任务名称")
        else:
            due_dt = datetime.combine(due_date, due_time)
            cid    = course_options[course_sel]
            cname  = course_sel if cid else None
            ok = run_write(
                """INSERT INTO tasks
                   (id, user_id, course_id, course_name, name, type, due_date,
                    submit_method, weight, notes, status, reminder_3d, reminder_1d, reminder_1h)
                   VALUES
                   (:id,:uid,:cid,:cname,:name,:type,:due,
                    :sm,:w,:notes,'pending',:r3,:r1,:r1h)""",
                {
                    "id": str(uuid.uuid4()), "uid": user_id,
                    "cid": cid, "cname": cname, "name": task_name,
                    "type": task_type, "due": due_dt,
                    "sm": submit_method or None,
                    "w": weight if weight > 0 else None,
                    "notes": notes or None,
                    "r3": int(r3d), "r1": int(r1d), "r1h": int(r1h),
                },
            )
            if ok:
                st.success(f"✅ 任务「{task_name}」已创建！")
                st.rerun()
