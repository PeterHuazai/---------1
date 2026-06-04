# 大学生学习管理平台 — 技术栈文档

> 本文档详细列出本项目涉及的全部技术选型、核心库版本、架构设计以及各模块实现方案。

---

## 一、前端技术栈

### 1.1 框架与构建工具

| 技术 | 版本 | 用途 |
|---|---|---|
| **React** | 18.x | UI 框架，函数式组件 + Hooks |
| **TypeScript** | 5.x | 静态类型检查，提升可维护性 |
| **Vite** | 5.x | 构建工具，快速热更新与打包 |
| **Tailwind CSS** | 3.x | 原子化 CSS 框架，快速构建响应式界面 |
| **PostCSS** | — | CSS 后处理，配合 Tailwind 插件 |

### 1.2 UI 组件库

| 技术 | 版本 | 用途 |
|---|---|---|
| **shadcn/ui** | latest | 基于 Radix UI + Tailwind 的无样式/Headless 组件库，支持完全自定义主题 |
| **@radix-ui/react-* ** | 1.x | 底层无障碍组件（Dialog、Popover、Select、Tabs 等 20+ 组件） |
| **lucide-react** | latest | 图标库，提供 1000+ 矢量图标 |
| **class-variance-authority (CVA)** | — | shadcn/ui 依赖，组件变体管理 |
| **clsx + tailwind-merge** | — | 类名条件拼接与 Tailwind 类冲突解决 |

### 1.3 表单与数据校验

| 技术 | 版本 | 用途 |
|---|---|---|
| **react-hook-form** | 7.x | 高性能表单状态管理，减少重渲染 |
| **@hookform/resolvers** | 5.x | 与 zod 集成的验证解析器 |
| **zod** | 3.x | Schema 声明式数据校验 |

### 1.4 路由与状态

| 技术 | 版本 | 用途 |
|---|---|---|
| **react-router-dom** | 6.x | SPA 前端路由，支持懒加载（React.lazy + Suspense） |
| **React Context** | 内置 | 全局认证状态（AuthContext），用户/角色/登录态管理 |
| **React useState/useReducer** | 内置 | 页面级本地状态管理 |

### 1.5 富文本与展示

| 技术 | 版本 | 用途 |
|---|---|---|
| **react-day-picker** | — | 日期选择器 |
| **date-fns** | — | 日期格式化与计算 |
| **recharts** | — | 数据可视化图表（管理后台统计） |

---

## 二、后端技术栈

### 2.1 核心平台：Supabase

| 模块 | 用途 |
|---|---|
| **Supabase Auth** | 邮箱+密码、手机+OTP 登录；角色管理（user/admin/superadmin）；匿名登录 |
| **Supabase Database (PostgreSQL)** | 主数据库，含触发器、函数、RLS 策略 |
| **Supabase Realtime** | Postgres Changes 实时订阅，实现聊天、讨论区、私信等即时同步 |
| **Supabase Storage** | 学习资料、头像、帖子图片等文件上传与存储 |
| **Supabase Edge Functions** | Deno 运行时 serverless 函数，处理敏感逻辑与第三方集成 |

### 2.2 Edge Functions（Deno + TypeScript）

| 函数名 | 用途 | 关键技术 |
|---|---|---|
| **send-otp** | 发送邮箱/短信验证码 | emailjs（SMTP）、随机码生成、有效期控制（10 分钟） |
| **verify-otp** | 校验 OTP 验证码 | Supabase 客户端校验 + 删除已用记录 |
| **send-email** | 通用邮件发送 | SMTPClient（emailjs），支持 HTML 邮件 |
| **notify-admin** | 用户提交反馈后邮件通知管理员 | SMTPClient + HTML 模板邮件 |
| **admin-actions** | 管理员敏感操作（重置密码、封禁等） | Service Role Key，绕过 RLS |

### 2.3 数据库核心设计

数据库采用 **PostgreSQL**，通过 21 个迁移脚本逐步演进，核心表包括：

