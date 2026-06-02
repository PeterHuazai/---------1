"""
============================================================
页面 7 — 管理员控制台
用户封禁管理、关键词黑白名单管理、联系消息查看与回复
仅管理员角色可正常使用（普通用户看到权限提示）
============================================================
"""

import streamlit as st
import pandas as pd
from datetime import date, datetime, timedelta
import uuid, sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, run_write, page_header, sidebar_nav

st.set_page_config(page_title="管理员控制台", page_icon="🛡️", layout="wide")
require_login()
sidebar_nav()

# ── 权限检查 ──────────────────────────────────────────────────
user_id = st.session_state.user_id
df_role = run_query("SELECT role FROM users WHERE id = :uid", {"uid": user_id})
is_admin = (
    not df_role.empty and str(df_role["role"].iloc[0]).strip().lower() == "admin"
)

page_header("🛡️ 管理员控制台", "用户封禁 · 关键词过滤 · 联系消息管理")
st.divider()

if not is_admin:
    st.error("⛔ 您没有访问此页面的权限，该页面仅限管理员使用。")
    st.stop()

# ══════════════════════════════════════════════════════════════
# Tab 布局
# ══════════════════════════════════════════════════════════════
tab_users, tab_ban, tab_keywords, tab_messages = st.tabs([
    "👥 用户列表",
    "🚫 封禁管理",
    "🔍 关键词过滤",
    "📬 联系消息",
])


# ══════════════════════════════════════════════════════════════
# Tab 1 — 用户列表
# ══════════════════════════════════════════════════════════════
with tab_users:
    st.markdown("#### 所有注册用户")

    col_search, col_filter = st.columns([3, 1])
    with col_search:
        kw = st.text_input("搜索用户名/姓名/邮箱", placeholder="输入关键字...")
    with col_filter:
        ban_filter = st.selectbox("封禁状态", ["全部", "正常", "已封禁"])

    # 构建查询
    sql = """
        SELECT id, username, full_name, email, role, is_active,
               banned_until, ban_reason, created_at
        FROM users
        WHERE 1=1
    """
    params: dict = {}
    if kw:
        sql += " AND (username LIKE :kw OR full_name LIKE :kw OR email LIKE :kw)"
        params["kw"] = f"%{kw}%"

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    if ban_filter == "已封禁":
        sql += f" AND banned_until IS NOT NULL AND banned_until > '{now_str}'"
    elif ban_filter == "正常":
        sql += f" AND (banned_until IS NULL OR banned_until <= '{now_str}')"

    sql += " ORDER BY created_at DESC LIMIT 200"

    df_users = run_query(sql, params)

    if df_users.empty:
        st.info("暂无用户数据")
    else:
        # 添加封禁状态列
        def ban_status(row):
            if row["banned_until"] and str(row["banned_until"]) > now_str:
                return f"🚫 封禁至 {str(row['banned_until'])[:10]}"
            return "✅ 正常"

        df_users["状态"] = df_users.apply(ban_status, axis=1)

        display_cols = {
            "username":  "用户名",
            "full_name": "姓名",
            "email":     "邮箱",
            "role":      "角色",
            "状态":      "账号状态",
            "created_at": "注册时间",
        }
        df_show = df_users[list(display_cols.keys())].rename(columns=display_cols)
        st.dataframe(df_show, use_container_width=True, hide_index=True)
        st.caption(f"共 {len(df_users)} 名用户")


