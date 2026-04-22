import os

# app.main が import 時に engine を開くため、ファイルパスより先に設定する
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Task, TimeEntry


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
    return TestClient(app), session_local


def test_delete_completed_task_removes_time_entries() -> None:
    client, session_local = _memory_client()
    try:
        category_r = client.post("/categories", json={"name": "C"})
        assert category_r.status_code == 201

        r = client.post(
            "/tasks",
            json={
                "title": "T",
                "category": "C",
                "due_at": None,
                "status": "pending",
            },
        )
        assert r.status_code == 201
        task_id = r.json()["id"]

        assert client.post(f"/tasks/{task_id}/start").status_code == 200
        assert client.patch(f"/tasks/{task_id}", json={"status": "completed"}).status_code == 200

        assert client.delete(f"/tasks/{task_id}").status_code == 204

        with session_local() as db:
            assert db.get(Task, task_id) is None
            assert db.scalars(select(TimeEntry).where(TimeEntry.task_id == task_id)).first() is None
    finally:
        app.dependency_overrides.clear()


def test_delete_pending_task_is_rejected() -> None:
    client, _ = _memory_client()
    try:
        category_r = client.post("/categories", json={"name": "C"})
        assert category_r.status_code == 201

        r = client.post(
            "/tasks",
            json={
                "title": "T",
                "category": "C",
                "due_at": None,
                "status": "pending",
            },
        )
        task_id = r.json()["id"]

        del_r = client.delete(f"/tasks/{task_id}")
        assert del_r.status_code == 400
    finally:
        app.dependency_overrides.clear()
