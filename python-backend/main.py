"""
============================================================
FastAPI 应用主入口
负责创建应用实例、注册路由、配置 CORS、初始化数据库表
============================================================
"""

import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base

# 导入所有 ORM 模型，确保 Base.metadata 包含所有表定义
# （不导入则 create_all 不会创建对应的表）
import models.orm_models  # noqa: F401

# 导入所有路由模块
from routers import auth, courses, tasks, goals, features

# ── 配置日志 ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── 创建 FastAPI 应用实例 ──────────────────────────────────────
app = FastAPI(
    title="大学生学习管理平台 API",
    description="""
## 接口文档

基于 **FastAPI + SQLAlchemy + MySQL** 构建的后端微服务，
提供用户认证、课程管理、任务提醒、打卡计划、邮件发送等完整功能。

### 认证方式
所有需要登录的接口使用 **Bearer Token** 认证。
先调用 `/auth/login` 获取 Token，然后在请求头中携带：
```
Authorization: Bearer <your_token>
```

### 数据库
使用 **MySQL** 存储所有业务数据，通过 SQLAlchemy ORM 操作。

### 邮件服务
通过 **163 邮箱 SMTP** 发送 HTML 格式邮件，
需要在 `.env` 文件中配置 `EMAIL_PASS`（163 邮箱授权码）。
    """,
    version="1.0.0",
    docs_url="/docs",       # Swagger UI 文档地址
    redoc_url="/redoc",     # ReDoc 文档地址
)

# ── 配置 CORS（跨域请求） ─────────────────────────────────────
# 允许前端 React 应用（通常运行在 localhost:5173 或其他端口）访问本服务
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite 开发服务器默认端口
        "http://localhost:3000",   # 备用端口
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*",                       # 开发阶段允许所有来源；生产环境请改为具体域名
    ],
    allow_credentials=True,        # 允许携带 Cookie 和 Authorization 头
    allow_methods=["*"],           # 允许所有 HTTP 方法
    allow_headers=["*"],           # 允许所有请求头
)

# ── 注册路由 ──────────────────────────────────────────────────
# 每个路由模块都有自己的 prefix（如 /auth、/courses 等）
app.include_router(auth.router)          # 认证接口：/auth/...
app.include_router(courses.router)       # 课程接口：/courses/...
app.include_router(tasks.router)         # 任务接口：/tasks/...
app.include_router(goals.router)         # 打卡接口：/goals/...
app.include_router(features.router)      # 邮件/报告/建议：/email/...、/report/...、/advice/...


# ── 启动时自动建表 ────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    """
    应用启动时执行：
    1. 自动创建数据库中尚不存在的表（已存在的表不会被修改）
    2. 打印启动成功信息和文档地址
    """
    logger.info("正在连接 MySQL 数据库并初始化表结构...")
    try:
        # checkfirst=True：仅在表不存在时创建，不影响已有数据
        Base.metadata.create_all(bind=engine, checkfirst=True)
        logger.info("✅ 数据库表初始化完成")
    except Exception as e:
        logger.error(f"❌ 数据库连接失败，请检查 .env 中的 DATABASE_URL 配置：{e}")

    logger.info(f"🚀 服务启动成功，访问地址：http://{settings.host}:{settings.port}")
    logger.info(f"📖 接口文档：http://localhost:{settings.port}/docs")


# ── 健康检查接口 ──────────────────────────────────────────────
@app.get("/health", tags=["系统"], summary="服务健康检查")
def health_check():
    """返回服务运行状态，可用于监控系统探活"""
    return {
        "status":  "healthy",
        "service": "大学生学习管理平台 API",
        "version": "1.0.0",
    }


@app.get("/", tags=["系统"], summary="服务首页")
def root():
    """根路径，返回 API 基本信息"""
    return {
        "message": "欢迎使用大学生学习管理平台 API",
        "docs":    f"http://localhost:{settings.port}/docs",
        "version": "1.0.0",
    }


# ── 程序入口 ──────────────────────────────────────────────────
if __name__ == "__main__":
    # 直接运行 main.py 时启动服务
    # reload=True 表示代码修改后自动重启（仅用于开发环境）
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info",
    )
