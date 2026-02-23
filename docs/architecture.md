# Architecture (Web First)

## Scope

Single-user, real-time voice dialogue with natural turn-taking and interruption support.

## High-Level Components

1. Web client
- Captures microphone audio.
- Joins a LiveKit room with a short-lived access token.
- Plays assistant audio stream and renders incremental transcript UI.

2. Agent service
- Runs LiveKit Agent worker.
- Subscribes to user audio track.
- Uses OpenAI Realtime model/plugin for speech-to-speech dialogue.
- Emits transcript and state events (turn start/end, interruption, errors).

3. API backend
- Authenticates app user.
- Issues short-lived LiveKit tokens and session identifiers.
- Optionally stores session metadata for analytics/cost tracking.

4. Optional data store
- Persists session summaries, tool calls, user preferences.

## Core Session Flow

1. User logs in to web app.
2. Web app requests token from `POST /livekit/token`.
3. API validates user and returns:
- `livekit_url`
- `room_name`
- `participant_token` (short TTL)
- `session_id`
4. Web app connects to room and publishes microphone track.
5. Agent joins same room and starts dialogue.
6. Agent returns speech audio + transcript events.
7. On end, client calls `POST /sessions/{id}/close` (optional) for cleanup/analytics.

## Event Model (Stable Contract)

Use these event types across web and future Android clients:

- `session.started`
- `turn.user.started`
- `turn.user.final`
- `turn.agent.started`
- `turn.agent.partial`
- `turn.agent.final`
- `turn.interrupted`
- `session.error`
- `session.ended`

Each event should include:

- `session_id`
- `timestamp`
- `event_type`
- `payload`
- `trace_id` (for observability correlation)

## Design Choices

- Keep conversation orchestration in agent service, not in client.
- Keep token issuance in API backend, never in frontend.
- Keep client UI stateless where possible; recover state from server events when reconnecting.

## Failure Handling

- Token expiry before connect: client retries token fetch once.
- Room disconnect: exponential backoff reconnect (max 5 attempts).
- Agent crash: auto-restart worker and emit `session.error` to client.
- OpenAI upstream timeout: emit fallback voice/text response and ask user to retry.

