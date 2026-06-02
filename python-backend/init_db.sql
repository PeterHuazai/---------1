-- ============================================================
-- 大学生学习管理平台 — MySQL 数据库初始化脚本
-- 执行方式：在 MySQL 命令行或 Navicat 等工具中运行本文件
-- 注意：请先手动创建数据库，再执行以下建表语句
-- ============================================================

-- ── 步骤 1：创建数据库（如果不存在） ──────────────────────────
-- 使用 utf8mb4 字符集支持中文和 emoji
CREATE DATABASE IF NOT EXISTS campus_platform
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

-- 切换到该数据库
USE campus_platform;

-- ── 步骤 2：删除旧表（开发阶段方便重置，生产环境请注释掉） ─────
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS email_logs;
-- DROP TABLE IF EXISTS checkins;
-- DROP TABLE IF EXISTS goals;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS courses;
-- DROP TABLE IF EXISTS users;

-- ── 步骤 3：创建用户表 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT '用户唯一标识 UUID',
    username     VARCHAR(50)  NOT NULL UNIQUE       COMMENT '登录用户名，唯一',
    password_hash VARCHAR(100) NOT NULL             COMMENT 'bcrypt 加密后的密码，禁止明文存储',
    full_name    VARCHAR(50)  DEFAULT NULL          COMMENT '真实姓名',
    school       VARCHAR(100) DEFAULT NULL          COMMENT '所在学校名称',
    major        VARCHAR(100) DEFAULT NULL          COMMENT '所学专业',
    grade        VARCHAR(20)  DEFAULT NULL          COMMENT '年级，如 2023级',
    email        VARCHAR(100) DEFAULT NULL          COMMENT '绑定邮箱，用于接收提醒邮件',
    avatar_url   VARCHAR(500) DEFAULT NULL          COMMENT '头像图片 URL',
    role         ENUM('student','admin') NOT NULL DEFAULT 'student' COMMENT '用户角色',
    is_active    TINYINT(1)   NOT NULL DEFAULT 1   COMMENT '账号是否激活：1=激活，0=禁用',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    INDEX ix_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账号信息表';

