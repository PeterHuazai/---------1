"""
============================================================
SQLAlchemy 数据库连接与会话管理模块
负责创建 MySQL 连接引擎和提供数据库会话依赖
============================================================
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# ── 创建 MySQL 连接引擎 ───────────────────────────────────────
# pool_pre_ping=True：每次使用连接前检测连接是否存活，避免"MySQL server has gone away"错误
# pool_recycle=3600：连接池中的连接每隔 1 小时重建，防止 MySQL 自动断开长时间空闲连接
# pool_size=10：连接池保持 10 个常驻连接
# max_overflow=20：连接池满时最多额外创建 20 个连接
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    echo=settings.debug,  # debug 模式下打印所有 SQL 语句，方便调试
)

# ── 创建会话工厂 ──────────────────────────────────────────────
# autocommit=False：需要手动提交事务，保证数据一致性
# autoflush=False：不自动将内存中的修改写入数据库，由代码显式控制
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── 声明式基类 ────────────────────────────────────────────────
# 所有 ORM 模型类都继承自 Base，SQLAlchemy 会自动识别这些类对应的数据表
Base = declarative_base()


def get_db():
    """
    FastAPI 依赖注入函数，提供数据库会话

    使用 yield 实现上下文管理：
    - 请求进来时创建一个新的数据库会话
    - 请求处理完毕后（无论成功还是异常）自动关闭会话，归还连接到连接池

    使用方式（在路由函数中）：
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            results = db.query(SomeModel).all()
            return results
    """
    db = SessionLocal()
    try:
        yield db          # 将 db 会话注入到路由函数
    finally:
        db.close()        # 请求结束后关闭会话，释放连接
