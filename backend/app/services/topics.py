import re

# One strong hit is enough. Weak hits need a few together so history/biology
# notes do not get classified as programming.
CS_STRONG = (
    "docker",
    "kubernetes",
    "sql",
    "mysql",
    "postgresql",
    "mongodb",
    "python",
    "java",
    "javascript",
    "typescript",
    "html",
    "css",
    "react",
    "nodejs",
    "node.js",
    "django",
    "flask",
    "algorithm",
    "algorithms",
    "dsa",
    "dbms",
    "rdbms",
    "normalization",
    "1nf",
    "2nf",
    "3nf",
    "bcnf",
    "operating system",
    "computer science",
    "computer network",
    "programming",
    "coding",
    "git ",
    "linux",
    "unix",
    "linked list",
    "binary tree",
    "hash table",
    "tcp/ip",
    "osi model",
    "uml",
    "er diagram",
    "entity relationship",
    "microservices",
    "devops",
    "dockerfile",
    "object oriented",
    "oop",
    "compiler",
    "data structure",
    "data structures",
    "software engineering",
    "frontend",
    "backend",
    "fullstack",
    "rest api",
    "graphql",
)

CS_WEAK = (
    "api",
    "json",
    "xml",
    "database",
    "query",
    "schema",
    "thread",
    "process",
    "cache",
    "protocol",
    "server",
    "client",
    "cloud",
    "container",
    "http",
    "https",
    "dns",
    "array",
    "pointer",
    "function",
    "variable",
)


def detect_topic_domain(*texts: str) -> str:
    hay = re.sub(r"[^a-z0-9+.#/\s-]", " ", " ".join(texts).lower())
    hay = f" {re.sub(r'\s+', ' ', hay)} "
    score = 0
    for term in CS_STRONG:
        if term in hay:
            score += 3
    for term in CS_WEAK:
        if re.search(rf"\b{re.escape(term)}\b", hay):
            score += 1
    return "cs" if score >= 3 else "general"
