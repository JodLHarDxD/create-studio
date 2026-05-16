from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import ai_chat

app = FastAPI(title="CREATstudio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_chat.router, prefix="/api/ai", tags=["AI Cortex"])

@app.get("/health")
def health():
    return {"status": "operational", "service": "CREATstudio API"}

@app.get("/")
def root():
    return {"status": "operational", "service": "CREATstudio API"}
