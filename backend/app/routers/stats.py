from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, TimeEntry
from app.schemas import StatsItem, StatsSummaryResponse, StatsRange

router = APIRouter(prefix="/stats", tags=["stats"])


def _resolve_range(
    range_name: StatsRange, from_date: datetime | None, to_date: datetime | None
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)

    if range_name == "daily":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if range_name == "weekly":
        start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        return start, now
    if range_name == "monthly":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return start, now
    if range_name == "custom":
        if from_date is None or to_date is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="from and to are required for custom range",
            )
        return from_date, to_date

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid range")


@router.get("/summary", response_model=StatsSummaryResponse)
def get_summary(
    range: StatsRange = Query(default="weekly"),
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
) -> StatsSummaryResponse:
    start_at, end_at = _resolve_range(range, from_date, to_date)

    entries = db.execute(
        select(TimeEntry, Task)
        .join(Task, Task.id == TimeEntry.task_id)
        .where(
            TimeEntry.end_time.is_not(None),
            TimeEntry.start_time >= start_at,
            TimeEntry.end_time <= end_at,
        )
    ).all()

    bucket: dict[str, int] = {}
    for entry, task in entries:
        if entry.end_time is None:
            continue
        total_seconds = int((entry.end_time - entry.start_time).total_seconds())
        bucket[task.category] = bucket.get(task.category, 0) + max(0, total_seconds)

    items = [StatsItem(category=category, total_seconds=seconds) for category, seconds in bucket.items()]
    items.sort(key=lambda item: item.total_seconds, reverse=True)
    return StatsSummaryResponse(range=range, from_date=start_at, to_date=end_at, items=items)
