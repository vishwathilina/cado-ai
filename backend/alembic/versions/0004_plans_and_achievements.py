"""Plan start dates and monthly achievements."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0004_plans_and_achievements"
down_revision = "0003_bge_m3_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("study_plans", sa.Column("start_date", sa.Date(), nullable=True))
    op.create_table(
        "achievements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("achieved_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_achievements_user_id", "achievements", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_achievements_user_id", table_name="achievements")
    op.drop_table("achievements")
    op.drop_column("study_plans", "start_date")
