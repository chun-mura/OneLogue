from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.models import Category, Task
from app.routers.categories import router as categories_router
from app.routers.stats import router as stats_router
from app.routers.tasks import router as tasks_router
from app.routers.time_entries import router as time_entries_router

Base.metadata.create_all(bind=engine)


def ensure_task_columns() -> None:
    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("tasks")}
    with engine.begin() as connection:
        if "due_at" not in column_names:
            connection.execute(text("ALTER TABLE tasks ADD COLUMN due_at DATETIME"))


def sync_categories_from_tasks() -> None:
    with Session(engine) as db:
        task_categories = db.scalars(select(Task.category).distinct()).all()
        if not task_categories:
            return

        existing = {
            name.lower() for name in db.scalars(select(Category.name)).all()
        }
        created = False

        for name in task_categories:
            normalized = name.strip()
            if not normalized or normalized.lower() in existing:
                continue
            db.add(Category(name=normalized))
            existing.add(normalized.lower())
            created = True

        if created:
            db.commit()


ensure_task_columns()
sync_categories_from_tasks()

app = FastAPI(title="TODO & Time Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories_router)
app.include_router(tasks_router)
app.include_router(time_entries_router)
app.include_router(stats_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
