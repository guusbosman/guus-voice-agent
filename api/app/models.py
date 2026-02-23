from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    user_id: str
    channel: Literal["web", "android"] = "web"


class SessionRecord(BaseModel):
    session_id: str
    user_id: str
    channel: str
    status: Literal["active", "ended"]
    created_at: str
    updated_at: str
    ended_at: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    status: str


class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(min_length=1, max_length=4000)
    mode: Literal["text", "voice"] = "text"


class ChatMessageResponse(BaseModel):
    reply: str
    mode: str
    timestamp: str


class TokenRequest(BaseModel):
    user_id: str


class TokenResponse(BaseModel):
    livekit_url: str
    room_name: str
    participant_token: str
    session_id: str
    expires_at: str


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
