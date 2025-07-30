from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import process, auth
from .core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process.router, prefix="/api/v1", tags=["processing"])
app.include_router(auth.router, prefix="/api/v1", tags=["authentication"])

@app.get("/")
def read_root():
    return {"status": f"Welcome to {settings.PROJECT_NAME}"}