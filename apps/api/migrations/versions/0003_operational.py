"""operational tables: asset_events, inventory_items, work_orders."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_operational"
down_revision: str | None = "0002_documents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "asset_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("equipment_id", sa.String(64), nullable=False, index=True),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source_timestamp", sa.String(32), nullable=False),
    )
    op.create_table(
        "inventory_items",
        sa.Column("part_number", sa.String(64), primary_key=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("location", sa.String(64), nullable=False),
        sa.Column("available_qty", sa.Integer(), nullable=False),
        sa.Column("last_updated", sa.String(32), nullable=False),
    )
    op.create_table(
        "work_orders",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("approval_id", sa.String(36), sa.ForeignKey("approvals.id"), nullable=False, unique=True, index=True),
        sa.Column("job_id", sa.String(36), nullable=False, index=True),
        sa.Column("proposal_id", sa.String(64), nullable=False),
        sa.Column("asset", sa.String(64), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("parts", sa.JSON(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("work_orders")
    op.drop_table("inventory_items")
    op.drop_table("asset_events")