# ══════════════════════════════════════════════════════════════
# Tab 2 — 封禁管理
# ══════════════════════════════════════════════════════════════
with tab_ban:
    col_ban, col_unban = st.columns(2, gap="large")

    # ── 封禁用户 ──────────────────────────────────────────────
    with col_ban:
        st.markdown("#### 🚫 封禁用户")
        with st.form("ban_form", clear_on_submit=True):
            target_user = st.text_input("用户名 *", placeholder="要封禁的用户名")
            ban_days = st.number_input(
                "封禁天数（0 = 永久）", min_value=0, max_value=365, value=7
            )
            ban_reason = st.text_input("封禁原因", placeholder="选填，如：发布违规内容")
            submitted_ban = st.form_submit_button("🚫 执行封禁", type="primary", use_container_width=True)

        if submitted_ban:
            if not target_user.strip():
                st.error("请输入用户名")
            else:
                df_t = run_query(
                    "SELECT id, username, role FROM users WHERE username = :u",
                    {"u": target_user.strip()},
                )
                if df_t.empty:
                    st.error(f"用户 '{target_user}' 不存在")
                elif df_t.iloc[0]["id"] == user_id:
                    st.error("不能封禁自己")
                elif str(df_t.iloc[0]["role"]).lower() == "admin":
                    st.error("不能封禁其他管理员")
                else:
                    tid = df_t.iloc[0]["id"]
                    if ban_days == 0:
                        # 永久封禁
                        until = "9999-12-31 00:00:00"
                        label = "永久"
                    else:
                        until = (datetime.utcnow() + timedelta(days=ban_days)).strftime("%Y-%m-%d %H:%M:%S")
                        label = f"{ban_days} 天"

                    ok = run_write(
                        """UPDATE users
                           SET banned_until = :until, ban_reason = :reason
                           WHERE id = :tid""",
                        {"until": until, "reason": ban_reason or "违规行为", "tid": tid},
                    )
                    if ok:
                        st.success(f"✅ 已封禁用户 {target_user}（{label}）")
                    else:
                        st.error("操作失败，请重试")

    # ── 解封用户 ──────────────────────────────────────────────
    with col_unban:
        st.markdown("#### ✅ 解封用户")

        # 当前被封禁的用户列表
        df_banned = run_query(
            f"""SELECT id, username, full_name, banned_until, ban_reason
                FROM users
                WHERE banned_until IS NOT NULL AND banned_until > '{now_str}'
                ORDER BY banned_until ASC""",
        )
        if df_banned.empty:
            st.info("当前没有被封禁的用户")
        else:
            st.markdown(f"当前封禁用户：**{len(df_banned)}** 人")
            for _, row in df_banned.iterrows():
                with st.container():
                    c1, c2 = st.columns([3, 1])
                    with c1:
                        until_str = str(row["banned_until"])[:16]
                        reason    = row["ban_reason"] or "无"
                        st.markdown(
                            f"**{row['username']}** "
                            f"（{row['full_name'] or '无姓名'}）  \n"
                            f"🔒 封禁至 `{until_str}`  原因：{reason}"
                        )
                    with c2:
                        if st.button("解封", key=f"unban_{row['id']}", type="secondary"):
                            run_write(
                                "UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = :tid",
                                {"tid": row["id"]},
                            )
                            st.success(f"已解封 {row['username']}")
                            st.rerun()
                    st.divider()