| 表名 | 用途 |
|---|---|
| `profiles` | 用户资料（角色、学校、专业、头像等） |
| `courses` | 课程信息（时间、地点、教师、颜色等） |
| `tasks` | 学习任务（类型、截止日、提醒、状态） |
| `materials` | 学习资料（关联课程、文件 URL） |
| `goals` | 学习目标（周期、目标值、单位） |
| `checkins` | 打卡记录（日期、时长、备注） |
| `notifications` | 站内通知（类型、已读状态） |
| `friendships` | 好友关系（双向确认） |
| `private_messages` | 一对一私信 |
| `study_groups` | 学习小组（公告、创建者） |
| `group_members` | 小组成员关系（角色、禁言状态） |
| `group_messages` | 小组讨论消息（实时同步） |
| `group_checkins` | 小组打卡记录 |
| `forum_categories` | 论坛版块 |
| `forum_posts` | 论坛帖子（软删除 is_deleted） |
| `forum_replies` | 论坛回复（软删除 is_deleted） |
| `keyword_filters` | 违禁词列表 |
| `contact_messages` | 用户反馈 |
| `public_profiles` | 公开视图（安全字段白名单） |

### 2.4 安全策略：Row Level Security (RLS)

每张业务表均配置 RLS 策略，核心原则：

- **用户只能读写自己的数据**（`user_id = auth.uid()`）
- **管理员可读写全部数据**（通过 `is_admin()` 辅助函数或 `service_role` 策略）
- **公开数据**（如论坛帖子、校园资讯）允许匿名用户只读
- **敏感操作**（封禁、重置密码）通过 Edge Function + Service Role Key 执行

---

## 三、实时功能实现详解

### 3.1 小组讨论实时同步（StudyGroupsPage）

小组讨论区基于 **Supabase Realtime** 的 `postgres_changes` 订阅，实现消息秒级同步。

**技术方案：**

1. **INSERT 事件订阅**：当任意成员发送消息时，服务端触发 `postgres_changes` INSERT 事件，所有在线客户端接收新消息并追加到列表底部，同时自动滚动到底部。

2. **DELETE 事件订阅**：成员在 2 分钟内撤回自己的消息（执行 `DELETE FROM group_messages WHERE id = ?`），服务端触发 DELETE 事件，所有在线客户端同步移除该消息。

3. **撤回逻辑**：前端判断消息发送时间与当前时间的差值，仅当 `Date.now() - created_at < 2 * 60 * 1000` 时显示「撤回」按钮。点击后调用 `supabase.from('group_messages').delete().eq('id', msgId)`。

```typescript
// 核心订阅代码
const channel = supabase
  .channel(`group:${activeGroup.id}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'group_messages',
    filter: `group_id=eq.${activeGroup.id}`,
  }, (payload) => {
    const msg = payload.new as GroupMessage;
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  })
  .on('postgres_changes', {
    event: 'DELETE', schema: 'public', table: 'group_messages',
    filter: `group_id=eq.${activeGroup.id}`,
  }, (payload) => {
    const old = payload.old as { id: string };
    setMessages(prev => prev.filter(m => m.id !== old.id));
  })
  .subscribe();
