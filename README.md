# LiveKit Voice Agent Blueprint

Web-first architecture and delivery plan for building a natural, low-latency voice conversation app using LiveKit and OpenAI Realtime, with a later migration path to native Android.

## Goals

- Ship a browser MVP quickly to validate conversation quality.
- Reuse backend contracts when moving to Android native.
- Avoid building low-level speech pipeline orchestration from scratch.

## Stack At A Glance

- Client (Web MVP): React + Vite + LiveKit JS SDK
- Realtime transport: LiveKit room (WebRTC)
- Agent runtime: LiveKit Agents + OpenAI Realtime plugin
- Backend API: lightweight token/auth service (Python/FastAPI)
- Storage (optional): DynamoDB for session metadata and analytics
- Observability: OpenTelemetry + metrics dashboard (latency, interruption rate, reconnects)

## Documentation

- [Architecture](docs/architecture.md)
- [Backend and Knowledge Integration](docs/backend-and-knowledge.md)
- [MVP Plan](docs/mvp-plan.md)
- [Android Native Transition](docs/android-native-transition.md)
- [Security and Operations](docs/security-and-ops.md)

## Suggested Repository Layout

```text
.
├── README.md
├── docs/
│   ├── architecture.md
│   ├── backend-and-knowledge.md
│   ├── mvp-plan.md
│   ├── android-native-transition.md
│   └── security-and-ops.md
├── web/                 # browser client (React/Vite)
├── agent-service/       # LiveKit Agent process
└── api/                 # token/auth and app backend
```

## Delivery Sequence

1. Build web voice loop and validate quality.
2. Stabilize backend contracts and observability.
3. Add production hardening.
4. Build native Android client using same backend and agent.

## Success Metrics

- Median time to first assistant audio < 900 ms
- Turn interruption responsiveness < 300 ms
- Session success rate > 98%
- Reconnect recovery under 3 seconds on transient network drop

## Backend Summary

- API service (control plane): auth, token issuance, session lifecycle, rate limiting.
- Agent service (realtime plane): LiveKit Agent runtime, OpenAI Realtime orchestration, tool calls.
- LLM: managed OpenAI Realtime model invoked by the agent service.
- Custom sources: exposed via agent tools (RAG, SQL, REST, internal APIs), with per-user authorization.
