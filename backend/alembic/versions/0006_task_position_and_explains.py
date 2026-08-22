"""Task order and cached full explanations."""

import sqlalchemy as sa
from alembic import op

revision = "0006_task_position_and_explains"
down_revision = "0005_countdowns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "study_tasks",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY plan_id ORDER BY due_date, title) - 1 AS pos
            FROM study_tasks
        )
        UPDATE study_tasks SET position = ranked.pos FROM ranked WHERE study_tasks.id = ranked.id
        """
    )
    op.alter_column("study_tasks", "position", server_default=None)
    op.add_column("study_items", sa.Column("option_explanations", sa.JSON(), nullable=True))
    op.add_column("study_items", sa.Column("full_explanation", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("study_items", "full_explanation")
    op.drop_column("study_items", "option_explanations")
    op.drop_column("study_tasks", "position")