# ══════════════════════════════════════════════════════════════
# Tab 3 — 关键词过滤
# ══════════════════════════════════════════════════════════════
with tab_keywords:
    kw_col_left, kw_col_right = st.columns([2, 3], gap="large")

    # ── 添加关键词 ────────────────────────────────────────────
    with kw_col_left:
        st.markdown("#### ➕ 添加关键词")

        with st.form("add_keyword_form", clear_on_submit=True):
            new_kw    = st.text_input("关键词 *", placeholder="如：广告、违禁词等")
            kw_type   = st.radio("类型", ["blacklist（黑名单）", "whitelist（白名单）"],
                                  help="黑名单：含此词则拦截 / 白名单：含此词则豁免黑名单")
            list_type = "blacklist" if "blacklist" in kw_type else "whitelist"
            add_btn   = st.form_submit_button("➕ 添加", type="primary", use_container_width=True)

        if add_btn:
            kw_clean = new_kw.strip().lower()
            if not kw_clean:
                st.error("关键词不能为空")
            else:
                dup = run_query(
                    "SELECT id FROM keyword_filters WHERE keyword = :kw AND list_type = :lt",
                    {"kw": kw_clean, "lt": list_type},
                )
                if not dup.empty:
                    st.warning(f"'{kw_clean}' 在{list_type}中已存在")
                else:
                    ok = run_write(
                        """INSERT INTO keyword_filters (id, keyword, list_type, created_by)
                           VALUES (:id, :kw, :lt, :cb)""",
                        {"id": str(uuid.uuid4()), "kw": kw_clean,
                         "lt": list_type, "cb": user_id},
                    )
                    if ok:
                        st.success(f"✅ 已添加 '{kw_clean}' 到 {list_type}")
                        st.rerun()

        st.markdown("#### 📂 批量导入（CSV）")
        uploaded = st.file_uploader(
            "上传 CSV 文件（每行一个关键词，第一列为词，第二列可选类型）",
            type=["csv", "txt"],
        )
        batch_type = st.selectbox("批量导入类型", ["blacklist", "whitelist"])
        if uploaded and st.button("📥 开始导入", use_container_width=True):
            try:
                import io
                content = uploaded.read().decode("utf-8")
                lines   = [l.strip() for l in content.splitlines() if l.strip()]
                added = skipped = 0
                for line in lines:
                    parts   = line.split(",")
                    kw_val  = parts[0].strip().lower()
                    lt_val  = parts[1].strip() if len(parts) > 1 and parts[1].strip() in ("blacklist", "whitelist") else batch_type
                    if not kw_val:
                        continue
                    dup = run_query(
                        "SELECT id FROM keyword_filters WHERE keyword=:kw AND list_type=:lt",
                        {"kw": kw_val, "lt": lt_val},
                    )
                    if not dup.empty:
                        skipped += 1
                        continue
                    run_write(
                        "INSERT INTO keyword_filters (id,keyword,list_type,created_by) VALUES (:id,:kw,:lt,:cb)",
                        {"id": str(uuid.uuid4()), "kw": kw_val, "lt": lt_val, "cb": user_id},
                    )
                    added += 1
                st.success(f"✅ 导入完成：成功 {added} 个，重复跳过 {skipped} 个")
                st.rerun()
            except Exception as e:
                st.error(f"导入失败：{e}")

    # ── 关键词列表 ────────────────────────────────────────────
    with kw_col_right:
        st.markdown("#### 📋 关键词列表")

        kw_filter_type = st.selectbox("筛选类型", ["全部", "blacklist（黑名单）", "whitelist（白名单）"],
                                       key="kw_filter")
        filter_sql     = ""
        if "blacklist" in kw_filter_type:
            filter_sql = " AND list_type = 'blacklist'"
        elif "whitelist" in kw_filter_type:
            filter_sql = " AND list_type = 'whitelist'"

        df_kw = run_query(
            f"""SELECT id, keyword, list_type, created_at
                FROM keyword_filters
                WHERE 1=1 {filter_sql}
                ORDER BY list_type, created_at DESC
                LIMIT 300""",
        )

        if df_kw.empty:
            st.info("暂无关键词，请先添加")
        else:
            # 统计
            bl_cnt = len(df_kw[df_kw["list_type"] == "blacklist"])
            wl_cnt = len(df_kw[df_kw["list_type"] == "whitelist"])
            c1, c2 = st.columns(2)
            c1.metric("🚫 黑名单", f"{bl_cnt} 个")
            c2.metric("✅ 白名单", f"{wl_cnt} 个")

            for _, row in df_kw.iterrows():
                col_kw, col_type, col_del = st.columns([4, 2, 1])
                with col_kw:
                    st.markdown(f"`{row['keyword']}`")
                with col_type:
                    color = "#FF4D4F" if row["list_type"] == "blacklist" else "#00B96B"
                    label = "🚫 黑名单" if row["list_type"] == "blacklist" else "✅ 白名单"
                    st.markdown(
                        f"<span style='color:{color};font-size:13px'>{label}</span>",
                        unsafe_allow_html=True,
                    )
                with col_del:
                    if st.button("删除", key=f"del_kw_{row['id']}", type="secondary"):
                        run_write("DELETE FROM keyword_filters WHERE id = :id", {"id": row["id"]})
                        st.rerun()