-- ── 步骤 4：创建课程表 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT '课程 UUID',
    user_id          VARCHAR(36)  NOT NULL             COMMENT '所属用户 ID',
    name             VARCHAR(100) NOT NULL             COMMENT '课程名称',
    day_of_week      TINYINT      NOT NULL             COMMENT '星期几：0=周一，6=周日',
    start_time       VARCHAR(5)   NOT NULL             COMMENT '开始时间，格式 HH:MM',
    end_time         VARCHAR(5)   NOT NULL             COMMENT '结束时间，格式 HH:MM',
    location         VARCHAR(100) DEFAULT NULL         COMMENT '上课地点，如 教学楼A-301',
    teacher          VARCHAR(50)  DEFAULT NULL         COMMENT '任课老师姓名',
    credits          FLOAT        DEFAULT NULL         COMMENT '课程学分',
    course_type      VARCHAR(20)  DEFAULT NULL         COMMENT '课程类型：必修/选修/通识/实践等',
    color            VARCHAR(7)   DEFAULT NULL         COMMENT '课程颜色标签，十六进制如 #165DFF',
    start_week       TINYINT      DEFAULT NULL         COMMENT '起始周次，如第 1 周',
    end_week         TINYINT      DEFAULT NULL         COMMENT '结束周次，如第 18 周',
    reminder_minutes INT          DEFAULT 15           COMMENT '上课前多少分钟发提醒，0=不提醒',
    notes            TEXT         DEFAULT NULL         COMMENT '课程备注',
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_courses_user_day (user_id, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程信息表，支持周次和时间冲突检测';

-- ── 步骤 5：创建任务表（作业/考试/实验等） ──────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id            VARCHAR(36)   NOT NULL PRIMARY KEY COMMENT '任务 UUID',
    user_id       VARCHAR(36)   NOT NULL              COMMENT '所属用户 ID',
    course_id     VARCHAR(36)   DEFAULT NULL          COMMENT '关联课程 ID（可为空）',
    course_name   VARCHAR(100)  DEFAULT NULL          COMMENT '课程名称冗余，避免联表',
    name          VARCHAR(200)  NOT NULL              COMMENT '任务名称',
    type          ENUM('homework','exam','lab','paper','quiz','other') NOT NULL DEFAULT 'homework' COMMENT '任务类型',
    due_date      DATETIME      NOT NULL              COMMENT '截止时间或考试时间',
    submit_method VARCHAR(100)  DEFAULT NULL          COMMENT '提交方式：纸质/网上/现场等',
    weight        FLOAT         DEFAULT NULL          COMMENT '成绩占比，如 30.0 代表占总评 30%',
    notes         TEXT          DEFAULT NULL          COMMENT '任务备注',
    status        ENUM('pending','in_progress','done','expired') NOT NULL DEFAULT 'pending' COMMENT '任务状态',
    reminder_3d   TINYINT(1)    NOT NULL DEFAULT 1   COMMENT '是否在截止前 3 天提醒',
    reminder_1d   TINYINT(1)    NOT NULL DEFAULT 1   COMMENT '是否在截止前 1 天提醒',
    reminder_1h   TINYINT(1)    NOT NULL DEFAULT 0   COMMENT '是否在截止前 1 小时提醒',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    INDEX ix_tasks_user_due (user_id, due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习任务表（作业/考试/实验报告等）';

-- ── 步骤 6：创建学习目标表 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT '目标 UUID',
    user_id      VARCHAR(36)  NOT NULL              COMMENT '所属用户 ID',
    name         VARCHAR(100) NOT NULL              COMMENT '目标名称，如 每日背50个单词',
    description  TEXT         DEFAULT NULL          COMMENT '目标详细描述',
    period       ENUM('daily','weekly','monthly') NOT NULL DEFAULT 'daily' COMMENT '目标周期',
    target_value INT          NOT NULL DEFAULT 60  COMMENT '目标数值，如每日学习 60 分钟',
    unit         VARCHAR(20)  NOT NULL DEFAULT '分钟' COMMENT '数值单位：分钟/次/页等',
    category     VARCHAR(50)  NOT NULL DEFAULT '学习' COMMENT '目标分类：学习/运动/阅读等',
    is_active    TINYINT(1)   NOT NULL DEFAULT 1   COMMENT '是否启用：1=启用，0=停用',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习目标设置表';

-- ── 步骤 7：创建打卡记录表 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
    id               VARCHAR(36) NOT NULL PRIMARY KEY COMMENT '打卡记录 UUID',
    goal_id          VARCHAR(36) NOT NULL              COMMENT '关联学习目标 ID',
    user_id          VARCHAR(36) NOT NULL              COMMENT '打卡用户 ID',
    checkin_date     VARCHAR(10) NOT NULL              COMMENT '打卡日期，格式 YYYY-MM-DD',
    duration_minutes INT         NOT NULL DEFAULT 0   COMMENT '本次学习时长（分钟）',
    notes            TEXT        DEFAULT NULL          COMMENT '打卡备注，如学习心得',
    created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '打卡时间',
    FOREIGN KEY (goal_id)  REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_checkins_user_date (user_id, checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习打卡记录表';

-- ── 步骤 8：创建邮件发送日志表 ────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
    id         VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT '日志 UUID',
    user_id    VARCHAR(36)  DEFAULT NULL          COMMENT '发送给哪个用户（可为空）',
    to_email   VARCHAR(100) NOT NULL              COMMENT '收件人邮箱地址',
    subject    VARCHAR(200) NOT NULL              COMMENT '邮件主题',
    status     VARCHAR(10)  NOT NULL              COMMENT '发送状态：success=成功，failed=失败',
    error_msg  TEXT         DEFAULT NULL          COMMENT '发送失败时的错误信息',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_email_logs_user (user_id),
    INDEX ix_email_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件发送日志表，用于记录每次发送结果';

-- ── 步骤 9：创建站内通知表 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         VARCHAR(36)  NOT NULL PRIMARY KEY COMMENT '通知 UUID',
    user_id    VARCHAR(36)  NOT NULL              COMMENT '接收通知的用户 ID',
    title      VARCHAR(200) NOT NULL              COMMENT '通知标题',
    content    TEXT         NOT NULL              COMMENT '通知正文内容',
    type       VARCHAR(20)  NOT NULL DEFAULT 'system' COMMENT '通知类型：course=上课提醒，task=任务提醒，system=系统通知',
    is_read    TINYINT(1)   NOT NULL DEFAULT 0   COMMENT '是否已读：0=未读，1=已读',
    related_id VARCHAR(36)  DEFAULT NULL          COMMENT '关联的课程或任务 UUID（可为空）',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '通知创建时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_notifications_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内通知表（上课/任务/系统通知）';

-- ── 步骤 10：插入默认管理员账号 ───────────────────────────────
-- 默认管理员：用户名 admin，密码 Admin@123456
-- 密码哈希值由 bcrypt 生成，可在应用启动后通过 API 修改密码
INSERT IGNORE INTO users (id, username, password_hash, full_name, role, is_active)
VALUES (
    UUID(),
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN9A6sLYePNBKNQjSx.iy',
    '系统管理员',
    'admin',
    1
);

-- ── 完成提示 ──────────────────────────────────────────────────
SELECT '✅ 数据库初始化完成！共创建 7 张表。' AS 提示信息;
SELECT TABLE_NAME AS 表名, TABLE_COMMENT AS 说明
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'campus_platform'
ORDER BY TABLE_NAME;
