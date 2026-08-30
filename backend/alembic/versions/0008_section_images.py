"""Section context images for easy learning."""

import sqlalchemy as sa
from alembic import op

revision = "0008_section_images"
down_revision = "0007_study_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("study_items", sa.Column("image_search_query", sa.String(length=120), nullable=True))
    op.add_column("study_items", sa.Column("image_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("study_items", "image_url")
    op.drop_column("study_items", "image_search_query")