```

**特点：**
- 不依赖 WebSocket 手写协议，完全由 Supabase 托管
- 过滤器 `group_id=eq.${activeGroup.id}` 确保仅接收当前小组的消息
- 组件卸载时调用 `supabase.removeChannel(channel)` 清理订阅

### 3.2 私信实时推送（FriendsPage）

私信系统同样基于 Realtime `postgres_changes` INSERT 事件：

- 每个对话双方订阅 `private_messages` 表，过滤条件为 `receiver_id=eq.${userId}`
- 收到新消息时，更新消息列表并触发未读数更新
- 无需轮询，推送延迟通常在毫秒级

### 3.3 论坛回帖实时加载（ForumPage）

帖子详情页打开时，订阅 `forum_replies` 表的 INSERT 事件：

- 过滤条件 `post_id=eq.${post.id}`
- 收到新回复后，查询作者昵称并追加到回复列表
- 支持 `is_deleted` 过滤，已软删除的回复不会出现在列表中

---

## 四、文件上传与图片处理

### 4.1 上传流程

1. 用户选择文件 → 前端通过 `use-supabase-upload.ts` Hook 调用 Supabase Storage API
2. **自动压缩策略**：
   - 图片超过尺寸限制 → 自动转为 WEBP 格式
   - 分辨率超过 1080p → 缩放至 1080p
   - 质量参数 0.8 → 平衡清晰度与体积
3. 上传成功后返回 CDN URL，存入数据库对应记录

### 4.2 存储桶结构

| 桶名 | 用途 |
|---|---|
| `avatars` | 用户头像 |
| `materials` | 学习资料文件 |
| `post-images` | 论坛帖子配图 |

---

## 五、内容安全与关键词过滤

### 5.1 违禁词检测

- 数据库维护 `keyword_filters` 表，存储敏感词正则/文本
- 前端通过 `useKeywordFilter` Hook 调用 `checkContent(text)`
- 检测命中后阻止提交，并提示用户具体违禁词

### 5.2 应用场景

| 场景 | 检测时机 | 处理方式 |
|---|---|---|
| 论坛发帖/回帖 | 提交前 | 拦截，提示修改 |
| 小组讨论消息 | 发送前 | 拦截，提示修改 |
| 用户资料修改 | 保存前 | 拦截 |
| 用户反馈 | 提交前 | 拦截 |

### 5.3 用户封禁

- `profiles.banned_until` 字段记录封禁到期时间
- 登录后全局检查，已封禁用户禁止发帖、回帖、发消息
- 管理员可在后台一键封禁/解封

---

## 六、管理后台架构

### 6.1 权限控制

- 路由守卫（RouteGuard）：访问 `/admin` 时校验 `role === 'admin' || role === 'superadmin'`
- 非管理员访问 → 自动重定向到首页

### 6.2 功能模块

| 模块 | 技术实现 |
|---|---|
| 用户列表 | `supabase.from('profiles').select('*')`，支持搜索、分页 |
| 角色修改 | Edge Function `admin-actions`（Service Role） |
| 封禁/解封 | 更新 `banned_until` 字段 |
| 密码重置 | Edge Function 调用 Supabase Admin API |
| 论坛帖子管理 | 表格展示 + 置顶/删除/恢复 + **复选框批量删除** |
| 论坛回复管理 | 独立页签，表格展示 + **复选框批量删除** |
| 违禁词管理 | CRUD `keyword_filters` 表 |
| 数据统计 | recharts 柱状图/折线图 + 聚合查询 |

---

## 七、邮件服务

### 7.1 技术方案

- **邮件库**：`emailjs`（SMTPClient），在 Deno Edge Function 中运行
- **配置项**：`EMAIL_USER`、`EMAIL_PASS`、`EMAIL_FROM_NAME`
- **使用场景**：
  - OTP 验证码邮件（send-otp）
  - 通用邮件通知（send-email）
  - 管理员反馈通知（notify-admin，HTML 模板）

### 7.2 通知模板

`notify-admin` 函数发送 HTML 格式邮件，包含：
- 发送者昵称
- 反馈主题与内容
- 发送时间
- 管理员后台链接

---

## 八、依赖版本汇总

```json
{
  "核心框架": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "typescript": "^5.x",
    "vite": "^5.x"
  },
  "UI 与样式": {
    "tailwindcss": "^3.x",
    "@radix-ui/react-*": "^1.x",
    "lucide-react": "latest",
    "sonner": "^1.x"
  },
  "表单与校验": {
    "react-hook-form": "^7.x",
    "@hookform/resolvers": "^5.x",
    "zod": "^3.x"
  },
  "后端服务": {
    "@supabase/supabase-js": "2.103.1"
  },
  "图表": {
    "recharts": "^2.x"
  },
  "日期": {
    "date-fns": "^3.x",
    "react-day-picker": "^8.x"
  }
}
```

---

## 九、部署说明

### 9.1 前端部署

项目为纯前端 SPA，构建产物为静态文件，可部署至任意静态托管：

```bash
vite build
```

### 9.2 后端部署

- Supabase 项目已包含数据库、认证、存储、Realtime
- Edge Functions 需单独部署：

```bash
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy send-email
supabase functions deploy notify-admin
supabase functions deploy admin-actions
```

### 9.3 密钥配置

需在 Supabase Dashboard → Project Settings → Secrets 中配置：

| 密钥名 | 说明 |
|---|---|
| `EMAIL_USER` | SMTP 发件邮箱 |
| `EMAIL_PASS` | SMTP 授权码/密码 |
| `EMAIL_FROM_NAME` | 发件人显示名称 |
| `SUPABASE_URL` | 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（Edge Function 使用） |

---

## 十、性能优化要点

1. **懒加载**：所有页面组件通过 `React.lazy` + `Suspense` 按需加载
2. **图片压缩**：上传时自动压缩为 WEBP/1080p/0.8 质量
3. **Realtime 过滤**：使用 `filter` 精确过滤，避免全表广播
4. **查询优化**：`forum_posts` 默认限制 100 条，`forum_replies` 限制 200 条
5. **本地状态优先**：消息列表先更新本地状态，再与服务端同步

---

## 十一、开发规范

- **代码风格**：Biome 统一格式化与 Lint，2 空格缩进
- **类型安全**：全项目 TypeScript，`strict` 模式
- **组件设计**：原子化设计，小文件、单一职责
- **错误处理**：所有异步操作均有错误边界与用户友好提示（sonner toast）
- **注释规范**：关键业务逻辑（如 RLS 策略、Realtime 订阅）必须写中文注释


---

## 十二、Python 技术栈方案（作业实现版）

> 本章节描述使用 Python 技术栈完整实现上述大学生学习管理平台所需的全部库与框架，与前述 JS/TS 方案功能对等。

### 12.1 总体架构对照

| 层次 | JS/TS 方案（线上版） | Python 方案（作业版） |
|---|---|---|
| 前端 | React + TypeScript + Vite | React + TypeScript（前端不变）或 Jinja2 模板 |
| 后端 API | Supabase Edge Functions（Deno） | **FastAPI** 或 **Django REST Framework** |
| 数据库驱动 | @supabase/supabase-js | **SQLAlchemy** + **asyncpg** / Django ORM |
| 数据库 | Supabase PostgreSQL | **PostgreSQL**（本地或云端） |
| 认证 | Supabase Auth | **PyJWT** + passlib[bcrypt] / Django Auth |
| 实时推送 | Supabase Realtime | **FastAPI WebSocket** + Redis / **Django Channels** |
| 文件存储 | Supabase Storage | **MinIO** / 本地文件系统 / boto3（AWS S3） |
| 异步任务 | Edge Function 直接执行 | **Celery** + Redis Broker |
| 邮件 | emailjs（Deno SMTP） | **smtplib**（内置）/ fastapi-mail / Django Email |
| 部署 | Supabase 托管 + Vite Build | **Gunicorn** + **Nginx** / Uvicorn（ASGI） |

---

### 12.2 后端框架选型

#### 方案 A：FastAPI（推荐，异步高性能）

| 库 | 版本 | 用途 |
|---|---|---|
| **FastAPI** | ^0.111 | 高性能异步 Web 框架，自动生成 OpenAPI/Swagger 文档 |
| **uvicorn[standard]** | ^0.29 | ASGI 服务器，运行 FastAPI 应用 |
| **pydantic** | ^2.x | 请求/响应数据校验与序列化（FastAPI 内置依赖） |
| **python-multipart** | ^0.0.9 | multipart/form-data 文件上传解析 |
| **python-jose[cryptography]** | ^3.3 | JWT Token 生成与校验 |
| **passlib[bcrypt]** | ^1.7 | 密码 bcrypt 哈希与验证 |

```python
# main.py — FastAPI 应用入口
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

