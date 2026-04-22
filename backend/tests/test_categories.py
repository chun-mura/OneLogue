import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


def _memory_client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_task_creation_requires_registered_category() -> None:
    client = _memory_client()
    try:
        response = client.post(
            "/tasks",
            json={
                "title": "T",
                "category": "未登録カテゴリ",
                "due_at": None,
                "status": "pending",
            },
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_registered_category_can_be_used_for_task_creation() -> None:
    client = _memory_client()
    try:
        category_response = client.post("/categories", json={"name": "開発"})
        assert category_response.status_code == 201

        task_response = client.post(
            "/tasks",
            json={
                "title": "実装する",
                "category": "開発",
                "due_at": "2026-05-01",
                "status": "pending",
            },
        )
        assert task_response.status_code == 201
        assert task_response.json()["category"] == "開発"
        assert task_response.json()["due_at"] == "2026-05-01"
    finally:
        app.dependency_overrides.clear()


def test_category_in_use_cannot_be_deleted() -> None:
    client = _memory_client()
    try:
        category_response = client.post("/categories", json={"name": "企画"})
        category_id = category_response.json()["id"]

        client.post(
            "/tasks",
            json={
                "title": "構成を考える",
                "category": "企画",
                "due_at": None,
                "status": "pending",
            },
        )

        delete_response = client.delete(f"/categories/{category_id}")
        assert delete_response.status_code == 400
    finally:
        app.dependency_overrides.clear()
