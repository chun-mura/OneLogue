from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TimeEntry


def get_active_task_timer(db: Session) -> TimeEntry | None:
    return db.scalar(
        select(TimeEntry)
        .where(TimeEntry.end_time.is_(None))
        .order_by(TimeEntry.start_time.desc())
    )


def start_task_timer(db: Session, task_id: int) -> TimeEntry:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending tasks can be timed",
        )

    now = datetime.now(timezone.utc)
    active_entries = db.scalars(select(TimeEntry).where(TimeEntry.end_time.is_(None))).all()

    for entry in active_entries:
        if entry.task_id == task_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Task timer is already running",
            )
        entry.end_time = now

    new_entry = TimeEntry(task_id=task_id, start_time=now)
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry


def stop_task_timer(db: Session, task_id: int) -> TimeEntry:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    active_entry = db.scalar(
        select(TimeEntry)
        .where(TimeEntry.task_id == task_id, TimeEntry.end_time.is_(None))
        .order_by(TimeEntry.start_time.desc())
    )
    if active_entry is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No running timer for this task",
        )

    active_entry.end_time = datetime.now(timezone.utc)
    db.commit()
    db.refresh(active_entry)
    return active_entry


def stop_task_timer_if_running(db: Session, task_id: int) -> None:
    """進行中のエントリがあれば終了時刻を入れる（コミットは呼び出し側）。"""
    active_entry = db.scalar(
        select(TimeEntry)
        .where(TimeEntry.task_id == task_id, TimeEntry.end_time.is_(None))
        .order_by(TimeEntry.start_time.desc())
    )
    if active_entry is not None:
        active_entry.end_time = datetime.now(timezone.utc)
