from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import (
    ChatMessageRequest,
    ChatMessageResponse,
    SessionCreateRequest,
    SessionRecord,
    SessionResponse,
    TokenRequest,
    TokenResponse,
    now_iso,
)
from .repository import SessionRepository

app = FastAPI(title="Guus Voice Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = SessionRepository()


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok", "timestamp": now_iso()}


@app.post("/sessions", response_model=SessionResponse)
def create_session(payload: SessionCreateRequest) -> SessionResponse:
    record = repo.create_session(user_id=payload.user_id, channel=payload.channel)
    return SessionResponse(session_id=record.session_id, status=record.status)


@app.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str) -> SessionRecord:
    record = repo.get_session(session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@app.post("/sessions/{session_id}/end", response_model=SessionResponse)
def end_session(session_id: str) -> SessionResponse:
    record = repo.end_session(session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(session_id=record.session_id, status=record.status)


@app.post("/livekit/token", response_model=TokenResponse)
def mint_livekit_token(payload: TokenRequest) -> TokenResponse:
    record = repo.create_session(user_id=payload.user_id, channel="web")
    expires = datetime.utcnow() + timedelta(minutes=10)

    # Placeholder token. Replace this with real LiveKit JWT minting.
    fake_token = f"dev-token-{record.session_id[:8]}"

    return TokenResponse(
        livekit_url=settings.livekit_url,
        room_name=f"session-{record.session_id[:8]}",
        participant_token=fake_token,
        session_id=record.session_id,
        expires_at=expires.replace(microsecond=0).isoformat() + "Z",
    )


@app.post("/chat/message", response_model=ChatMessageResponse)
def send_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    user_message = payload.message.strip()
    if payload.session_id:
        session = repo.get_session(payload.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

    # Placeholder response logic for MVP UI wiring.
    reply = (
        "I can help with that. "
        "This is the API placeholder reply path; next step is wiring LiveKit Agent + OpenAI Realtime. "
        f"You said: {user_message}"
    )

    return ChatMessageResponse(reply=reply, mode=payload.mode, timestamp=now_iso())
