from datetime import date, datetime, time, timezone
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
    due_at: datetime | None = None
    status: TaskStatus = "pending"

    @field_validator("due_at", mode="before")
    @classmethod
    def _coerce_due_datetime(cls, v: object) -> object:
        if v in (None, ""):
            return None
        if isinstance(v, datetime):
            return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        if isinstance(v, date):
            return datetime.combine(v, time.min, tzinfo=timezone.utc)
        if isinstance(v, str):
            if "T" in v:
                parsed = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
            parsed_date = date.fromisoformat(v)
            return datetime.combine(parsed_date, time.min, tzinfo=timezone.utc)
        return v


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    due_at: datetime | None = None
    status: TaskStatus | None = None

    @field_validator("due_at", mode="before")
    @classmethod
    def _coerce_due_datetime(cls, v: object) -> object:
        if v in (None, ""):
            return None
        if isinstance(v, datetime):
            return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        if isinstance(v, date):
            return datetime.combine(v, time.min, tzinfo=timezone.utc)
        if isinstance(v, str):
            if "T" in v:
                parsed = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
            parsed_date = date.fromisoformat(v)
            return datetime.combine(parsed_date, time.min, tzinfo=timezone.utc)
        return v


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
    def _coerce_due_datetime(cls, v: object) -> object:
        if isinstance(v, datetime):
            return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)
        if isinstance(v, date):
            return datetime.combine(v, time.min, tzinfo=timezone.utc)
        if isinstance(v, str):
            if "T" in v:
                parsed = datetime.fromisoformat(v.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
            parsed_date = date.fromisoformat(v)
            return datetime.combine(parsed_date, time.min, tzinfo=timezone.utc)
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


class TimeEntryDetailRead(TimeEntryRead):
    task_title: str
    task_category: str
    task_status: TaskStatus


class TimeEntryUpdate(BaseModel):
    start_time: datetime

    @field_validator("start_time", mode="before")
    @classmethod
    def _naive_datetime_is_utc_for_update(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TimeEntryEdit(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _naive_datetime_is_utc_for_edit(cls, v: object) -> object:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TimeEntryCreate(BaseModel):
    task_id: int
    start_time: datetime
    end_time: datetime

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _naive_datetime_is_utc_for_create(cls, v: object) -> object:
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
