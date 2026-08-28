import uuid

from sqlalchemy.orm import Session

from app.models import User
from app.security import hash_password

DEMO_PASSWORD = "nirva-demo-pass"

SEED_USERS: list[tuple[str, str, str]] = [
    ("engineer", "engineer", "Demo Engineer"),
    ("safety_officer", "safety_officer", "Demo Safety Officer"),
    ("supervisor", "supervisor", "Demo Supervisor"),
    ("admin", "admin", "Demo Administrator"),
]


def seed_users_if_empty(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    for username, role, display_name in SEED_USERS:
        db.add(
            User(
                id=str(uuid.uuid4()),
                username=username,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=display_name,
                role=role,
            )
        )
    db.commit()