app = FastAPI(title="大学生学习管理平台 API", version="1.0.0")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

@app.post("/api/auth/login")
async def login(form: LoginForm, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, form.email, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/courses")
async def get_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Course).where(Course.user_id == current_user.id).order_by(Course.day_of_week)
    )
    return result.scalars().all()
```

#### 方案 B：Django + Django REST Framework（完整 ORM + 内置生态）

| 库 | 版本 | 用途 |
|---|---|---|
| **Django** | ^5.0 | 全功能 Web 框架，自带 ORM、Admin、Auth |
| **djangorestframework** | ^3.15 | RESTful API（序列化、视图集、权限、分页） |
| **djangorestframework-simplejwt** | ^5.3 | JWT 认证集成 |
| **django-cors-headers** | ^4.3 | 跨域 CORS 请求头配置 |
| **django-filter** | ^24.x | API 过滤、搜索、排序 |
| **drf-spectacular** | ^0.27 | 自动生成 OpenAPI/Swagger 文档 |

```python
# views.py — DRF 视图集示例
from rest_framework import viewsets, permissions
from .models import Course, ForumPost
from .serializers import CourseSerializer, ForumPostSerializer

class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 每个用户只能看自己的课程（等价于 Supabase RLS）
        return Course.objects.filter(user=self.request.user).order_by("day_of_week")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ForumPostViewSet(viewsets.ModelViewSet):
    serializer_class = ForumPostSerializer

    def get_permissions(self):
        # 浏览公开，发帖需登录
        if self.action in ["list", "retrieve"]:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
