"""
============================================================
配置管理模块
负责从环境变量（.env 文件）读取所有服务配置项
============================================================
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    应用全局配置类
    使用 pydantic-settings 自动从 .env 文件或系统环境变量加载配置
    字段名不区分大小写：database_url 对应环境变量 DATABASE_URL
    """

    # ── MySQL 数据库连接 ──────────────────────────────────────
    # 格式：mysql+pymysql://用户名:密码@主机:端口/数据库名
    # pymysql 是纯 Python 的 MySQL 驱动，无需额外安装 C 库
    database_url: str = "mysql+pymysql://root:123456@localhost:3306/campus_platform"

    # ── 163 邮箱 SMTP 配置 ────────────────────────────────────
    # 发件邮箱账号（即您的 163 邮箱地址）
    email_user: str = "13719420290@163.com"
    # 163 邮箱授权码（不是登录密码，需在邮箱设置中生成）
    email_pass: str = ""
    # 发件人显示名称
    email_from_name: str = "学习助手"
    # SMTP 服务器地址和 SSL 端口（163 邮箱固定值）
    email_host: str = "smtp.163.com"
    email_port: int = 465
    # 管理员收件邮箱（用于接收用户联系消息和系统告警）
    admin_email: str = ""

    # ── JWT 认证配置 ─────────────────────────────────────────
    # JWT 签名密钥，生产环境务必替换为随机长字符串
    secret_key: str = "campus_platform_secret_key_please_change_in_production"
    # JWT 使用 HS256 算法
    algorithm: str = "HS256"
    # Token 有效期（分钟）：10080 = 7天
    access_token_expire_minutes: int = 10080

    # ── 服务运行配置 ─────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    class Config:
        # 指定 .env 文件路径（相对于项目根目录）
        env_file = ".env"
        # 忽略大小写，方便书写
        case_sensitive = False


# 全局配置单例，其他模块直接导入使用
# 示例：from config import settings; print(settings.email_user)
settings = Settings()
