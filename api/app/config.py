import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    aws_region: str = os.getenv("AWS_REGION", "us-east-1")
    dynamodb_table_sessions: str = os.getenv("DYNAMODB_TABLE_SESSIONS", "guus_voice_sessions")
    livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")
    livekit_url: str = os.getenv("LIVEKIT_URL", "")
    livekit_token_ttl_seconds: int = int(os.getenv("LIVEKIT_TOKEN_TTL_SECONDS", "600"))
    livekit_agent_name: str = os.getenv("LIVEKIT_AGENT_NAME", "guus-voice-agent")


settings = Settings()
