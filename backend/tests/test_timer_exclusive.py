from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.models import Task, TimeEntry
from app.services.timer_service import (
    start_task_timer,
    stop_task_timer,
    stop_task_timer_if_running,
)


def _create_test_db() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return testing_session()


def test_starting_another_task_stops_existing_timer() -> None:
    db = _create_test_db()
    task_a = Task(title="A", category="Work", priority=3, status="pending")
    task_b = Task(title="B", category="Hobby", priority=2, status="pending")
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
    task = Task(title="A", category="Work", priority=3, status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    entry = start_task_timer(db, task.id)
    stopped = stop_task_timer(db, task.id)

    assert stopped.id == entry.id
    assert stopped.end_time is not None


def test_summary_like_aggregation_only_counts_closed_entries() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", priority=3, status="pending")
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
    task = Task(title="A", category="Work", priority=3, status="completed")
    db.add(task)
    db.commit()
    db.refresh(task)

    with pytest.raises(HTTPException) as excinfo:
        start_task_timer(db, task.id)
    assert excinfo.value.status_code == 409


def test_stop_task_timer_if_running_closes_open_entry() -> None:
    db = _create_test_db()
    task = Task(title="A", category="Work", priority=3, status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    entry = start_task_timer(db, task.id)
    assert entry.end_time is None

    stop_task_timer_if_running(db, task.id)
    db.commit()
    db.refresh(entry)
    assert entry.end_time is not None
