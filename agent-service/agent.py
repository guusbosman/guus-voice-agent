import os

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, cli
from livekit.plugins import openai

load_dotenv()

VOICE = os.getenv("OPENAI_REALTIME_VOICE", "marin")
INSTRUCTIONS = os.getenv(
    "OPENAI_REALTIME_INSTRUCTIONS",
    "You are a helpful, concise voice assistant. Keep responses clear and practical.",
)


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
