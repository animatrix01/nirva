"""job_evidence table: persisted per-job evidence snapshot (incl. tool results)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_job_evidence"
down_revision: str | None = "0003_operational"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_evidence",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id"), nullable=False, index=True),
        sa.Column("chunk_id", sa.String(128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.UniqueConstraint("job_id", "chunk_id", name="uq_job_evidence_chunk"),
    )


def downgrade() -> None:
    op.drop_table("job_evidence")
