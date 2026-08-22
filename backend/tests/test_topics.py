from app.services.topics import detect_topic_domain


def test_detects_coding_and_it_notes() -> None:
    assert detect_topic_domain("Docker Cheatsheet", "container layers and Dockerfile") == "cs"
    assert detect_topic_domain("DBMS", "1NF 2NF 3NF normalization") == "cs"
    assert detect_topic_domain("DSA notes", "linked list vs binary tree") == "cs"


def test_biology_and_history_stay_general() -> None:
    assert detect_topic_domain("Cell biology", "Mitochondria produce ATP") == "general"
    assert detect_topic_domain("World War II", "causes of the conflict") == "general"
