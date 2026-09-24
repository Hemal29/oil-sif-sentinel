import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "OIL Problem AI Module"
    API_V1_STR: str = "/api/v1"
    API_KEY: str = os.getenv("MICROSERVICE_API_KEY", "your-secret-backend-api-key")
    
    # Model Weights Paths
    STAGE1_MODEL_PATH: str = os.getenv("STAGE1_MODEL_PATH", "./models_weights/stage1-v1-model")
    STAGE2_BASE_MODEL: str = "Qwen/Qwen2.5-7B-Instruct"
    STAGE2_ADAPTER_PATH: str = os.getenv("STAGE2_ADAPTER_PATH", "./models_weights/stage2-qlora-adapter-step150")

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()