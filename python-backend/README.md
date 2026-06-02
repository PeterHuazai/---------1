# 大学生学习管理平台 — Python 后端微服务

基于 **FastAPI + SQLAlchemy + MySQL** 构建，提供完整的学习管理后端 API。

## 功能模块

| 模块 | 说明 | 接口前缀 |
|------|------|---------|
| 用户认证 | 注册 / 登录 / JWT Token | `/auth` |
| 课程管理 | 增删改查 + 时间冲突检测 | `/courses` |
| 任务管理 | 作业/考试/实验报告管理 | `/tasks` |
| 打卡计划 | 学习目标设置 + 打卡记录 | `/goals` |
| 邮件发送 | 163 SMTP + 发送日志 | `/email` |
| 学习报告 | 周报/月报生成 + 邮件推送 | `/report` |
| 智能建议 | 个性化学习建议 + 综合评分 | `/advice` |

---

## 本地启动步骤

### 1. 前置要求

- Python 3.10 及以上
- MySQL 5.7 或 MySQL 8.0（本地已安装并运行）
- pip 或 conda

### 2. 安装依赖

```bash
# 进入 python-backend 目录
cd python-backend

# 创建虚拟环境（推荐，避免污染全局环境）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# 安装所有依赖（包含 FastAPI + Streamlit + Plotly）
pip install -r requirements.txt
```

### 3. 初始化 MySQL 数据库

#### 方式一：使用 SQL 脚本（推荐）

打开 MySQL 命令行或 Navicat，执行：

```sql
-- 在 MySQL 客户端中运行：
source /path/to/python-backend/init_db.sql
```

或者直接粘贴 `init_db.sql` 文件内容执行。

执行成功后会看到：
```
✅ 数据库初始化完成！共创建 7 张表。
```

#### 方式二：启动服务时自动建表

配置好 `.env` 后直接启动服务，FastAPI 会自动调用 `create_all()` 建表。

### 4. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# MySQL 连接（改为你的 MySQL 用户名和密码）
DATABASE_URL=mysql+pymysql://root:你的MySQL密码@localhost:3306/campus_platform

# 163 邮箱授权码（登录 163 网页邮箱 → 设置 → POP3/SMTP → 开启 → 生成授权码）
EMAIL_USER=你的163邮箱@163.com
EMAIL_PASS=你的163授权码

# JWT 密钥（随意填写一串随机字符，长度 32 位以上）
SECRET_KEY=my_random_secret_key_for_local_dev_12345
```

### 5. 启动服务

#### 方式一：启动 FastAPI 后端（REST API）

```bash
# 确保已激活虚拟环境，在 python-backend 目录下运行：
python main.py
```

启动成功后输出：
```
INFO  正在连接 MySQL 数据库并初始化表结构...
INFO  ✅ 数据库表初始化完成
INFO  🚀 服务启动成功，访问地址：http://0.0.0.0:8000
INFO  📖 接口文档：http://localhost:8000/docs
```

#### 方式二：启动 Streamlit 可视化界面（推荐用于作业演示）

```bash
# 在 python-backend 目录下运行：
streamlit run streamlit_app/app.py
```

启动成功后输出：
```
You can now view your Streamlit app in your browser.
Local URL: http://localhost:8501
```

> 💡 **Streamlit 和 FastAPI 是独立进程，可以同时运行（分别在不同终端窗口启动）。**
> - FastAPI 端口：**8000**（REST API，供前端调用）
> - Streamlit 端口：**8501**（可视化界面，直接用浏览器操作）

---

## 快速测试

### 注册用户

```bash
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "Test@123", "email": "test@example.com"}'
```

### 登录获取 Token

```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=Test@123"
```

### 添加课程（需要 Token）

```bash
curl -X POST "http://localhost:8000/courses/" \
  -H "Authorization: Bearer <你的Token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "数据结构",
    "day_of_week": 0,
    "start_time": "08:00",
    "end_time": "09:40",
    "teacher": "张老师",
    "location": "教学楼A-301",
    "credits": 3.0,
    "start_week": 1,
    "end_week": 16
  }'
```

### 课程冲突检测

```bash
curl -X POST "http://localhost:8000/courses/conflict-check" \
  -H "Authorization: Bearer <你的Token>"
```

### 获取学习周报

```bash
curl "http://localhost:8000/report?period=week" \
  -H "Authorization: Bearer <你的Token>"
```

### 获取智能学习建议

```bash
curl "http://localhost:8000/advice" \
  -H "Authorization: Bearer <你的Token>"
```

---

## 项目结构

```
python-backend/
├── main.py                  # FastAPI 应用入口，路由注册，CORS 配置
├── config.py                # 配置管理（读取 .env 环境变量）
├── database.py              # SQLAlchemy 引擎、会话工厂、依赖注入
├── init_db.sql              # MySQL 数据库初始化脚本（建表 + 初始数据）
├── requirements.txt         # Python 依赖清单
├── .env.example             # 环境变量模板（复制为 .env 后填写）
│
├── models/
│   ├── __init__.py
│   └── orm_models.py        # SQLAlchemy ORM 模型（7 张表）
│
├── routers/
│   ├── __init__.py
│   ├── auth.py              # 注册/登录/JWT 认证
│   ├── courses.py           # 课程 CRUD + 冲突检测
│   ├── tasks.py             # 任务 CRUD + 状态管理
│   ├── goals.py             # 学习目标 + 打卡记录
│   └── features.py          # 邮件发送 / 学习报告 / 智能建议
│
└── services/
    ├── __init__.py
    ├── email_service.py     # 163 SMTP 邮件发送服务（含 HTML 模板）
    ├── conflict_service.py  # 课程时间冲突检测算法
    ├── report_service.py    # 学习统计报告生成（周报/月报）
    └── advice_service.py    # 智能学习建议（规则引擎，0 依赖）
```

---

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户账号（用户名、密码哈希、邮箱、头像等） |
| `courses` | 课程表（名称、时间、地点、老师、周次等） |
| `tasks` | 任务表（作业/考试/实验报告，含截止时间） |
| `goals` | 学习目标（每日/每周/每月目标设置） |
| `checkins` | 打卡记录（关联目标，记录时长和备注） |
| `email_logs` | 邮件发送日志（成功/失败记录） |
| `notifications` | 站内通知（上课提醒/任务提醒/系统通知） |

---

## 163 邮箱授权码获取方法

1. 登录 [https://mail.163.com](https://mail.163.com)
2. 点击右上角「设置」→「POP3/SMTP/IMAP」
3. 开启「SMTP 服务」
4. 点击「生成授权码」，按提示用手机验证
5. 复制生成的授权码，填入 `.env` 的 `EMAIL_PASS` 字段

> ⚠️ 授权码不是登录密码！请妥善保管，不要上传到 Git。

---

## 常见问题

**Q: 启动报错 `Access denied for user`**  
A: 检查 `DATABASE_URL` 中的用户名和密码是否正确。

**Q: 启动报错 `Unknown database 'campus_platform'`**  
A: 先执行 `init_db.sql` 创建数据库，或手动执行：
```sql
CREATE DATABASE campus_platform DEFAULT CHARACTER SET utf8mb4;
```

**Q: 发邮件报错 `SMTPAuthenticationError`**  
A: 确认 `EMAIL_PASS` 填写的是授权码（16位字母），不是邮箱登录密码。

**Q: Token 过期怎么办**  
A: 重新调用 `/auth/login` 获取新 Token，默认有效期 7 天。
