"""
============================================================
邮件发送服务模块
使用 Python 标准库 smtplib 通过 163 邮箱 SMTP 发送 HTML 邮件
============================================================
"""

import smtplib
import ssl
import logging
from email.mime.multipart import MIMEMultipart   # 多部分邮件容器
from email.mime.text import MIMEText             # 文本/HTML 邮件部分

from sqlalchemy.orm import Session
from config import settings
from models.orm_models import EmailLog

# 配置日志记录器，方便排查发送问题
logger = logging.getLogger(__name__)


class EmailService:
    """
    邮件发送服务类
    封装 163 SMTP 连接、HTML 邮件构建、发送日志记录等功能
    """

    # 163 邮箱 SMTP 服务器配置
    SMTP_HOST = "smtp.163.com"
    SMTP_PORT = 465          # SSL 加密端口，比 25 端口更安全稳定

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        db: Session = None,
        user_id: str = None,
    ) -> dict:
        """
        发送一封 HTML 格式邮件

        Args:
            to_email (str):      收件人邮箱地址
            subject (str):       邮件主题
            html_content (str):  邮件 HTML 正文
            db (Session):        数据库会话，传入则记录发送日志（可选）
            user_id (str):       关联用户 ID，用于日志关联（可选）

        Returns:
            dict: {"success": True/False, "message": "说明信息"}
        """

        # 检查 163 邮箱授权码是否已配置
        if not settings.email_pass:
            msg = "163 邮箱授权码未配置，请在 .env 文件中设置 EMAIL_PASS"
            logger.error(msg)
            self._save_log(db, user_id, to_email, subject, "failed", msg)
            return {"success": False, "message": msg}

        try:
            # ── 步骤 1：构建邮件消息 ──────────────────────────────
            # MIMEMultipart("alternative") 包含纯文本 + HTML，客户端自动选择最佳格式显示
            msg = MIMEMultipart("alternative")

            # 发件人：仅使用邮箱地址，避免中文名称触发 RFC 2047 编码在部分客户端显示乱码
            msg["From"] = settings.email_user
            msg["To"]   = to_email
            # 主题直接赋值；Python 3.6+ email 库自动以 utf-8 编码处理非 ASCII 字符
            msg["Subject"] = subject

            # 纯文本兜底（去除 HTML 标签的简化版），防止不支持 HTML 的客户端显示乱码
            import re as _re
            plain_text = _re.sub(r'<[^>]+>', '', html_content)
            plain_text = _re.sub(r'\s{2,}', ' ', plain_text).strip()
            msg.attach(MIMEText(plain_text, "plain", "utf-8"))

            # HTML 正文（指定编码为 utf-8 支持中文）
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            # ── 步骤 2：连接 SMTP 服务器并发送 ────────────────────
            # 使用 SMTP_SSL 建立加密连接（SSL 在连接建立时就加密）
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.SMTP_HOST, self.SMTP_PORT, context=ctx) as server:
                # 设置调试级别：0=不输出调试信息，1=输出 SMTP 通信过程
                server.set_debuglevel(0)

                # 登录：使用账号 + 授权码（不是登录密码！）
                server.login(settings.email_user, settings.email_pass)
                logger.info(f"SMTP 登录成功：{settings.email_user}")

                # 发送邮件
                server.sendmail(
                    from_addr=settings.email_user,
                    to_addrs=[to_email],
                    msg=msg.as_string()
                )
                logger.info(f"邮件发送成功 → {to_email}，主题：{subject}")

            # ── 步骤 3：记录成功日志 ──────────────────────────────
            self._save_log(db, user_id, to_email, subject, "success")
            return {"success": True, "message": f"邮件已成功发送至 {to_email}"}

        except smtplib.SMTPAuthenticationError:
            # 认证失败：通常是授权码错误或服务未开启
            err = "SMTP 认证失败：请检查 163 邮箱授权码是否正确，以及是否已开启 SMTP 服务"
            logger.error(err)
            self._save_log(db, user_id, to_email, subject, "failed", err)
            return {"success": False, "message": err}

        except smtplib.SMTPException as e:
            # 其他 SMTP 协议错误
            err = f"SMTP 发送异常：{str(e)}"
            logger.error(err)
            self._save_log(db, user_id, to_email, subject, "failed", err)
            return {"success": False, "message": err}

        except Exception as e:
            # 捕获所有其他异常，防止服务崩溃
            err = f"邮件发送失败（未知错误）：{str(e)}"
            logger.error(err, exc_info=True)
            self._save_log(db, user_id, to_email, subject, "failed", err)
            return {"success": False, "message": err}

    def _save_log(
        self,
        db: Session,
        user_id: str,
        to_email: str,
        subject: str,
        status: str,
        error_msg: str = None,
    ):
        """
        将邮件发送结果写入 email_logs 表

        Args:
            db:        数据库会话（为 None 则跳过日志记录）
            user_id:   关联用户 ID
            to_email:  收件人邮箱
            subject:   邮件主题
            status:    "success" 或 "failed"
            error_msg: 失败时的错误信息
        """
        if db is None:
            return  # 无数据库会话时跳过日志记录
        try:
            log = EmailLog(
                user_id=user_id,
                to_email=to_email,
                subject=subject,
                status=status,
                error_msg=error_msg,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            # 日志记录失败不影响主流程
            logger.warning(f"邮件日志写入失败：{e}")
            db.rollback()

    # ── 预定义邮件模板 ────────────────────────────────────────

    def build_task_reminder_html(
        self,
        username: str,
        task_name: str,
        course_name: str,
        due_date: str,
        hours_left: int,
    ) -> str:
        """
        构建任务截止提醒邮件的 HTML 内容

        Args:
            username:    学生姓名
            task_name:   任务名称
            course_name: 课程名称
            due_date:    截止时间字符串
            hours_left:  距截止还剩多少小时

        Returns:
            str: 完整 HTML 字符串
        """
        # 根据剩余时间决定颜色和紧急度文案
        if hours_left <= 24:
            urgency_color = "#FF4D4F"   # 红色：紧急
            urgency_label = "⚠️ 紧急提醒"
        elif hours_left <= 72:
            urgency_color = "#FF7D00"   # 橙色：较紧急
            urgency_label = "📌 即将截止"
        else:
            urgency_color = "#165DFF"   # 蓝色：普通提醒
            urgency_label = "📋 任务提醒"

        return f"""
        <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    max-width: 520px; margin: 0 auto; background: #f5f7fa; padding: 24px;">
          <div style="background: #fff; border-radius: 12px; overflow: hidden;
                      box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

            <!-- 顶部色条 -->
            <div style="background: {urgency_color}; padding: 20px 28px;">
              <h2 style="color: #fff; margin: 0; font-size: 18px;">{urgency_label}</h2>
              <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">
                学习助手 · 大学生学习管理平台
              </p>
            </div>

            <!-- 主体内容 -->
            <div style="padding: 24px 28px;">
              <p style="color: #333; font-size: 15px; margin: 0 0 16px;">
                亲爱的 <strong>{username}</strong>，您有一项任务即将截止：
              </p>

              <!-- 任务信息卡 -->
              <div style="background: #f8f9ff; border-left: 4px solid {urgency_color};
                          border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
                <table style="border-collapse: collapse; width: 100%;">
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0; width: 80px;">任务名称</td>
                    <td style="color: #1d2129; font-size: 14px; font-weight: 600;">{task_name}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">所属课程</td>
                    <td style="color: #1d2129; font-size: 14px;">{course_name}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">截止时间</td>
                    <td style="color: {urgency_color}; font-size: 14px; font-weight: 600;">{due_date}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">剩余时间</td>
                    <td style="color: {urgency_color}; font-size: 14px; font-weight: 600;">
                      约 {hours_left} 小时
                    </td>
                  </tr>
                </table>
              </div>

              <p style="color: #666; font-size: 13px; margin: 0;">
                请合理安排时间，按时完成提交。加油！💪
              </p>
            </div>

            <!-- 底部 -->
            <div style="background: #f5f7fa; padding: 14px 28px;
                        border-top: 1px solid #e5e6eb;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">
                此邮件由学习助手自动发送，请勿直接回复。
                如需退订提醒，请在个人中心关闭邮件通知。
              </p>
            </div>
          </div>
        </div>
        """

    def build_test_email_html(self, username: str) -> str:
        """构建测试邮件 HTML 内容"""
        return f"""
        <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    max-width: 520px; margin: 0 auto; padding: 24px;">
          <div style="background: #fff; border-radius: 12px; overflow: hidden;
                      box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
            <div style="background: #165DFF; padding: 20px 28px;">
              <h2 style="color: #fff; margin: 0;">✅ 邮件配置验证成功</h2>
              <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">
                学习助手 · 大学生学习管理平台
              </p>
            </div>
            <div style="padding: 24px 28px;">
              <p style="color: #333;">您好，<strong>{username}</strong>！</p>
              <p style="color: #555; line-height: 1.8;">
                这是一封来自学习助手的测试邮件，说明您的邮箱已成功绑定。<br>
                后续您将收到以下类型的智能提醒：
              </p>
              <ul style="color: #555; line-height: 2;">
                <li>📚 作业截止提醒（提前 3 天 / 1 天 / 1 小时）</li>
                <li>📝 考试倒计时提醒（提前 7 天 / 1 天）</li>
                <li>🔔 上课提醒（课前 15 / 30 分钟）</li>
              </ul>
            </div>
            <div style="background: #f5f7fa; padding: 14px 28px;
                        border-top: 1px solid #e5e6eb;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">
                此邮件由学习助手自动发送，请勿直接回复。
              </p>
            </div>
          </div>
        </div>
        """

    def build_admin_notification_html(
        self,
        sender_name: str,
        subject: str,
        content: str,
    ) -> str:
        """
        构建管理员收到用户联系消息时的通知邮件 HTML

        Args:
            sender_name: 发送用户的姓名/用户名
            subject:     消息主题
            content:     消息正文

        Returns:
            str: 完整 HTML 字符串
        """
        # 对正文进行 HTML 转义，防止 XSS
        import html as html_mod
        safe_content = html_mod.escape(content).replace("\n", "<br>")
        safe_subject = html_mod.escape(subject)
        safe_sender  = html_mod.escape(sender_name)

        return f"""
        <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    max-width: 560px; margin: 0 auto; background: #f5f7fa; padding: 24px;">
          <div style="background: #fff; border-radius: 12px; overflow: hidden;
                      box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

            <div style="background: #1d2129; padding: 20px 28px;">
              <h2 style="color: #fff; margin: 0; font-size: 17px;">📬 新用户联系消息</h2>
              <p style="color: rgba(255,255,255,0.65); margin: 4px 0 0; font-size: 13px;">
                大学生学习管理平台 · 管理员通知
              </p>
            </div>

            <div style="padding: 24px 28px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="color: #888; padding: 6px 0; width: 70px; vertical-align: top;">发件人</td>
                  <td style="color: #1d2129; font-weight: 600; padding: 6px 0;">{safe_sender}</td>
                </tr>
                <tr>
                  <td style="color: #888; padding: 6px 0; vertical-align: top;">主题</td>
                  <td style="color: #1d2129; font-weight: 600; padding: 6px 0;">{safe_subject}</td>
                </tr>
              </table>

              <div style="margin-top: 16px; background: #f8f9ff; border-radius: 8px;
                          border-left: 4px solid #165DFF; padding: 16px 20px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 8px;">消息内容</p>
                <p style="color: #1d2129; font-size: 14px; line-height: 1.7; margin: 0;">
                  {safe_content}
                </p>
              </div>

              <p style="color: #888; font-size: 13px; margin: 16px 0 0;">
                请登录管理后台查看并回复此消息。
              </p>
            </div>

            <div style="background: #f5f7fa; padding: 14px 28px;
                        border-top: 1px solid #e5e6eb;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">
                此邮件由系统自动发送，请勿直接回复。
              </p>
            </div>
          </div>
        </div>
        """

    def build_course_reminder_html(
        self,
        username: str,
        course_name: str,
        location: str,
        teacher: str,
        start_time: str,
        minutes_before: int,
    ) -> str:
        """
        构建上课提醒邮件的 HTML 内容

        Args:
            username:       学生姓名
            course_name:    课程名称
            location:       上课地点
            teacher:        任课教师
            start_time:     上课时间（格式化字符串）
            minutes_before: 距上课还有多少分钟

        Returns:
            str: 完整 HTML 字符串
        """
        return f"""
        <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    max-width: 520px; margin: 0 auto; background: #f5f7fa; padding: 24px;">
          <div style="background: #fff; border-radius: 12px; overflow: hidden;
                      box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

            <div style="background: #00b96b; padding: 20px 28px;">
              <h2 style="color: #fff; margin: 0; font-size: 18px;">🔔 上课提醒</h2>
              <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">
                距上课还有 <strong>{minutes_before} 分钟</strong>，请做好准备！
              </p>
            </div>

            <div style="padding: 24px 28px;">
              <p style="color: #333; font-size: 15px; margin: 0 0 16px;">
                亲爱的 <strong>{username}</strong>，您即将有一节课开始：
              </p>

              <div style="background: #f0fff4; border-left: 4px solid #00b96b;
                          border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
                <table style="border-collapse: collapse; width: 100%;">
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0; width: 80px;">课程名称</td>
                    <td style="color: #1d2129; font-size: 14px; font-weight: 600;">{course_name}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">上课时间</td>
                    <td style="color: #00b96b; font-size: 14px; font-weight: 600;">{start_time}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">上课地点</td>
                    <td style="color: #1d2129; font-size: 14px;">{location or '待确认'}</td>
                  </tr>
                  <tr>
                    <td style="color: #888; font-size: 13px; padding: 4px 0;">任课老师</td>
                    <td style="color: #1d2129; font-size: 14px;">{teacher or '待确认'}</td>
                  </tr>
                </table>
              </div>

              <p style="color: #666; font-size: 13px; margin: 0;">
                请按时到达，认真听课。祝学习顺利！📖
              </p>
            </div>

            <div style="background: #f5f7fa; padding: 14px 28px;
                        border-top: 1px solid #e5e6eb;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">
                此提醒由学习助手自动发送。如需调整提醒时间，请在课程管理中修改「提前提醒分钟数」。
              </p>
            </div>
          </div>
        </div>
        """


# 全局邮件服务单例
email_service = EmailService()
