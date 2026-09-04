"""memory_entries table (A3: episodic memory store with provenance)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_memories"
down_revision: str | None = "0005_job_contradictions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "memory_entries",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("equipment_id", sa.String(64), nullable=True, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("job_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("memory_entries")
