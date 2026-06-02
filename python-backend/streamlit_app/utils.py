"""
============================================================
Streamlit 公共工具模块
负责数据库连接、通用查询、页面样式等共享功能
============================================================
"""

import streamlit as st
import pandas as pd
from datetime import date, timedelta, datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# 将上级目录加入路径，复用 FastAPI 后端的配置和模型
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings


# ── 数据库连接（带 Streamlit 缓存，避免重复建立连接） ──────────
@st.cache_resource
def get_engine():
    """
    创建并缓存 SQLAlchemy 引擎
    @st.cache_resource 确保整个 Streamlit 会话共用同一个引擎实例
    """
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=1800,
        echo=False,
    )


def get_session():
    """创建并返回一个新的数据库会话"""
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def run_query(sql: str, params: dict = None) -> pd.DataFrame:
    """
    执行 SQL 查询并返回 DataFrame

    Args:
        sql:    SQL 语句（使用 :param 占位符）
        params: 参数字典（可选）

    Returns:
        pd.DataFrame: 查询结果，出错则返回空 DataFrame
    """
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            rows = result.fetchall()
            cols = list(result.keys())
            return pd.DataFrame(rows, columns=cols)
    except Exception as e:
        st.error(f"数据库查询失败：{e}")
        return pd.DataFrame()


def run_write(sql: str, params: dict = None) -> bool:
    """
    执行写操作（INSERT / UPDATE / DELETE）

    Args:
        sql:    SQL 语句
        params: 参数字典

    Returns:
        bool: 成功返回 True，失败返回 False
    """
    try:
        engine = get_engine()
        with engine.begin() as conn:   # begin() 自动提交事务
            conn.execute(text(sql), params or {})
        return True
    except Exception as e:
        st.error(f"数据库写入失败：{e}")
        return False


# ── 登录状态管理 ──────────────────────────────────────────────

def require_login():
    """
    检查登录状态，未登录则显示登录表单并阻止页面继续渲染

    使用 st.session_state 存储当前登录用户信息：
    - st.session_state.user_id:   用户 UUID
    - st.session_state.username:  用户名
    - st.session_state.full_name: 真实姓名
    """
    if "user_id" not in st.session_state:
        _show_login_form()
        st.stop()   # 阻止后续页面内容渲染


def _show_login_form():
    """显示登录/注册表单"""
    st.markdown("""
        <div style='text-align:center;padding:40px 0 20px'>
            <h1 style='font-size:2rem'>📚 学习管理平台</h1>
            <p style='color:#888'>请登录后使用完整功能</p>
        </div>
    """, unsafe_allow_html=True)

    tab_login, tab_reg = st.tabs(["🔑 登录", "✏️ 注册"])

    with tab_login:
        with st.form("login_form"):
            username = st.text_input("用户名")
            password = st.text_input("密码", type="password")
            submitted = st.form_submit_button("登录", use_container_width=True)
            if submitted:
                _do_login(username, password)

    with tab_reg:
        with st.form("reg_form"):
            new_user  = st.text_input("用户名（3-50位）")
            new_pass  = st.text_input("密码（至少6位）", type="password")
            full_name = st.text_input("真实姓名（可选）")
            email_addr = st.text_input("邮箱（可选，用于接收提醒）")
            submitted = st.form_submit_button("注册", use_container_width=True)
            if submitted:
                _do_register(new_user, new_pass, full_name, email_addr)


def _do_login(username: str, password: str):
    """验证用户名和密码，成功则写入 session_state"""
    import bcrypt
    if not username or not password:
        st.error("请填写用户名和密码")
        return

    df = run_query(
        "SELECT id, username, full_name, password_hash FROM users WHERE username = :u AND is_active = 1",
        {"u": username},
    )
    if df.empty:
        st.error("用户名或密码错误")
        return

    row = df.iloc[0]
    # 使用 bcrypt 验证密码哈希
    try:
        ok = bcrypt.checkpw(password.encode(), row["password_hash"].encode())
    except Exception:
        ok = False

    if not ok:
        st.error("用户名或密码错误")
        return

    # 写入会话状态
    st.session_state.user_id   = row["id"]
    st.session_state.username  = row["username"]
    st.session_state.full_name = row["full_name"] or row["username"]
    st.success(f"欢迎回来，{st.session_state.full_name}！")
    st.rerun()


def _do_register(username: str, password: str, full_name: str, email: str):
    """注册新用户"""
    import bcrypt, uuid
    if len(username) < 3:
        st.error("用户名至少 3 位")
        return
    if len(password) < 6:
        st.error("密码至少 6 位")
        return

    # 检查用户名是否已存在
    df = run_query("SELECT id FROM users WHERE username = :u", {"u": username})
    if not df.empty:
        st.error(f"用户名 '{username}' 已被占用")
        return

    # 生成 bcrypt 哈希
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    uid = str(uuid.uuid4())

    ok = run_write(
        """INSERT INTO users (id, username, password_hash, full_name, email, role, is_active)
           VALUES (:id, :u, :h, :fn, :em, 'student', 1)""",
        {"id": uid, "u": username, "h": hashed,
         "fn": full_name or None, "em": email or None},
    )
    if ok:
        st.success("注册成功！请切换到「登录」标签页登录。")


# ── 通用 UI 组件 ──────────────────────────────────────────────

def metric_card(label: str, value, delta: str = None, color: str = "#165DFF"):
    """渲染一个指标卡片"""
    delta_html = f"<p style='color:#00b96b;font-size:12px;margin:2px 0 0'>{delta}</p>" if delta else ""
    st.markdown(f"""
        <div style='background:#fff;border-radius:10px;padding:16px 20px;
                    border-left:4px solid {color};box-shadow:0 1px 6px rgba(0,0,0,0.08);
                    margin-bottom:4px'>
            <p style='color:#888;font-size:13px;margin:0'>{label}</p>
            <p style='color:#1d2129;font-size:26px;font-weight:700;margin:4px 0 0'>{value}</p>
            {delta_html}
        </div>
    """, unsafe_allow_html=True)


def page_header(title: str, subtitle: str = ""):
    """渲染页面标题"""
    st.markdown(f"""
        <div style='padding:8px 0 16px'>
            <h2 style='margin:0;color:#1d2129'>{title}</h2>
            {'<p style="color:#888;margin:4px 0 0;font-size:14px">' + subtitle + '</p>' if subtitle else ''}
        </div>
    """, unsafe_allow_html=True)


def sidebar_nav():
    """渲染侧边栏用户信息和退出按钮"""
    with st.sidebar:
        st.markdown(f"""
            <div style='padding:12px 0'>
                <p style='font-size:18px;font-weight:700;margin:0'>
                    👤 {st.session_state.get('full_name', '用户')}
                </p>
                <p style='color:#888;font-size:13px;margin:2px 0 0'>
                    @{st.session_state.get('username', '')}
                </p>
            </div>
        """, unsafe_allow_html=True)
        st.divider()
        if st.button("🚪 退出登录", use_container_width=True):
            for k in ["user_id", "username", "full_name"]:
                st.session_state.pop(k, None)
            st.rerun()
