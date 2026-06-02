"""
============================================================
页面 6 — 邮件通知
测试邮件发送、学习报告邮件推送、历史发送记录
============================================================
"""

import streamlit as st
import smtplib, ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import date, timedelta
import sys, os, logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils import require_login, run_query, run_write, page_header, sidebar_nav

# 导入 FastAPI 后端的配置（读取 .env 中的邮箱配置）
try:
    from config import settings
    EMAIL_USER = settings.email_user
    EMAIL_PASS = settings.email_pass
    EMAIL_HOST = settings.email_host
    EMAIL_PORT = settings.email_port
except Exception:
    EMAIL_USER = os.getenv("EMAIL_USER", "")
    EMAIL_PASS = os.getenv("EMAIL_PASS", "")
    EMAIL_HOST = "smtp.163.com"
    EMAIL_PORT = 465

st.set_page_config(page_title="邮件通知", page_icon="📧", layout="wide")
require_login()
sidebar_nav()

user_id   = st.session_state.user_id
full_name = st.session_state.full_name
page_header("📧 邮件通知", "发送测试邮件、推送学习报告到您的邮箱")
st.divider()

logger = logging.getLogger(__name__)


# ── 查询用户邮箱 ──────────────────────────────────────────────
df_user = run_query(
    "SELECT email FROM users WHERE id = :uid",
    {"uid": user_id},
)
user_email = df_user["email"].iloc[0] if not df_user.empty and df_user["email"].iloc[0] else ""


# ══════════════════════════════════════════════════════════════
# 核心发送函数
# ══════════════════════════════════════════════════════════════
def send_email_smtp(to_email: str, subject: str, html_body: str) -> tuple[bool, str]:
    """
    通过 163 SMTP（SSL 465端口）发送 HTML 邮件

    Returns:
        (success, message)
    """
    if not EMAIL_USER or not EMAIL_PASS:
        return False, "未配置邮箱账号，请检查 .env 文件中的 EMAIL_USER 和 EMAIL_PASS"
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"学习管理平台 <{EMAIL_USER}>"
        msg["To"]      = to_email

        part = MIMEText(html_body, "html", "utf-8")
        msg.attach(part)

        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(EMAIL_HOST, int(EMAIL_PORT), context=ctx) as server:
            server.login(EMAIL_USER, EMAIL_PASS)
            server.sendmail(EMAIL_USER, [to_email], msg.as_string())

        return True, "发送成功"
    except smtplib.SMTPAuthenticationError:
        return False, "SMTP 认证失败！请确认 EMAIL_PASS 填写的是授权码（非登录密码）"
    except smtplib.SMTPException as e:
        return False, f"SMTP 错误：{e}"
    except Exception as e:
        return False, f"未知错误：{e}"


def log_email(to_email: str, subject: str, success: bool, msg: str):
    """将邮件发送结果写入数据库日志"""
    import uuid
    run_write(
        """INSERT INTO email_logs (id, user_id, to_email, subject, status, error_msg)
           VALUES (:id, :uid, :to, :sub, :status, :err)""",
        {
            "id":     str(uuid.uuid4()),
            "uid":    user_id,
            "to":     to_email,
            "sub":    subject,
            "status": "success" if success else "failed",
            "err":    None if success else msg,
        },
    )


# ── HTML 邮件模板 ─────────────────────────────────────────────
def build_test_html(name: str) -> str:
    return f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px">
        <div style="background:linear-gradient(135deg,#165DFF,#722ED1);color:#fff;
                    padding:32px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:24px">📚 学习管理平台</h1>
            <p style="margin:8px 0 0;opacity:0.85">邮件服务测试</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
            <p>你好，<strong>{name}</strong>！</p>
            <p>这是一封来自 <strong>大学生学习管理平台</strong> 的测试邮件。</p>
            <p>如果您能收到这封邮件，说明邮件服务配置正确，可以正常使用以下功能：</p>
            <ul>
                <li>✅ 任务截止提醒</li>
                <li>✅ 上课提前提醒</li>
                <li>✅ 周/月学习报告推送</li>
            </ul>
            <hr style="border:none;border-top:1px solid #f0f0f0">
            <p style="color:#888;font-size:12px">此邮件由系统自动发送，请勿直接回复。</p>
        </div>
    </body></html>
    """


def build_report_html(name: str, days: int, total_min: int, checkin_days: int,
                       done_tasks: int, exp_tasks: int) -> str:
    total_h = round(total_min / 60, 1)
    avg_min = round(total_min / max(checkin_days, 1))
    today   = date.today().strftime("%Y年%m月%d日")
    return f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px">
        <div style="background:linear-gradient(135deg,#165DFF,#00B96B);color:#fff;
                    padding:32px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:22px">📈 近{days}天学习报告</h1>
            <p style="margin:8px 0 0;opacity:0.85">{today}</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
            <p>你好，<strong>{name}</strong>，以下是您最近 {days} 天的学习总结：</p>
            <table style="width:100%;border-collapse:collapse">
                <tr style="background:#f5f7fa">
                    <td style="padding:12px 16px;border-radius:8px">📅 打卡天数</td>
                    <td style="padding:12px 16px;font-weight:700;color:#165DFF">{checkin_days} 天</td>
                    <td style="padding:12px 16px">出勤率 {int(checkin_days/days*100)}%</td>
                </tr>
                <tr>
                    <td style="padding:12px 16px">⏱️ 累计学习</td>
                    <td style="padding:12px 16px;font-weight:700;color:#00B96B">{total_h} 小时</td>
                    <td style="padding:12px 16px">日均 {avg_min} 分钟</td>
                </tr>
                <tr style="background:#f5f7fa">
                    <td style="padding:12px 16px">✅ 完成任务</td>
                    <td style="padding:12px 16px;font-weight:700;color:#00B96B">{done_tasks} 项</td>
                    <td style="padding:12px 16px">
                        {'⚠️ 过期 ' + str(exp_tasks) + ' 项' if exp_tasks > 0 else '无过期任务'}
                    </td>
                </tr>
            </table>
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0">
            <p>继续加油，坚持学习，每天进步一点点！💪</p>
            <p style="color:#888;font-size:12px">此邮件由系统自动发送，请勿直接回复。</p>
        </div>
    </body></html>
    """


