"""documents table (Phase 2 ingestion registry)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_documents"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("document_id", sa.String(64), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("document_type", sa.String(32), nullable=False),
        sa.Column("revision", sa.String(32), nullable=False),
        sa.Column("effective_date", sa.String(32), nullable=False),
        sa.Column("department", sa.String(64), nullable=False),
        sa.Column("equipment_id", sa.String(64), nullable=True),
        sa.Column("confidentiality_level", sa.String(32), nullable=False),
        sa.Column("allowed_roles", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("documents")
