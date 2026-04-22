from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TimeEntry


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


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


def update_active_task_timer_start(
    db: Session, task_id: int, start_time: datetime
) -> TimeEntry:
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

    normalized_start = _as_utc(start_time)
    now = datetime.now(timezone.utc)
    if normalized_start > now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Start time cannot be in the future",
        )

    active_entry.start_time = normalized_start
    db.commit()
    db.refresh(active_entry)
    return active_entry


def update_time_entry(
    db: Session, entry_id: int, start_time: datetime | None = None, end_time: datetime | None = None
) -> TimeEntry:
    entry = db.get(TimeEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found")

    now = datetime.now(timezone.utc)
    next_start = _as_utc(entry.start_time) if start_time is None else _as_utc(start_time)
    next_end = _as_utc(entry.end_time) if end_time is None and entry.end_time is not None else None
    if end_time is not None:
        next_end = _as_utc(end_time)

    if next_start > now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Start time cannot be in the future",
        )

    if next_end is not None:
        if next_end > now:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="End time cannot be in the future",
            )
        if next_end <= next_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="End time must be after start time",
            )

    entry.start_time = next_start
    entry.end_time = next_end
    db.commit()
    db.refresh(entry)
    return entry
