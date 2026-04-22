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


def _parse_api_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


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
        original = _parse_api_datetime(start_r.json()["active_entry"]["start_time"])
        updated = (original - timedelta(minutes=20)).isoformat()

        patch_r = client.patch(f"/tasks/{task_id}/start", json={"start_time": updated})

        assert patch_r.status_code == 200
        body = patch_r.json()
        assert body["message"] == "Timer start updated"
        assert body["active_entry"]["task_id"] == task_id
        assert _parse_api_datetime(body["active_entry"]["start_time"]) == datetime.fromisoformat(updated)
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


def test_list_time_entries_returns_task_context() -> None:
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
        entry_id = start_r.json()["active_entry"]["id"]
        client.post(f"/tasks/{task_id}/stop")

        list_r = client.get("/time-entries")

        assert list_r.status_code == 200
        body = list_r.json()
        assert len(body) == 1
        assert body[0]["id"] == entry_id
        assert body[0]["task_title"] == "実装する"
        assert body[0]["task_category"] == "開発"
    finally:
        app.dependency_overrides.clear()


def test_patch_time_entry_updates_start_and_end() -> None:
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
        original_start = _parse_api_datetime(start_r.json()["active_entry"]["start_time"])
        stop_r = client.post(f"/tasks/{task_id}/stop")
        entry_id = stop_r.json()["active_entry"]["id"]
        original_end = _parse_api_datetime(stop_r.json()["active_entry"]["end_time"])

        updated_start = (original_start - timedelta(minutes=10)).isoformat()
        updated_end = (original_end - timedelta(minutes=5)).isoformat()
        patch_r = client.patch(
            f"/time-entries/{entry_id}",
            json={"start_time": updated_start, "end_time": updated_end},
        )

        assert patch_r.status_code == 200
        body = patch_r.json()
        assert _parse_api_datetime(body["start_time"]) == datetime.fromisoformat(updated_start)
        assert _parse_api_datetime(body["end_time"]) == datetime.fromisoformat(updated_end)
    finally:
        app.dependency_overrides.clear()