# ══════════════════════════════════════════════════════════════
# Tab 4 — 联系消息
# ══════════════════════════════════════════════════════════════
with tab_messages:
    # 统计未读数
    df_unread_cnt = run_query(
        "SELECT COUNT(*) AS cnt FROM contact_messages WHERE is_read = 0",
    )
    unread_cnt = int(df_unread_cnt["cnt"].iloc[0]) if not df_unread_cnt.empty else 0

    if unread_cnt > 0:
        st.warning(f"📬 您有 **{unread_cnt}** 条未读联系消息")

    msg_filter = st.selectbox("筛选", ["全部消息", "仅未读", "仅已回复"])
    filter_cond = ""
    if msg_filter == "仅未读":
        filter_cond = " AND is_read = 0"
    elif msg_filter == "仅已回复":
        filter_cond = " AND reply IS NOT NULL"

    df_msgs = run_query(
        f"""SELECT cm.id, u.username, u.full_name, cm.subject, cm.content,
                   cm.is_read, cm.reply, cm.replied_at, cm.created_at
            FROM contact_messages cm
            LEFT JOIN users u ON cm.user_id = u.id
            WHERE 1=1 {filter_cond}
            ORDER BY cm.created_at DESC
            LIMIT 100""",
    )

    if df_msgs.empty:
        st.info("暂无联系消息")
    else:
        for _, row in df_msgs.iterrows():
            sender   = f"{row['full_name'] or ''} (@{row['username']})"
            read_tag = "" if row["is_read"] else "🔴 "
            with st.expander(f"{read_tag}{row['subject']} — {sender} · {str(row['created_at'])[:16]}"):
                st.markdown(f"**发件人**：{sender}")
                st.markdown(f"**时间**：{str(row['created_at'])[:19]}")
                st.markdown("**内容**：")
                st.info(row["content"])

                if row["reply"]:
                    st.success(f"✅ 已回复（{str(row['replied_at'])[:16]}）：\n\n{row['reply']}")
                else:
                    with st.form(f"reply_form_{row['id']}", clear_on_submit=True):
                        reply_text = st.text_area("输入回复内容", key=f"rt_{row['id']}")
                        if st.form_submit_button("📤 发送回复", type="primary"):
                            if not reply_text.strip():
                                st.error("回复内容不能为空")
                            else:
                                now_ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
                                ok = run_write(
                                    """UPDATE contact_messages
                                       SET reply=:reply, replied_at=:ts, is_read=1
                                       WHERE id=:mid""",
                                    {"reply": reply_text.strip(), "ts": now_ts, "mid": row["id"]},
                                )
                                if ok:
                                    # 写站内通知
                                    run_write(
                                        """INSERT INTO notifications
                                           (id, user_id, title, content, type)
                                           SELECT :nid, cm.user_id,
                                                  CONCAT('管理员回复了您的消息：', cm.subject),
                                                  :reply, 'system'
                                           FROM contact_messages cm WHERE cm.id = :mid""",
                                        {"nid": str(uuid.uuid4()),
                                         "reply": reply_text.strip(),
                                         "mid": row["id"]},
                                    )
                                    st.success("✅ 回复成功，已通知用户")
                                    st.rerun()

                # 标记已读按钮（对未读消息显示）
                if not row["is_read"]:
                    if st.button("✓ 标记已读", key=f"read_{row['id']}"):
                        run_write(
                            "UPDATE contact_messages SET is_read=1 WHERE id=:mid",
                            {"mid": row["id"]},
                        )
                        st.rerun()
