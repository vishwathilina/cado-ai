from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.config import settings
from app.database import get_db
from app.models import RefreshSession, User
from app.schemas import LoginRequest, UserCreate, UserView
from app.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_csrf_token,
    new_refresh_token,
    verify_password,
)
from app.utils import as_utc

router = APIRouter(prefix="/auth", tags=["auth"])


def cookie_options() -> dict:
    return {
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
    }


def set_session_cookies(response: Response, user: User, refresh: str, csrf: str) -> None:
    common = cookie_options()
    response.set_cookie(
        "access_token",
        create_access_token(user.id),
        httponly=True,
        max_age=settings.access_token_minutes * 60,
        **common,
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        max_age=settings.refresh_token_days * 86400,
        **common,
    )
    response.set_cookie(
        "csrf_token",
        csrf,
        httponly=False,
        max_age=settings.refresh_token_days * 86400,
        **common,
    )


def clear_session_cookies(response: Response) -> None:
    common = cookie_options()
    response.delete_cookie("access_token", httponly=True, **common)
    response.delete_cookie("refresh_token", httponly=True, **common)
    response.delete_cookie("csrf_token", httponly=False, **common)


def expired_session(detail: str, status_code: int = 401) -> JSONResponse:
    response = JSONResponse({"detail": detail}, status_code=status_code)
    clear_session_cookies(response)
    return response


async def create_session(db: AsyncSession, response: Response, user: User) -> None:
    refresh, token_hash = new_refresh_token()
    db.add(
        RefreshSession(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    await db.commit()
    set_session_cookies(response, user, refresh, new_csrf_token())


@router.post("/register", response_model=UserView, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    if await db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    await create_session(db, response, user)
    return user


@router.post("/login", response_model=UserView)
async def login(
    payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
) -> User:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    await create_session(db, response, user)
    return user


@router.post("/refresh", response_model=UserView)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    csrf_cookie: str | None = Cookie(default=None, alias="csrf_token"),
    x_csrf_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | JSONResponse:
    if not refresh_token or not csrf_cookie or csrf_cookie != x_csrf_token:
        return expired_session("Refresh session expired")
    session = await db.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == hash_token(refresh_token))
    )
    if not session or session.revoked_at or as_utc(session.expires_at) <= datetime.now(UTC):
        return expired_session("Refresh session expired")
    user = await db.get(User, session.user_id)
    if not user:
        return expired_session("Refresh session expired")
    session.revoked_at = datetime.now(UTC)
    await create_session(db, response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    if refresh_token:
        session = await db.scalar(
            select(RefreshSession).where(RefreshSession.token_hash == hash_token(refresh_token))
        )
        if session:
            session.revoked_at = datetime.now(UTC)
            await db.commit()
    clear_session_cookies(response)


@router.get("/me", response_model=UserView)
async def me(user: User = Depends(current_user)) -> User:
    return user