# ══════════════════════════════════════════════════════════════
# 页面 Tab
# ══════════════════════════════════════════════════════════════
tab_test, tab_report, tab_log = st.tabs(["🧪 发送测试邮件", "📊 推送学习报告", "📋 发送记录"])


# ── Tab 1：测试邮件 ───────────────────────────────────────────
with tab_test:
    st.markdown("#### 发送测试邮件，验证邮箱配置是否正确")

    # 邮箱配置状态提示
    if EMAIL_USER and EMAIL_PASS:
        st.success(f"✅ 邮箱配置正常，发件地址：{EMAIL_USER}")
    else:
        st.error("❌ 未检测到邮箱配置，请在 `.env` 文件中填写 `EMAIL_USER` 和 `EMAIL_PASS`")

    with st.form("test_email_form"):
        recv_email = st.text_input(
            "接收测试邮件的邮箱地址 *",
            value=user_email,
            placeholder="your_email@163.com",
        )
        submitted = st.form_submit_button("📤 立即发送测试邮件", use_container_width=True, type="primary")

    if submitted:
        if not recv_email or "@" not in recv_email:
            st.error("请输入有效的邮箱地址")
        else:
            with st.spinner("正在发送，请稍候..."):
                html  = build_test_html(full_name)
                ok, msg = send_email_smtp(recv_email, "【学习管理平台】邮件服务测试", html)
                log_email(recv_email, "邮件服务测试", ok, msg)
            if ok:
                st.success(f"✅ 邮件已发送至 {recv_email}，请在收件箱查收（可能在垃圾箱）")
            else:
                st.error(f"❌ 发送失败：{msg}")


# ── Tab 2：报告推送 ───────────────────────────────────────────
with tab_report:
    st.markdown("#### 将学习报告发送到您的邮箱")

    col1, col2 = st.columns(2)
    with col1:
        report_days = st.selectbox("报告周期", [7, 14, 30], format_func=lambda x: f"近 {x} 天")
        recv_email2 = st.text_input("接收邮箱", value=user_email, placeholder="your_email@163.com")
    with col2:
        st.markdown("<br>", unsafe_allow_html=True)
        st.info(f"将生成近 **{report_days}** 天的数据报告并发送到您的邮箱")

    if st.button("📊 生成报告并发送", use_container_width=True, type="primary"):
        if not recv_email2 or "@" not in recv_email2:
            st.error("请输入有效的邮箱地址")
        else:
            # 查询报告所需数据
            sd = (date.today() - timedelta(days=report_days-1)).strftime("%Y-%m-%d")

            df_ci = run_query(
                """SELECT COUNT(DISTINCT checkin_date) AS days,
                          COALESCE(SUM(duration_minutes), 0) AS total_min
                   FROM checkins WHERE user_id=:uid AND checkin_date>=:sd""",
                {"uid": user_id, "sd": sd},
            )
            checkin_days2 = int(df_ci["days"].iloc[0])    if not df_ci.empty else 0
            total_min2    = int(df_ci["total_min"].iloc[0]) if not df_ci.empty else 0

            df_tk = run_query(
                "SELECT status, COUNT(*) AS cnt FROM tasks WHERE user_id=:uid GROUP BY status",
                {"uid": user_id},
            )
            tm = dict(zip(df_tk["status"], df_tk["cnt"])) if not df_tk.empty else {}
            done_t = tm.get("done", 0)
            exp_t  = tm.get("expired", 0)

            with st.spinner("正在生成报告并发送..."):
                html = build_report_html(full_name, report_days, total_min2,
                                          checkin_days2, done_t, exp_t)
                subject = f"【学习管理平台】您的近{report_days}天学习报告"
                ok, msg = send_email_smtp(recv_email2, subject, html)
                log_email(recv_email2, subject, ok, msg)

            if ok:
                st.success(f"✅ 学习报告已发送至 {recv_email2}！")
                # 显示报告摘要
                c1, c2, c3 = st.columns(3)
                c1.metric("打卡天数", f"{checkin_days2}/{report_days} 天")
                c2.metric("累计学习", f"{round(total_min2/60,1)} 小时")
                c3.metric("完成任务", f"{done_t} 项")
            else:
                st.error(f"❌ 发送失败：{msg}")


# ── Tab 3：发送历史记录 ───────────────────────────────────────
with tab_log:
    df_logs = run_query(
        """SELECT to_email, subject, status, error_msg, created_at
           FROM email_logs
           WHERE user_id = :uid
           ORDER BY created_at DESC
           LIMIT 50""",
        {"uid": user_id},
    )

    if df_logs.empty:
        st.info("暂无邮件发送记录")
    else:
        status_map = {"success": "✅ 成功", "failed": "❌ 失败"}
        df_logs["status"] = df_logs["status"].map(status_map).fillna(df_logs["status"])
        df_logs.columns = ["收件人", "主题", "状态", "错误信息", "发送时间"]
        st.dataframe(
            df_logs.drop(columns=["错误信息"]),
            use_container_width=True,
            hide_index=True,
        )
        fail_count = (df_logs["状态"] == "❌ 失败").sum()
        if fail_count > 0:
            st.warning(f"共有 {fail_count} 封邮件发送失败，请检查邮箱配置")
