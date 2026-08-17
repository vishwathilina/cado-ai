import uuid

import jwt
import pytest
from pydantic import ValidationError

from app.schemas import GenerationRequest
from app.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hashing_and_verification() -> None:
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)


def test_access_token_is_bound_to_user_and_type() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    assert decode_access_token(token) == user_id
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token + "tampered")


def test_generation_requires_at_least_one_output() -> None:
    with pytest.raises(ValidationError):
        GenerationRequest(
            document_id=uuid.uuid4(),
            explanation_count=0,
            mcq_count=0,
            flashcard_count=0,
        )


def test_generation_allows_four_or_five_options_only() -> None:
    with pytest.raises(ValidationError):
        GenerationRequest(document_id=uuid.uuid4(), option_count=3)
    assert GenerationRequest(document_id=uuid.uuid4(), option_count=5).option_count == 5
