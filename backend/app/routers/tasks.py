from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task, TimeEntry
from app.schemas import TaskCreate, TaskRead, TaskUpdate, TimerActionResponse
from app.services.timer_service import (
    get_active_task_timer,
    start_task_timer,
    stop_task_timer,
    stop_task_timer_if_running,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskRead:
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskRead.model_validate(task)


@router.get("", response_model=list[TaskRead])
def list_tasks(db: Session = Depends(get_db)) -> list[TaskRead]:
    pending_first = case((Task.status == "pending", 0), else_=1)
    tasks = db.scalars(
        select(Task).order_by(pending_first, Task.priority.desc(), Task.created_at.desc())
    ).all()
    return [TaskRead.model_validate(task) for task in tasks]


@router.get("/active", response_model=TimerActionResponse)
def get_active_timer(db: Session = Depends(get_db)) -> TimerActionResponse:
    entry = get_active_task_timer(db)
    return TimerActionResponse(message="Active timer fetched", active_entry=entry)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskRead:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("status")
    if new_status in ("completed", "archived"):
        stop_task_timer_if_running(db, task_id)

    for field, value in data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return TaskRead.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> None:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed tasks can be deleted",
        )
    stop_task_timer_if_running(db, task_id)
    db.execute(delete(TimeEntry).where(TimeEntry.task_id == task_id))
    db.delete(task)
    db.commit()


@router.post("/{task_id}/start", response_model=TimerActionResponse)
def start_timer(task_id: int, db: Session = Depends(get_db)) -> TimerActionResponse:
    entry = start_task_timer(db, task_id)
    return TimerActionResponse(message="Timer started", active_entry=entry)


@router.post("/{task_id}/stop", response_model=TimerActionResponse)
def stop_timer(task_id: int, db: Session = Depends(get_db)) -> TimerActionResponse:
    entry = stop_task_timer(db, task_id)
    return TimerActionResponse(message="Timer stopped", active_entry=entry)
