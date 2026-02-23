import os
from pathlib import Path

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, cli
from livekit.plugins import openai

load_dotenv()

VOICE = os.getenv("OPENAI_REALTIME_VOICE", "marin")
BASE_INSTRUCTIONS = os.getenv(
    "OPENAI_REALTIME_INSTRUCTIONS",
    "You are a helpful, concise voice assistant. Keep responses clear and practical.",
)
CUSTOM_KNOWLEDGE_FILE = os.getenv("CUSTOM_KNOWLEDGE_FILE", "knowledge/custom_knowledge.txt")
CUSTOM_KNOWLEDGE_TEXT = os.getenv("CUSTOM_KNOWLEDGE_TEXT", "")


def load_custom_knowledge() -> str:
    parts: list[str] = []

    if CUSTOM_KNOWLEDGE_TEXT.strip():
        parts.append(CUSTOM_KNOWLEDGE_TEXT.strip())

    knowledge_path = Path(CUSTOM_KNOWLEDGE_FILE)
    if not knowledge_path.is_absolute():
        knowledge_path = Path(__file__).resolve().parent / knowledge_path
    if knowledge_path.exists():
        content = knowledge_path.read_text(encoding="utf-8").strip()
        if content:
            parts.append(content)

    return "\n\n".join(parts).strip()


def build_instructions() -> str:
    knowledge = load_custom_knowledge()
    if not knowledge:
        return BASE_INSTRUCTIONS

    return (
        f"{BASE_INSTRUCTIONS}\n\n"
        "Use the following custom knowledge as trusted context. "
        "If the user asks about these details, prioritize this data.\n\n"
        f"{knowledge}"
    )


INSTRUCTIONS = build_instructions()


class VoiceAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=INSTRUCTIONS)


server = AgentServer()


@server.rtc_session(agent_name="guus-voice-agent")
async def entrypoint(ctx: agents.JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    await ctx.connect()

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(voice=VOICE),
    )

    await session.start(
        agent=VoiceAssistant(),
        room=ctx.room,
    )


if __name__ == "__main__":
    cli.run_app(server)
