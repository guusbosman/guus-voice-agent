# Android Native Transition Plan

## Principle

Treat web as a validation client. Keep backend APIs and event schema stable so Android becomes a client swap, not a platform rewrite.

## Reuse Without Change

- LiveKit infrastructure and room model
- Agent service and conversation orchestration
- API endpoints (`/livekit/token`, session lifecycle)
- Event schema and analytics pipeline
- Safety and moderation policies

## Android-Specific Work

1. Client stack
- Kotlin app with LiveKit Android SDK
- Native audio session handling
- Runtime permissions (`RECORD_AUDIO`, optional Bluetooth permissions)

2. Audio routing
- Handle speaker/earpiece/Bluetooth transitions.
- Preserve intelligibility under noisy conditions.

3. Lifecycle and resiliency
- Foreground service strategy when session active.
- Graceful pause/resume on app background transitions.
- Reconnection strategy tuned for mobile network volatility.

4. UX refinements
- Push-to-talk fallback mode.
- Partial transcript rendering tuned for small screens.
- Clear in-call state and mute controls.

## Native Readiness Gate

Move to Android native once web metrics meet targets for at least 2 consecutive weeks:

- Stable latency percentile targets
- Low interruption-handling failure rate
- Low reconnection failure rate
- Known top 5 production issues have mitigations

