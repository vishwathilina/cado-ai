"""Switch document embeddings from 384-d MiniLM to 1024-d BGE-M3."""

from alembic import op

revision = "0003_bge_m3_embeddings"
down_revision = "0002_minilm_embeddings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM document_chunks")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(1024) NOT NULL")


def downgrade() -> None:
    op.execute("DELETE FROM document_chunks")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(384) NOT NULL")
