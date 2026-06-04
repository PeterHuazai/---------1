<div align="center">

# 📚 大学生学习管理平台

**一站式管理课程、任务与学习资料，智能提醒与打卡助力高效学习生活**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)](https://www.sqlalchemy.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## 📖 目录

- [项目简介](#-项目简介)
- [系统架构](#-系统架构)
- [功能模块](#-功能模块)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [项目结构](#-项目结构)
- [数据库设计](#-数据库设计)
- [API 文档](#-api-文档)
- [权限说明](#-权限说明)
- [开发规范](#-开发规范)
- [开源协议](#-开源协议)

---

## 🎯 项目简介

本项目是面向大学生群体的**全功能学习管理 Web 应用**，使用 **Python（FastAPI）+ React** 全栈实现。

系统涵盖 12 个核心模块：课程表管理、任务跟踪、学习资料库、打卡习惯养成、校园生活资讯、好友社交、小组实时讨论、论坛社区、站内通知、管理后台等。支持**公开浏览与登录操作的分级权限策略**，管理员可进行内容审核、用户管理与数据统计。

### ✨ 项目亮点

- 🐍 **Python 后端**：FastAPI 异步框架 + SQLAlchemy 2.0 ORM + Alembic 数据库迁移
- ⚡ **实时通信**：FastAPI WebSocket + Redis Pub/Sub，小组讨论与私信毫秒级同步
- 🔐 **完整认证**：PyJWT + passlib bcrypt 密码哈希，角色权限（user / admin / superadmin）
- 🖼️ **图片处理**：Pillow 自动压缩上传图片为 WEBP / 1080p / 质量 0.8
- 📬 **邮件通知**：smtplib 标准库发送 OTP 验证码与管理员反馈通知邮件
- ⏰ **定时提醒**：Celery + Redis 实现上课提醒、任务截止三级推送
- 🛡️ **内容安全**：违禁词过滤系统，拦截发帖/回帖/私信中的违规内容
- 📖 **自动文档**：FastAPI 自动生成 Swagger UI / ReDoc 交互式 API 文档

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────┐
│                   浏览器客户端                      │
│       React 18 + TypeScript + Tailwind CSS        │
│           shadcn/ui 组件库 + React Router          │
└──────────────────┬───────────────────────────────┘
                   │  HTTP REST / WebSocket
┌──────────────────▼───────────────────────────────┐
│              Python 后端（FastAPI）                 │
│                                                  │
│  ┌────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  REST API  │ │  WebSocket  │ │   Celery    │  │
│  │  路由层     │ │  实时通信    │ │  定时任务    │  │
│  └─────┬──────┘ └──────┬──────┘ └──────┬──────┘  │
│        └───────────────┴───────────────┘          │
│              SQLAlchemy 2.0 ORM（async）           │
└──────────────────┬───────────────────────────────┘
                   │
      ┌────────────┼──────────────┐
      ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │  Redis   │ │  MinIO   │
│  主数据库 │ │消息队列   │ │文件存储   │
└──────────┘ └──────────┘ └──────────┘
```

---

## 🧩 功能模块

<details>
<summary><b>1. 用户认证与门户首页</b></summary>

- 邮箱 + 密码登录、邮箱验证码（OTP）登录
- JWT Token 认证，角色权限分级（user / admin / superadmin）
- 公开门户页：无需登录可浏览平台介绍与功能亮点
</details>

<details>
<summary><b>2. 课程表管理</b></summary>

- 按周视图展示课程，支持课程冲突自动检测
- 设置时间、地点、教师、学分、课程类型（必修/选修）
- 上课前智能提醒（Celery 定时任务，可自定义提前分钟数）
</details>

<details>
<summary><b>3. 任务管理</b></summary>

- 支持作业、实验报告、课程论文、期末考试、随堂测验等类型
- 三级智能提醒：截止前 **3 天 / 1 天 / 1 小时**
- 任务状态流转：未开始 → 进行中 → 已完成
</details>

<details>
<summary><b>4. 学习资料库</b></summary>

- 按课程章节分类存储，支持搜索与格式筛选
- 文件上传（MinIO/S3）+ Pillow 自动压缩图片（WEBP / 1080p / q=0.8）
</details>

<details>
<summary><b>5. 打卡与目标</b></summary>

- 自定义学习目标（每日 / 每周 / 每月），设定目标值与单位
- 打卡日历热力图可视化，记录学习时长与备注
</details>

<details>
<summary><b>6. 校园生活</b></summary>

- 校园资讯（食堂、宿舍、图书馆、社团）、新闻与活动公告（公开浏览）
</details>

<details>
<summary><b>7. 好友与私信</b></summary>

- 添加好友、查看好友列表
- 一对一私信：WebSocket 实时推送，未读消息角标提醒
</details>

<details>
<summary><b>8. 小组学习（实时）</b></summary>

- 创建/加入学习小组，支持公告编辑
- **实时讨论区**：WebSocket + Redis Pub/Sub，消息毫秒级广播
- **消息撤回**：2 分钟内可撤回，实时同步给所有在线成员
- 成员打卡排行榜；组长可禁言违规成员
</details>

<details>
<summary><b>9. 论坛社区</b></summary>

- 多版块：学习交流、求职经验、考研保研、校园生活、学术交流等
- 发帖、回帖、浏览量统计、帖子置顶
- **帖主自删**：软删除（`is_deleted=True`）+ 二次确认弹窗
- **回复自删**：作者可删除自己回复，含二次确认
- 私信楼主功能
</details>

<details>
<summary><b>10. 通知中心</b></summary>

- 上课提醒、任务截止提醒、系统通知，支持已读/未读状态管理
</details>

<details>
<summary><b>11. 管理后台</b></summary>

- 用户管理：列表查询、角色修改、封禁/解封、密码重置
- 论坛管理：版块增删改、帖子置顶/删除/恢复、**复选框批量删除帖子与回复**
- 违禁词管理：CRUD 违禁词库，全场景自动拦截
- 数据统计可视化：用户数、帖子数、打卡数等图表
</details>

<details>
<summary><b>12. 联系管理员</b></summary>

- 悬浮反馈窗口，随时提交建议；提交后通过 smtplib 自动发 HTML 邮件通知管理员
</details>

---

## 🛠️ 技术栈

### 后端（Python）

| 技术 | 版本 | 说明 |
|------|------|------|
| **Python** | 3.11+ | 主要编程语言 |
| **FastAPI** | 0.111 | 高性能异步 Web 框架，自动生成 OpenAPI/Swagger 文档 |
| **SQLAlchemy** | 2.0 | 异步 ORM，支持 async/await |
| **Alembic** | 1.13 | 数据库版本迁移管理 |
| **asyncpg** | 0.29 | 异步 PostgreSQL 驱动 |
| **Pydantic** | 2.7 | 请求/响应数据校验与序列化 |
| **PyJWT + passlib** | 2.8 / 1.7 | JWT 认证 + bcrypt 密码哈希 |
| **Celery + Redis** | 5.3 / 5.0 | 异步任务队列与定时提醒 |
| **Pillow** | 10.x | 图片压缩处理（WEBP / 1080p） |
| **WebSockets** | 12.0 | 小组讨论与私信实时通信 |
| **smtplib** | 内置 | OTP 邮件与管理员通知发送 |
| **uvicorn** | 0.29 | ASGI 服务器，运行 FastAPI |

### 前端（React）

| 技术 | 版本 | 说明 |
|------|------|------|
| **React** | 18.x | UI 框架，函数式组件 + Hooks |
| **TypeScript** | 5.x | 静态类型检查 |
| **Vite** | 5.x | 构建工具与开发服务器 |
| **Tailwind CSS** | 3.x | 原子化 CSS 框架 |
| **shadcn/ui** | latest | 基于 Radix UI 的组件库 |
| **React Router** | 6.x | SPA 路由，支持懒加载 |
| **React Hook Form + Zod** | 7.x / 3.x | 表单状态管理与数据校验 |
| **Recharts** | 2.x | 数据可视化图表 |

### 基础设施

| 技术 | 说明 |
|------|------|
| **PostgreSQL 15+** | 主数据库 |
| **Redis 7+** | Celery 消息 Broker + WebSocket Pub/Sub |
| **MinIO / AWS S3** | 文件对象存储（S3 兼容协议） |
| **Docker + Nginx** | 容器化部署与反向代理 |

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 15+ |
| Redis | 7+ |
| pnpm | 8+ |

---

### 1. 克隆仓库

```bash
git clone [https://github.com/your-username/study-platform.git](https://github.com/PeterHuazai/---------1)
cd study-platform
```

---

### 2. 后端启动（Python / FastAPI）

```bash
cd backend

# 创建并激活虚拟环境
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

**配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/study_platform

# JWT
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Redis
REDIS_URL=redis://localhost:6379/0

# 邮件（SMTP）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your-email@qq.com
SMTP_PASSWORD=your-smtp-auth-code
EMAIL_FROM_NAME=学习管理平台

# 文件存储（MinIO）
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=study-materials
```

**初始化数据库**

```bash
# 创建数据库
psql -U postgres -c "CREATE DATABASE study_platform;"

# 执行全部 Alembic 迁移
alembic upgrade head
```

**启动服务**

```bash
# 启动 FastAPI（开发模式，自动热重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 另开终端：启动 Celery Worker
celery -A app.tasks.celery_app worker --loglevel=info

# 另开终端：启动 Celery Beat（定时任务）
celery -A app.tasks.celery_app beat --loglevel=info
```

> 访问 **`http://localhost:8000/docs`** 查看自动生成的 Swagger API 文档

---

### 3. 前端启动（React）

```bash
cd frontend
pnpm install
cp .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

```bash
pnpm dev      # 开发服务器：http://localhost:5173
pnpm build    # 构建生产包
```

---

### 4. Docker 一键启动（推荐）

```bash
docker-compose up -d

# 执行数据库迁移
docker-compose exec backend alembic upgrade head
```

> `docker-compose.yml` 已包含：**PostgreSQL + Redis + MinIO + FastAPI 后端 + React 前端（Nginx）**

---

## 📁 项目结构

```
study-platform/
├── backend/                        # Python 后端（FastAPI）
│   ├── app/
│   │   ├── main.py                 # FastAPI 应用入口
│   │   ├── config.py               # 配置管理（pydantic-settings）
│   │   ├── database.py             # SQLAlchemy 异步引擎 + Session
│   │   ├── models/                 # 数据库模型（ORM 表定义）
│   │   │   ├── profile.py          # 用户（角色、封禁时间）
│   │   │   ├── course.py           # 课程
│   │   │   ├── task.py             # 任务（三级提醒标志）
│   │   │   ├── material.py         # 学习资料
│   │   │   ├── goal.py             # 目标 & 打卡
│   │   │   ├── forum.py            # 论坛帖子/回复（软删除）
│   │   │   ├── message.py          # 私信 & 小组消息
│   │   │   └── keyword_filter.py   # 违禁词
│   │   ├── schemas/                # Pydantic 请求/响应 Schema
│   │   ├── routers/                # API 路由（按功能拆分）
│   │   │   ├── auth.py             # 登录 / 注册 / OTP
│   │   │   ├── courses.py          # 课程 CRUD + 冲突检测
│   │   │   ├── tasks.py            # 任务管理 + 状态流转
│   │   │   ├── materials.py        # 资料上传
│   │   │   ├── goals.py            # 打卡目标
│   │   │   ├── forum.py            # 论坛（软删除、批量删除）
│   │   │   ├── messages.py         # 私信
│   │   │   ├── study_groups.py     # 小组学习
│   │   │   ├── admin.py            # 管理员操作
│   │   │   └── notifications.py    # 站内通知
│   │   ├── services/               # 业务逻辑层
│   │   │   ├── auth_service.py
│   │   │   ├── email_service.py    # smtplib 邮件发送
│   │   │   ├── storage_service.py  # Pillow 压缩 + MinIO 上传
│   │   │   └── keyword_filter.py   # 违禁词检测
│   │   ├── websocket/              # WebSocket 实时功能
│   │   │   ├── manager.py          # ConnectionManager
│   │   │   ├── group_chat.py       # 小组实时讨论
│   │   │   └── private_msg.py      # 私信实时推送
│   │   └── tasks/                  # Celery 异步任务
│   │       ├── celery_app.py
│   │       ├── reminder.py         # 上课 / 任务截止提醒
│   │       └── email_tasks.py
│   ├── alembic/                    # 数据库迁移版本（21 个）
│   │   └── versions/
│   ├── tests/                      # 单元测试 & 集成测试
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/                       # React 前端
│   ├── src/
│   │   ├── components/             # UI 组件（shadcn/ui + 自定义）
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx     # 全局认证上下文（JWT）
│   │   ├── hooks/                  # 自定义 Hooks
│   │   ├── pages/                  # 页面组件（按路由）
│   │   │   ├── AdminPage.tsx       # 管理后台（批量删除）
│   │   │   ├── ForumPage.tsx       # 论坛（二次确认删除）
│   │   │   ├── StudyGroupsPage.tsx # 小组（实时 WebSocket）
│   │   │   ├── CoursesPage.tsx
│   │   │   ├── TasksPage.tsx
│   │   │   └── ...
│   │   └── routes.tsx              # 路由配置
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── docker-compose.yml
└── README.md
```

---

## 🗄️ 数据库设计

所有表结构通过 **Alembic 迁移**管理，共 21 个版本：

| 表名 | 说明 |
|------|------|
| `profiles` | 用户信息（role、banned_until、头像 URL） |
| `courses` | 课程（星期、时间、地点、冲突检测） |
| `tasks` | 任务（类型、截止时间、三级提醒标志） |
| `materials` | 学习资料（文件 URL、章节、课程关联） |
| `goals` / `checkins` | 学习目标 & 打卡记录 |
| `notifications` | 站内通知（类型、已读状态） |
| `friendships` | 好友关系（双向确认） |
| `private_messages` | 一对一私信 |
| `study_groups` / `group_members` | 学习小组 & 成员（禁言状态） |
| `group_messages` | 小组讨论消息（WebSocket 实时同步） |
| `forum_categories` | 论坛版块配置 |
| `forum_posts` | 论坛帖子（`is_deleted` 软删除，支持恢复） |
| `forum_replies` | 论坛回复（`is_deleted` 软删除） |
| `keyword_filters` | 违禁词列表 |
| `contact_messages` | 用户反馈 |

**常用迁移命令**：

```bash
alembic revision --autogenerate -m "描述变更"   # 生成新迁移文件
alembic upgrade head                             # 应用所有迁移
alembic downgrade -1                             # 回滚一步
```

---

## 📄 API 文档

启动后端后访问自动生成的交互式文档：

| 文档类型 | 地址 |
|---------|------|
| **Swagger UI**（推荐） | `http://localhost:8000/docs` |
| **ReDoc** | `http://localhost:8000/redoc` |
| **OpenAPI JSON** | `http://localhost:8000/openapi.json` |

主要接口一览：

```
# 认证
POST  /api/auth/login                 邮箱登录，返回 JWT Token
POST  /api/auth/register              注册新用户
POST  /api/auth/send-otp              发送 OTP 验证码（smtplib）
POST  /api/auth/verify-otp            校验 OTP

# 课程
GET   /api/courses                    获取当前用户课程列表
POST  /api/courses                    新增课程（含冲突检测）
PUT   /api/courses/{id}               更新课程
DELETE /api/courses/{id}              删除课程

# 任务
GET   /api/tasks                      任务列表（支持状态过滤）
POST  /api/tasks                      新建任务
PATCH /api/tasks/{id}/status          更新任务状态

# 论坛
GET   /api/forum/posts                帖子列表（公开）
POST  /api/forum/posts                发帖（需登录）
DELETE /api/forum/posts/{id}          软删除帖子
POST  /api/admin/posts/batch-delete   批量删除（仅管理员）

# 实时通信（WebSocket）
WS    /ws/group/{group_id}            小组实时讨论连接
WS    /ws/private/{user_id}           私信实时推送连接
```

---

## 🔐 权限说明

| 功能 | 未登录 | 普通用户 | 管理员 |
|------|:------:|:--------:|:------:|
| 门户首页 / 论坛浏览 / 校园生活 | ✅ | ✅ | ✅ |
| 发帖 / 回帖 / 私信 / 加入小组 | ❌ | ✅ | ✅ |
| 课程表 / 任务 / 资料 / 打卡 | ❌ | ✅ | ✅ |
| 好友 / 通知中心 | ❌ | ✅ | ✅ |
| 删除自己的帖子/回复（软删除） | ❌ | ✅ | ✅ |
| 管理后台入口 | ❌ | ❌ | ✅ |
| 违禁词管理 / 批量删除内容 | ❌ | ❌ | ✅ |
| 封禁用户 / 重置密码 | ❌ | ❌ | ✅ |

权限通过 FastAPI `Depends` 依赖注入实现，管理员接口额外校验 JWT 中的 `role` 字段。

---

## 📐 开发规范

```bash
# 后端代码格式化
black app/

# 后端 Lint 检查
ruff check app/

# 静态类型检查
mypy app/ --strict

# 运行测试
pytest tests/ -v --asyncio-mode=auto

# 前端 Lint
cd frontend && npm run lint
```

- **Python 规范**：`ruff` Lint + `black` 格式化，全项目 type hints，mypy strict
- **前端规范**：Biome Lint，TypeScript strict，2 空格缩进
- **错误响应**：统一格式 `{"code": ..., "message": ..., "data": ...}`
- **注释规范**：业务逻辑、权限判断、WebSocket 处理必须写中文注释

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源，欢迎 Fork 与 Star ⭐
