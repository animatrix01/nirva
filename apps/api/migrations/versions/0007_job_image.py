"""Add context_image_path to jobs table (investigation asset/issue image)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_job_image"
down_revision: str | None = "0006_memories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "context_image_path",
            sa.String(512),
            nullable=True,
            server_default=None,
        ),
    )


def downgrade() -> None:
    op.drop_column("jobs", "context_image_path")
