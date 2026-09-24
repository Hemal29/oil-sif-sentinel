import warnings
warnings.filterwarnings("ignore", category=UserWarning)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.core.inference import engine
from app.routers import analyze

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-loads DeBERTa and Qwen2.5 QLoRA model weights onto GPU on startup
    engine.load_models()
    yield

app = FastAPI(
    title="SIF Precursor Triage & Extraction API",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan
)

# Included directly without prefix so the route hits /v1/reports/assess exactly
app.include_router(analyze.router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy" if engine.is_ready else "loading",
        "service": settings.PROJECT_NAME
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)