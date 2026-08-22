"""User countdowns with day/hour targets."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0005_countdowns"
down_revision = "0004_plans_and_achievements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "countdowns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_countdowns_user_id", "countdowns", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_countdowns_user_id", table_name="countdowns")
    op.drop_table("countdowns")
