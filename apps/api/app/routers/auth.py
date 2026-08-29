from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser
from app.models import User
from app.schemas import LoginRequest, LoginResponse, MeResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = _authenticate(db, body.username, body.password)
    token = create_access_token(user.id, user.role, user.username)
    return LoginResponse(
        access_token=token,
        user=UserOut(user_id=user.id, username=user.username, role=user.role),
    )


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser) -> MeResponse:
    return MeResponse(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )

