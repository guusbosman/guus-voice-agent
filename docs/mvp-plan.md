# MVP Plan

## Timeline

2-3 weeks for a working browser MVP, depending on design polish and testing depth.

## Milestone 1: Voice Loop (Week 1)

Deliverables:

- LiveKit room connection from browser.
- Agent receives user speech and returns assistant speech.
- Basic transcript panel with turn boundaries.

Acceptance criteria:

- End-to-end voice conversation works for 5+ minute session.
- User can interrupt assistant mid-response.
- No secrets exposed in frontend.

## Milestone 2: Product Reliability (Week 2)

Deliverables:

- Reconnect logic on network interruptions.
- Structured events for turns/session lifecycle.
- Latency and error metrics dashboard.

Acceptance criteria:

- Recovery from brief network drop without full restart.
- Turn events are complete and ordered per `session_id`.
- Error rate low enough for internal dogfooding.

## Milestone 3: Hardening (Week 3)

Deliverables:

- Rate limiting and token abuse protection.
- Session logging with PII-minimization policy.
- Cost tracking per session/user.

Acceptance criteria:

- Access tokens short-lived and scoped.
- Basic operational runbook exists.
- Canary users can use app daily with stable quality.

## Out Of Scope (MVP)

- Multi-party rooms.
- Telephony/SIP.
- Deep long-term memory personalization.
- Native mobile app UI.

