from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TimeEntry
from app.schemas import TimeEntryCreate, TimeEntryDetailRead, TimeEntryEdit, TimeEntryRead
from app.services.timer_service import create_time_entry, update_time_entry

router = APIRouter(prefix="/time-entries", tags=["time-entries"])


@router.get("", response_model=list[TimeEntryDetailRead])
def list_time_entries(db: Session = Depends(get_db)) -> list[TimeEntryDetailRead]:
    entries = db.scalars(select(TimeEntry).order_by(TimeEntry.start_time.desc())).all()
    items: list[TimeEntryDetailRead] = []

    for entry in entries:
        if entry.task is None:
            continue
        items.append(
            TimeEntryDetailRead(
                id=entry.id,
                task_id=entry.task_id,
                start_time=entry.start_time,
                end_time=entry.end_time,
                task_title=entry.task.title,
                task_category=entry.task.category,
                task_status=entry.task.status,
            )
        )

    return items


@router.post("", response_model=TimeEntryRead, status_code=status.HTTP_201_CREATED)
def post_time_entry(payload: TimeEntryCreate, db: Session = Depends(get_db)) -> TimeEntryRead:
    entry = create_time_entry(
        db,
        task_id=payload.task_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    return TimeEntryRead.model_validate(entry)


@router.patch("/{entry_id}", response_model=TimeEntryRead)
def patch_time_entry(
    entry_id: int, payload: TimeEntryEdit, db: Session = Depends(get_db)
) -> TimeEntryRead:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="At least one field is required",
        )

    entry = update_time_entry(
        db,
        entry_id,
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
    )
    return TimeEntryRead.model_validate(entry)
