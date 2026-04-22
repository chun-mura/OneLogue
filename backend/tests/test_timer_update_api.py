import os
from datetime import datetime, timedelta, timezone

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


def test_patch_running_timer_start_updates_active_entry() -> None:
    client = _memory_client()
    try:
        client.post("/categories", json={"name": "開発"})
        task_r = client.post(
            "/tasks",
            json={
                "title": "実装する",
                "category": "開発",
                "due_at": None,
                "status": "pending",
            },
        )
        task_id = task_r.json()["id"]

        start_r = client.post(f"/tasks/{task_id}/start")
        original = datetime.fromisoformat(start_r.json()["active_entry"]["start_time"].replace("Z", "+00:00"))
        updated = (original - timedelta(minutes=20)).isoformat()

        patch_r = client.patch(f"/tasks/{task_id}/start", json={"start_time": updated})

        assert patch_r.status_code == 200
        body = patch_r.json()
        assert body["message"] == "Timer start updated"
        assert body["active_entry"]["task_id"] == task_id
        assert body["active_entry"]["start_time"] == updated
    finally:
        app.dependency_overrides.clear()


def test_patch_running_timer_start_rejects_future_time() -> None:
    client = _memory_client()
    try:
        client.post("/categories", json={"name": "開発"})
        task_r = client.post(
            "/tasks",
            json={
                "title": "実装する",
                "category": "開発",
                "due_at": None,
                "status": "pending",
            },
        )
        task_id = task_r.json()["id"]

        client.post(f"/tasks/{task_id}/start")
        future = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

        patch_r = client.patch(f"/tasks/{task_id}/start", json={"start_time": future})

        assert patch_r.status_code == 422
    finally:
        app.dependency_overrides.clear()
