from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from livekit import api as livekit_api

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


async def ensure_room_and_dispatch(room_name: str) -> None:
    async with livekit_api.LiveKitAPI(
        url=settings.livekit_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    ) as lkapi:
        try:
            await lkapi.room.create_room(livekit_api.CreateRoomRequest(name=room_name))
        except Exception:
            # Room may already exist.
            pass

        try:
            existing = await lkapi.agent_dispatch.list_dispatch(room_name=room_name)
            dispatches = existing if isinstance(existing, list) else existing.agent_dispatches
            already_dispatched = any(
                dispatch.agent_name == settings.livekit_agent_name for dispatch in dispatches
            )
            if not already_dispatched:
                await lkapi.agent_dispatch.create_dispatch(
                    livekit_api.CreateAgentDispatchRequest(
                        room=room_name,
                        agent_name=settings.livekit_agent_name,
                    )
                )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Unable to dispatch agent: {exc}") from exc


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
async def mint_livekit_token(payload: TokenRequest) -> TokenResponse:
    if not settings.livekit_url:
        raise HTTPException(status_code=500, detail="LIVEKIT_URL is not configured")
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials are not configured")

    record = repo.create_session(user_id=payload.user_id, channel="web")
    expires = datetime.utcnow() + timedelta(seconds=settings.livekit_token_ttl_seconds)
    room_name = f"session-{record.session_id[:8]}"
    identity = f"{payload.user_id}-{record.session_id[:8]}"

    await ensure_room_and_dispatch(room_name)

    participant_token = (
        livekit_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_name(payload.user_id)
        .with_grants(livekit_api.VideoGrants(room_join=True, room=room_name))
        .to_jwt()
    )

    return TokenResponse(
        livekit_url=settings.livekit_url,
        room_name=room_name,
        participant_token=participant_token,
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
