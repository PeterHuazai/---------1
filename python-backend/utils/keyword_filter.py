"""
============================================================
关键词过滤工具模块
从数据库读取黑白名单，对提交的文本内容进行检测
白名单优先：若内容同时命中白名单词，则不触发黑名单拦截
============================================================
"""

import logging
from functools import lru_cache
from typing import List
from sqlalchemy.orm import Session

from models.orm_models import KeywordFilter

logger = logging.getLogger(__name__)


def check_keywords(text: str, db: Session) -> List[str]:
    """
    检测文本中是否含有黑名单关键词

    逻辑：
    1. 从数据库读取全部黑名单和白名单关键词
    2. 将文本转小写后逐一匹配黑名单
    3. 若同时命中白名单关键词（豁免词），则该黑名单词不触发
    4. 返回命中的黑名单关键词列表（空列表=通过）

    Args:
        text: 待检测的文本内容
        db:   数据库会话

    Returns:
        List[str]: 命中的违禁关键词列表，空列表表示内容合规
    """
    if not text or not text.strip():
        return []

    # 查询全部黑白名单（不做缓存，管理员更新后立即生效）
    rows = db.query(KeywordFilter).all()

    blacklist: List[str] = []
    whitelist: List[str] = []
    for row in rows:
        if row.list_type == "blacklist":
            blacklist.append(row.keyword.lower())
        elif row.list_type == "whitelist":
            whitelist.append(row.keyword.lower())

    if not blacklist:
        return []  # 尚未配置黑名单，直接通过

    lower_text = text.lower()

    # 检查白名单命中（任一白名单词命中则全部豁免）
    in_whitelist = any(ww in lower_text for ww in whitelist)
    if in_whitelist:
        return []

    # 检测黑名单命中
    hits = [bw for bw in blacklist if bw in lower_text]
    if hits:
        logger.warning(f"关键词过滤命中：{hits}，原文（截断）：{text[:50]!r}")

    return hits
