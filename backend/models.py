from pydantic import BaseModel, Field
from typing import Optional


class APIKeys(BaseModel):
    anthropic: Optional[str] = None
    openai: Optional[str] = None
    google: Optional[str] = None


class ChatRequest(BaseModel):
    user_message: str = Field(..., max_length=32_000)
    model_id: str = "gemini-2.5-flash"
    provider: str = "google"
    active_file_content: Optional[str] = None
    active_task: Optional[str] = None
    project_id: Optional[str] = None
    api_keys: Optional[APIKeys] = None


class FileSaveRequest(BaseModel):
    file_id: Optional[str] = None
    project_id: str
    file_name: str
    path: Optional[str] = None
    content: str
    google_key: Optional[str] = None


class ChatMessageRecord(BaseModel):
    project_id: str
    user_id: str
    role: str
    content: str
    model_id: Optional[str] = None
    provider: Optional[str] = None
    rag_used: bool = False
    rag_files: list[str] = []
