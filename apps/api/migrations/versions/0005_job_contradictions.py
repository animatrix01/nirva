"""jobs.contradictions column (Phase 4 demo: surfaced cross-source conflicts)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_job_contradictions"
down_revision: str | None = "0004_job_evidence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("contradictions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "contradictions")
