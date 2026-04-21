from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.stats import router as stats_router
from app.routers.tasks import router as tasks_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TODO & Time Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(stats_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
