from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Privalia Composer"
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://10.126.8.41:5173"
    ]

    JWT_SECRET_KEY: str

    class Config:
        env_file = ".env.backend"

settings = Settings()