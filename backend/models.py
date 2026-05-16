from pydantic import BaseModel
from typing import Optional, Literal

class ChatRequest(BaseModel):
    user_message: str
    model_id: str = "gemini-2.5-flash"
    provider: str = "google"
    active_file_content: Optional[str] = None
    active_task: Optional[str] = None
    project_id: Optional[str] = None

class FileSaveRequest(BaseModel):
    file_id: Optional[str] = None
    project_id: str
    file_name: str
    path: Optional[str] = None
    content: str
