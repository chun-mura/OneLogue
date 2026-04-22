from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import Task, TimeEntry
from app.services.timer_service import (
    get_active_task_timer,
    start_task_timer,
    stop_task_timer,
    stop_task_timer_if_running,
    update_active_task_timer_start,
    update_time_entry,
)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _create_test_db() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return testing_session()


def test_starting_another_task_stops_existing_timer() -> None:
    db = _create_test_db()
    task_a = Task(title="A", category="Work", status="pending")
    task_b = Task(title="B", category="Hobby", status="pending")
    db.add_all([task_a, task_b])
    db.commit()
    db.refresh(task_a)
    db.refresh(task_b)

    entry_a = start_task_timer(db, task_a.id)
    entry_b = start_task_timer(db, task_b.id)

    previous = db.get(TimeEntry, entry_a.id)
    assert previous is not None
    assert previous.end_time is not None
    assert entry_b.end_time is None
    assert entry_b.task_id == task_b.id


def test_stop_timer_finishes_active_entry() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    entry = start_task_timer(db, task.id)
    stopped = stop_task_timer(db, task.id)

    assert stopped.id == entry.id
    assert stopped.end_time is not None


def test_summary_like_aggregation_only_counts_closed_entries() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    now = datetime.now(timezone.utc)
    finished = TimeEntry(
      task_id=task.id,
      start_time=now - timedelta(minutes=10),
      end_time=now - timedelta(minutes=5)
    )
    running = TimeEntry(task_id=task.id, start_time=now - timedelta(minutes=2), end_time=None)
    db.add_all([finished, running])
    db.commit()

    rows = db.query(TimeEntry).filter(TimeEntry.end_time.is_not(None)).all()
    total_seconds = sum(int((row.end_time - row.start_time).total_seconds()) for row in rows if row.end_time)

    assert len(rows) == 1
    assert total_seconds == 300


def test_start_timer_rejects_completed_task() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="completed")
    db.add(task)
    db.commit()
    db.refresh(task)

    with pytest.raises(HTTPException) as excinfo:
        start_task_timer(db, task.id)
    assert excinfo.value.status_code == 409


def test_stop_task_timer_if_running_closes_open_entry() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    entry = start_task_timer(db, task.id)
    assert entry.end_time is None

    stop_task_timer_if_running(db, task.id)
    db.commit()
    db.refresh(entry)
    assert entry.end_time is not None


def test_get_active_task_timer_returns_latest_open_entry() -> None:
    db = _create_test_db()
    task_a = Task(title="A", category="Work", status="pending")
    task_b = Task(title="B", category="Work", status="pending")
    db.add_all([task_a, task_b])
    db.commit()
    db.refresh(task_a)
    db.refresh(task_b)

    start_task_timer(db, task_a.id)
    latest = start_task_timer(db, task_b.id)

    active_entry = get_active_task_timer(db)

    assert active_entry is not None
    assert active_entry.id == latest.id
    assert active_entry.task_id == task_b.id


def test_update_active_task_timer_start_rewrites_running_entry_start_time() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    entry = start_task_timer(db, task.id)
    new_start = entry.start_time - timedelta(minutes=15)

    updated = update_active_task_timer_start(db, task.id, new_start)

    assert updated.id == entry.id
    assert _as_utc(updated.start_time) == _as_utc(new_start)
    assert updated.end_time is None


def test_update_active_task_timer_start_rejects_future_time() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    start_task_timer(db, task.id)

    with pytest.raises(HTTPException) as excinfo:
        update_active_task_timer_start(db, task.id, datetime.now(timezone.utc) + timedelta(minutes=1))

    assert excinfo.value.status_code == 422


def test_update_time_entry_rewrites_closed_entry_range() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="completed")
    db.add(task)
    db.commit()
    db.refresh(task)

    now = datetime.now(timezone.utc)
    entry = TimeEntry(
        task_id=task.id,
        start_time=now - timedelta(minutes=30),
        end_time=now - timedelta(minutes=10),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    updated = update_time_entry(
        db,
        entry.id,
        start_time=entry.start_time - timedelta(minutes=15),
        end_time=entry.end_time - timedelta(minutes=5),
    )

    assert _as_utc(updated.start_time) == now - timedelta(minutes=45)
    assert updated.end_time is not None
    assert _as_utc(updated.end_time) == now - timedelta(minutes=15)


def test_update_time_entry_rejects_end_before_start() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", status="completed")
    db.add(task)
    db.commit()
    db.refresh(task)

    now = datetime.now(timezone.utc)
    entry = TimeEntry(
        task_id=task.id,
        start_time=now - timedelta(minutes=30),
        end_time=now - timedelta(minutes=10),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    with pytest.raises(HTTPException) as excinfo:
        update_time_entry(db, entry.id, end_time=entry.start_time - timedelta(minutes=1))

    assert excinfo.value.status_code == 422
