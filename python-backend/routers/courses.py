"""
============================================================
课程管理路由模块
提供课程的增删改查接口，以及课程冲突检测
============================================================
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from models.orm_models import Course, User
from routers.auth import get_current_user
from services.conflict_service import conflict_detector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/courses", tags=["课程管理"])


# ── 请求/响应数据模型 ─────────────────────────────────────────

class CourseCreate(BaseModel):
    """创建课程请求体"""
    name:             str           = Field(..., min_length=1, max_length=100, description="课程名称")
    day_of_week:      int           = Field(..., ge=0, le=6, description="星期几：0=周一，6=周日")
    start_time:       str           = Field(..., pattern=r"^\d{2}:\d{2}$", description="开始时间 HH:MM")
    end_time:         str           = Field(..., pattern=r"^\d{2}:\d{2}$", description="结束时间 HH:MM")
    location:         Optional[str] = None
    teacher:          Optional[str] = None
    credits:          Optional[float] = None
    course_type:      Optional[str] = None
    color:            Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    start_week:       Optional[int] = Field(None, ge=1, le=25)
    end_week:         Optional[int] = Field(None, ge=1, le=25)
    reminder_minutes: Optional[int] = Field(15, ge=0)
    notes:            Optional[str] = None


class CourseResponse(BaseModel):
    """课程信息响应体"""
    id:               str
    user_id:          str
    name:             str
    day_of_week:      int
    start_time:       str
    end_time:         str
    location:         Optional[str]
    teacher:          Optional[str]
    credits:          Optional[float]
    course_type:      Optional[str]
    color:            Optional[str]
    start_week:       Optional[int]
    end_week:         Optional[int]
    reminder_minutes: Optional[int]
    notes:            Optional[str]
    created_at:       str

    class Config:
        from_attributes = True


# ── API 接口 ──────────────────────────────────────────────────

@router.get("/", response_model=List[CourseResponse], summary="获取我的所有课程")
def list_courses(
    day_of_week: Optional[int] = None,   # 可按星期筛选
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有课程，可按星期筛选"""
    query = db.query(Course).filter(Course.user_id == current_user.id)
    if day_of_week is not None:
        query = query.filter(Course.day_of_week == day_of_week)
    courses = query.order_by(Course.day_of_week, Course.start_time).all()
    return [_course_to_response(c) for c in courses]


@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED, summary="添加课程")
def create_course(
    req: CourseCreate,
    check_conflict: bool = True,         # 查询参数：是否检测冲突，默认开启
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    添加新课程

    - check_conflict=true（默认）：自动检测与已有课程的时间冲突
    - 存在冲突时返回 409 并说明冲突详情
    - check_conflict=false：跳过检测，强制添加
    """
    # 验证时间合法性（开始时间 < 结束时间）
    if req.start_time >= req.end_time:
        raise HTTPException(status_code=400, detail="开始时间必须早于结束时间")

    if check_conflict:
        # 调用冲突检测服务检测新课程与已有课程的冲突
        result = conflict_detector.detect(
            db=db,
            user_id=current_user.id,
            new_course_data={
                "id":          "new",
                "name":        req.name,
                "day_of_week": req.day_of_week,
                "start_time":  req.start_time,
                "end_time":    req.end_time,
                "start_week":  req.start_week,
                "end_week":    req.end_week,
            },
        )
        if result["has_conflict"]:
            # 返回 409 冲突状态码，前端可提示用户确认
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "课程时间存在冲突",
                    "conflicts": result["conflicts"],
                    "hint": "若确认添加，请在请求中加 ?check_conflict=false",
                },
            )

    # 创建课程记录
    course = Course(
        user_id=current_user.id,
        **req.model_dump(),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    logger.info(f"用户 {current_user.username} 添加课程：{req.name}")
    return _course_to_response(course)


@router.get("/{course_id}", response_model=CourseResponse, summary="获取课程详情")
def get_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定课程详情（只能查看自己的课程）"""
    course = _get_user_course(db, course_id, current_user.id)
    return _course_to_response(course)


@router.put("/{course_id}", response_model=CourseResponse, summary="修改课程")
def update_course(
    course_id: str,
    req: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改指定课程信息"""
    course = _get_user_course(db, course_id, current_user.id)
    for field, value in req.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return _course_to_response(course)


@router.delete("/{course_id}", summary="删除课程")
def delete_course(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除指定课程（软删除暂未实现，直接物理删除）"""
    course = _get_user_course(db, course_id, current_user.id)
    db.delete(course)
    db.commit()
    logger.info(f"用户 {current_user.username} 删除课程：{course.name}")
    return {"message": "课程删除成功"}


@router.post("/conflict-check", summary="全量课程冲突检测")
def check_all_conflicts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """检测当前用户所有已有课程之间的时间冲突"""
    result = conflict_detector.detect(db=db, user_id=current_user.id)
    return result


# ── 内部工具函数 ──────────────────────────────────────────────

def _get_user_course(db: Session, course_id: str, user_id: str) -> Course:
    """查询课程，不存在或不属于当前用户则抛出 404"""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.user_id == user_id,
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    return course


def _course_to_response(c: Course) -> CourseResponse:
    """ORM 对象转响应体"""
    return CourseResponse(
        id=c.id, user_id=c.user_id, name=c.name,
        day_of_week=c.day_of_week, start_time=c.start_time, end_time=c.end_time,
        location=c.location, teacher=c.teacher, credits=c.credits,
        course_type=c.course_type, color=c.color,
        start_week=c.start_week, end_week=c.end_week,
        reminder_minutes=c.reminder_minutes, notes=c.notes,
        created_at=c.created_at.isoformat() if c.created_at else "",
    )