```

---

### 12.3 数据库与 ORM

| 库 | 版本 | 用途 |
|---|---|---|
| **PostgreSQL** | 15+ | 主数据库（与 Supabase 方案同款） |
| **SQLAlchemy** | ^2.0 | 异步 ORM（async/await），搭配 FastAPI |
| **alembic** | ^1.13 | 数据库版本迁移管理（对应 Supabase migrations） |
| **asyncpg** | ^0.29 | 异步 PostgreSQL 驱动（SQLAlchemy async 依赖） |
| **psycopg2-binary** | ^2.9 | 同步 PostgreSQL 驱动（Django ORM 依赖） |

**SQLAlchemy 核心模型示例：**

```python
# models/forum.py
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

class ForumPost(Base):
    __tablename__ = "forum_posts"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category   = Column(String, nullable=False)
    title      = Column(String, nullable=False)
    content    = Column(String, nullable=False)
    author_id  = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    is_pinned  = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)   # 软删除，等价于 Supabase 方案
    views      = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    author  = relationship("Profile", back_populates="posts")
    replies = relationship("ForumReply", back_populates="post", cascade="all, delete")
```

**Alembic 迁移流程（等价于 Supabase migrations）：**

```bash
# 初始化（项目内只做一次）
alembic init alembic

# 根据模型变更自动生成迁移文件
alembic revision --autogenerate -m "add_forum_posts_table"

# 执行迁移（等价于 supabase db push）
alembic upgrade head

# 回滚一个版本
alembic downgrade -1
```

---

### 12.4 认证与权限

| 库 | 版本 | 用途 |
|---|---|---|
| **PyJWT** | ^2.8 | JWT Token 编解码 |
| **passlib[bcrypt]** | ^1.7 | 密码 bcrypt 哈希 |
| **python-jose** | ^3.3 | 更完整的 JWK/JWS 支持 |

```python
# auth.py — JWT 认证核心
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = "your-secret-key-here"
ALGORITHM  = "HS256"
EXPIRE_MIN = 60 * 24 * 7    # 7 天有效期

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user = await db.get(Profile, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user

# 管理员权限依赖注入
async def require_admin(current_user: Profile = Depends(get_current_user)):
    if current_user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="无管理员权限")
    return current_user
