from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TaskStatus = Literal["pending", "completed", "archived"]
StatsRange = Literal["daily", "weekly", "monthly", "custom"]


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def _naive_datetime_is_utc_for_category(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    due_at: date | None = None
    status: TaskStatus = "pending"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    due_at: date | None = None
    status: TaskStatus | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

    @field_validator("created_at", mode="before")
    @classmethod
    def _naive_datetime_is_utc(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @field_validator("due_at", mode="before")
    @classmethod
    def _coerce_due_date(cls, v: object) -> object:
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str) and "T" in v:
            return datetime.fromisoformat(v.replace("Z", "+00:00")).date()
        return v


class TimeEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    start_time: datetime
    end_time: datetime | None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _naive_datetime_is_utc(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TimerActionResponse(BaseModel):
    message: str
    active_entry: TimeEntryRead | None = None


class StatsItem(BaseModel):
    category: str
    total_seconds: int


class StatsSummaryResponse(BaseModel):
    range: StatsRange
    from_date: datetime
    to_date: datetime
    items: list[StatsItem]
