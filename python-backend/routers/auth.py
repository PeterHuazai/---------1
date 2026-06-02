"""
============================================================
用户认证路由模块
提供注册、登录、获取当前用户信息等接口
============================================================
"""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt                  # JWT 生成与验证
from passlib.context import CryptContext        # 密码哈希
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

from database import get_db
from models.orm_models import User, UserRole
from config import settings

logger = logging.getLogger(__name__)

# ── 路由实例 ──────────────────────────────────────────────────
# prefix="/auth" 表示所有路由路径以 /auth 开头
# tags=["认证"] 用于 Swagger 文档分组
router = APIRouter(prefix="/auth", tags=["认证"])

# ── 密码哈希工具 ──────────────────────────────────────────────
# bcrypt 是目前最安全的密码哈希算法之一，自带盐值
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── OAuth2 Bearer Token 配置 ──────────────────────────────────
# tokenUrl 指向登录接口路径
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── 工具函数 ──────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """将明文密码加密为 bcrypt 哈希值"""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证明文密码与哈希值是否匹配"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """
    生成 JWT Access Token

    Args:
        data: 要编码到 Token 中的数据（通常包含 user_id）

    Returns:
        str: 签名后的 JWT 字符串
    """
    to_encode = data.copy()
    # 设置 Token 过期时间
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    # 使用 HS256 算法和密钥签名
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI 依赖项：从 Bearer Token 中解析并返回当前登录用户

    用法：在需要认证的路由函数中加入 current_user: User = Depends(get_current_user)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已过期或 Token 无效，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 解码 JWT Token
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 从数据库查询用户
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


# ── 请求/响应数据模型 ─────────────────────────────────────────

class RegisterRequest(BaseModel):
    """用户注册请求体"""
    username:  str   = Field(..., min_length=3, max_length=50, description="用户名（3-50位字母数字）")
    password:  str   = Field(..., min_length=6, max_length=50, description="密码（至少6位）")
    full_name: Optional[str]      = Field(None, description="真实姓名（可选）")
    email:     Optional[EmailStr] = Field(None, description="邮箱（可选，用于接收提醒）")


class LoginResponse(BaseModel):
    """登录成功响应体"""
    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    username:     str
    role:         str


class UserProfileResponse(BaseModel):
    """用户信息响应体"""
    id:         str
    username:   str
    full_name:  Optional[str]
    school:     Optional[str]
    major:      Optional[str]
    grade:      Optional[str]
    email:      Optional[str]
    avatar_url: Optional[str]
    role:       str
    created_at: str

    class Config:
        from_attributes = True  # 允许从 ORM 对象直接转换


class UpdateProfileRequest(BaseModel):
    """更新用户资料请求体（所有字段可选）"""
    full_name:  Optional[str]      = None
    school:     Optional[str]      = None
    major:      Optional[str]      = None
    grade:      Optional[str]      = None
    email:      Optional[EmailStr] = None
    avatar_url: Optional[str]      = None


# ── API 接口 ──────────────────────────────────────────────────

@router.post("/register", summary="用户注册")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    注册新用户

    - 检查用户名是否已被占用
    - 密码使用 bcrypt 加密后存储
    - 注册成功后返回 JWT Token（可直接登录）
    """
    # 检查用户名是否已存在
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"用户名 '{req.username}' 已被占用，请换一个"
        )

    # 创建新用户，密码哈希存储
    new_user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        email=req.email,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)   # 刷新获取数据库生成的字段（如 created_at）

    logger.info(f"新用户注册成功：{req.username}")

    # 注册后自动生成 Token
    token = create_access_token({"sub": new_user.id})
    return {
        "message":      "注册成功",
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      new_user.id,
        "username":     new_user.username,
    }


@router.post("/login", response_model=LoginResponse, summary="用户登录")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    用户登录（支持表单提交，兼容 OAuth2 标准）

    - 验证用户名和密码
    - 登录成功返回 JWT Token
    - Token 默认有效期 7 天
    """
    # 查询用户
    user = db.query(User).filter(User.username == form_data.username).first()

    # 用户不存在或密码错误（统一提示，避免泄露用户是否存在的信息）
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用，请联系管理员"
        )

    token = create_access_token({"sub": user.id})
    logger.info(f"用户登录成功：{user.username}")

    return LoginResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        role=user.role.value,
    )


@router.get("/me", response_model=UserProfileResponse, summary="获取当前用户信息")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户的完整信息"""
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        school=current_user.school,
        major=current_user.major,
        grade=current_user.grade,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        role=current_user.role.value,
        created_at=current_user.created_at.isoformat() if current_user.created_at else "",
    )


@router.put("/me", summary="更新当前用户资料")
def update_me(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新当前登录用户的个人资料（仅修改提交的字段）"""
    # 只更新请求中非 None 的字段
    update_data = req.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return {"message": "资料更新成功"}