```

---

### 12.5 实时功能（WebSocket）

小组讨论、私信推送、论坛回帖实时同步，Python 方案通过 WebSocket 实现：

#### FastAPI WebSocket 方案

| 库 | 版本 | 用途 |
|---|---|---|
| **fastapi** | ^0.111 | 内置 `WebSocket` 支持 |
| **redis** | ^5.0 | Pub/Sub 消息广播，支持多进程/多节点 |
| **aioredis** | ^2.0 | 异步 Redis 客户端 |

```python
# websocket/group_chat.py
from fastapi import WebSocket, WebSocketDisconnect, Query
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}   # group_id -> ws 列表

    async def connect(self, group_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(group_id, []).append(ws)

    def disconnect(self, group_id: str, ws: WebSocket):
        self.connections.get(group_id, []).remove(ws)

    async def broadcast(self, group_id: str, message: dict):
        for ws in self.connections.get(group_id, []):
            await ws.send_text(json.dumps(message, ensure_ascii=False))

manager = ConnectionManager()

@app.websocket("/ws/group/{group_id}")
async def group_chat(ws: WebSocket, group_id: str, token: str = Query(...)):
    user = await verify_ws_token(token)
    await manager.connect(group_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            msg = await save_group_message(group_id, user.id, data["content"])
            # 广播给小组所有在线成员（等价于 Supabase Realtime INSERT 事件）
            await manager.broadcast(group_id, {
                "id": str(msg.id),
                "content": msg.content,
                "author_name": user.full_name,
                "created_at": msg.created_at.isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(group_id, ws)
```

#### Django Channels 方案

| 库 | 版本 | 用途 |
|---|---|---|
| **channels** | ^4.1 | Django 异步/WebSocket 扩展 |
| **channels-redis** | ^4.2 | Redis Channel Layer，跨进程消息分发 |
| **daphne** | ^4.1 | ASGI 服务器（Django Channels 专配） |

---

### 12.6 异步任务（课程/任务提醒）

上课提醒、任务截止提醒通过 **Celery** 定时任务实现：

| 库 | 版本 | 用途 |
|---|---|---|
| **celery** | ^5.3 | 分布式异步任务队列 |
| **redis** | ^5.0 | Celery 消息 Broker |
| **celery-beat** | 内置 | 定时任务调度（crontab） |
| **flower** | ^2.0 | Celery 任务可视化监控面板 |

```python
# tasks/reminder.py
from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta

celery_app = Celery("study_platform", broker="redis://localhost:6379/0")

@celery_app.task
def send_course_reminder(user_id: str, course_name: str):
    """提前 15 分钟发送上课提醒"""
    send_email_task.delay(user_id, f"上课提醒：{course_name} 将在 15 分钟后开始")

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # 每天早 8 点检查当日截止任务
    sender.add_periodic_task(crontab(hour=8, minute=0), check_task_deadlines.s())

@celery_app.task
def check_task_deadlines():
    """查询 1 天内截止的任务并推送提醒"""
    deadline = datetime.utcnow() + timedelta(days=1)
    tasks = Task.query.filter(Task.due_date <= deadline, Task.status != "已完成").all()
    for task in tasks:
        send_course_reminder.delay(str(task.user_id), task.name)
```

---

### 12.7 文件上传与图片压缩

| 库 | 版本 | 用途 |
|---|---|---|
| **python-multipart** | ^0.0.9 | FastAPI 文件上传解析 |
| **Pillow** | ^10.x | 图片压缩（转 WEBP、限制 1080p、质量 0.8） |
| **boto3** | ^1.34 | 对接 AWS S3 或 MinIO（S3 兼容协议） |
| **minio** | ^7.2 | 直接对接 MinIO 对象存储 SDK |

```python
# services/storage_service.py
from PIL import Image
from io import BytesIO
import boto3, uuid

def compress_image(raw: bytes, max_px: int = 1920) -> bytes:
    """压缩图片：限制分辨率 → 转 WEBP → 质量 0.8（等价于前端 WEBP 压缩）"""
    img = Image.open(BytesIO(raw))
    if max(img.size) > max_px:
        img.thumbnail((max_px, max_px), Image.LANCZOS)
    out = BytesIO()
    img.save(out, format="WEBP", quality=80)
    return out.getvalue()

async def upload_file(file: UploadFile, bucket: str = "study-materials") -> str:
    content = await file.read()
    if file.content_type and file.content_type.startswith("image/"):
        content = compress_image(content)
    key = f"uploads/{uuid.uuid4()}.webp"
    s3_client.put_object(Bucket=bucket, Key=key, Body=content,
                         ContentType="image/webp")
    return f"https://cdn.example.com/{bucket}/{key}"
```

---

### 12.8 邮件服务

| 库 | 用途 |
|---|---|
| **smtplib**（内置） | Python 标准库 SMTP 发送，无需安装依赖 |
| **email.mime**（内置） | 构造 HTML 格式多部分邮件 |
| **fastapi-mail** | FastAPI 异步邮件扩展（SMTP / StartTLS） |
| **django.core.mail** | Django 内置邮件模块（配置 EMAIL_HOST 即用） |

```python
# services/email_service.py — 使用 smtplib 标准库
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def send_otp_email(to_email: str, code: str, smtp_cfg: dict):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "【学习管理平台】邮箱验证码"
    msg["From"]    = smtp_cfg["user"]
    msg["To"]      = to_email
    html = f"""
    <div style="font-family: sans-serif; padding: 24px;">
      <h2 style="color: #165DFF;">邮箱验证码</h2>
      <p>您的验证码为：<strong style="font-size: 28px;">{code}</strong></p>
      <p style="color: #999;">10 分钟内有效，请勿泄露。</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL(smtp_cfg["host"], smtp_cfg["port"]) as server:
        server.login(smtp_cfg["user"], smtp_cfg["password"])
        server.sendmail(smtp_cfg["user"], to_email, msg.as_string())
```

---

### 12.9 违禁词过滤（Python 实现）

```python
# services/keyword_filter.py
import re
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import KeywordFilter

async def check_content(db: AsyncSession, text: str) -> List[str]:
    """检测文本中的违禁词，返回命中词列表（等价于前端 useKeywordFilter Hook）"""
    result = await db.execute(select(KeywordFilter.word))
    hits = []
    for word in result.scalars():
        if re.search(re.escape(word), text, re.IGNORECASE):
            hits.append(word)
    return hits

# 在发帖路由中使用
@app.post("/api/forum/posts")
async def create_post(post: PostCreate,
                      user: Profile = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    hits = await check_content(db, post.content)
    if hits:
        raise HTTPException(400, f"内容包含违禁词：{'、'.join(hits[:3])}，请修改后提交")
    # 正常入库
    new_post = ForumPost(category=post.category, title=post.title,
                         content=post.content, author_id=user.id)
    db.add(new_post)
    await db.commit()
    return new_post
```

---

### 12.10 Python 项目目录结构

```
backend/                          # Python 后端根目录
├── app/
│   ├── main.py                   # FastAPI 应用入口（挂载所有 Router）
│   ├── config.py                 # 配置管理（pydantic-settings，读 .env）
│   ├── database.py               # SQLAlchemy 异步引擎 + Session 工厂
│   ├── models/                   # 数据库模型（等价于 supabase/migrations）
│   │   ├── profile.py            # 用户模型（role、banned_until）
│   │   ├── course.py             # 课程模型
│   │   ├── task.py               # 任务模型（三级提醒、状态流转）
│   │   ├── material.py           # 学习资料模型
│   │   ├── goal.py               # 目标/打卡模型
│   │   ├── forum.py              # 论坛帖子/回复（软删除）
│   │   ├── message.py            # 私信/小组消息
│   │   └── keyword_filter.py     # 违禁词模型
│   ├── schemas/                  # Pydantic 请求/响应 Schema
│   │   ├── auth.py
│   │   ├── course.py
│   │   ├── forum.py
│   │   └── ...
│   ├── routers/                  # API 路由（按功能模块拆分）
│   │   ├── auth.py               # 登录/注册/OTP 发送与校验
│   │   ├── courses.py            # 课程 CRUD + 冲突检测
│   │   ├── tasks.py              # 任务管理 + 状态流转
│   │   ├── materials.py          # 资料上传/下载
│   │   ├── goals.py              # 目标与打卡
│   │   ├── forum.py              # 帖子/回复（软删除、批量删除）
│   │   ├── messages.py           # 私信收发
│   │   ├── study_groups.py       # 小组学习（创建/加入/公告）
│   │   ├── admin.py              # 管理员操作（封禁/重置/批量删帖）
│   │   └── notifications.py      # 站内通知
│   ├── services/                 # 业务逻辑层（解耦路由与数据库）
│   │   ├── auth_service.py
│   │   ├── email_service.py
│   │   ├── storage_service.py
│   │   └── keyword_filter.py
│   ├── websocket/                # WebSocket 实时功能
│   │   ├── manager.py            # 连接管理器（ConnectionManager）
│   │   ├── group_chat.py         # 小组讨论实时同步
│   │   └── private_msg.py        # 私信实时推送
│   └── tasks/                    # Celery 异步任务
│       ├── celery_app.py
│       ├── reminder.py           # 上课/任务截止提醒
│       └── email_tasks.py        # 异步发邮件任务
├── alembic/                      # 数据库版本迁移（等价于 supabase/migrations）
│   ├── env.py
│   └── versions/
│       ├── 001_init_schema.py
│       ├── 002_add_forum.py
│       └── ...
├── tests/
│   ├── test_auth.py
│   ├── test_courses.py
│   └── test_forum.py
├── .env                          # 环境变量（DB_URL、SECRET_KEY、SMTP 等）
├── requirements.txt
├── Dockerfile
└── docker-compose.yml            # PostgreSQL + Redis + 后端一键启动
```

---

### 12.11 Python 依赖汇总（requirements.txt）

```txt
# ── Web 框架 ──────────────────────────────────
fastapi==0.111.0
uvicorn[standard]==0.29.0

# ── 数据库 ────────────────────────────────────
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1

# ── 认证 ──────────────────────────────────────
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9

# ── 数据校验 ──────────────────────────────────
pydantic==2.7.1
pydantic-settings==2.2.1
email-validator==2.1.1

# ── WebSocket / 实时 ──────────────────────────
websockets==12.0

# ── 异步任务 ──────────────────────────────────
celery[redis]==5.3.6
redis==5.0.4

# ── 文件处理 ──────────────────────────────────
Pillow==10.3.0
boto3==1.34.99      # S3 / MinIO 对象存储

# ── 邮件 ──────────────────────────────────────
fastapi-mail==1.4.1

# ── 环境变量 ──────────────────────────────────
python-dotenv==1.0.1

# ── 测试 ──────────────────────────────────────
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0       # FastAPI 异步测试客户端

# ── 代码质量 ──────────────────────────────────
ruff==0.4.4         # Linter（等价于前端 Biome）
black==24.4.2       # 代码格式化
mypy==1.10.0        # 静态类型检查（等价于 TypeScript strict 模式）
```

---

### 12.12 Python 方案 vs 现有 JS/TS 方案对比

| 维度 | Supabase + Deno 方案（线上版） | Python 方案（作业版） |
|---|---|---|
| **开发速度** | ⚡ 极快（Supabase 托管所有后端） | 🔧 较慢（需自建 ORM、Auth、Storage） |
| **学习曲线** | 低（Supabase Dashboard 友好） | 中（需掌握 FastAPI/Django + SQLAlchemy + Alembic） |
| **灵活度** | 低（依赖 Supabase 生态约束） | 高（完全可控，逻辑可深度定制） |
| **适合场景** | 快速原型、生产 SaaS 产品 | **课程作业、毕业设计、工程能力展示** ✅ |
| **部署复杂度** | 极低（Supabase 全托管） | 中（需自行配置 Gunicorn + Nginx + PostgreSQL + Redis） |
| **实时功能** | 开箱即用（Realtime Postgres Changes） | 需自行实现 WebSocket + Redis Pub/Sub |
| **安全策略** | RLS（数据库行级安全，声明式） | Depends 依赖注入 / Django Permission 类 |
| **Python 技能体现** | ❌ 无 Python 代码 | ✅ 完整展示 FastAPI / SQLAlchemy / Celery 能力 |
