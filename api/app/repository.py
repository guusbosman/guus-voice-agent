from __future__ import annotations

import uuid
from typing import Dict, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from .config import settings
from .models import SessionRecord, now_iso


class SessionRepository:
    def __init__(self) -> None:
        self._in_memory: Dict[str, SessionRecord] = {}
        self._table = None
        try:
            dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
            self._table = dynamodb.Table(settings.dynamodb_table_sessions)
            self._table.load()
        except Exception:
            self._table = None

    def create_session(self, user_id: str, channel: str) -> SessionRecord:
        session_id = str(uuid.uuid4())
        ts = now_iso()
        record = SessionRecord(
            session_id=session_id,
            user_id=user_id,
            channel=channel,
            status="active",
            created_at=ts,
            updated_at=ts,
        )

        if self._table:
            try:
                self._table.put_item(Item=record.model_dump())
                return record
            except (BotoCoreError, ClientError):
                pass

        self._in_memory[session_id] = record
        return record

    def get_session(self, session_id: str) -> Optional[SessionRecord]:
        if self._table:
            try:
                response = self._table.get_item(Key={"session_id": session_id})
                item = response.get("Item")
                if item:
                    return SessionRecord(**item)
            except (BotoCoreError, ClientError):
                pass

        return self._in_memory.get(session_id)

    def end_session(self, session_id: str) -> Optional[SessionRecord]:
        existing = self.get_session(session_id)
        if not existing:
            return None

        ts = now_iso()
        updated = existing.model_copy(update={"status": "ended", "ended_at": ts, "updated_at": ts})

        if self._table:
            try:
                self._table.put_item(Item=updated.model_dump())
                return updated
            except (BotoCoreError, ClientError):
                pass

        self._in_memory[session_id] = updated
        return updated
