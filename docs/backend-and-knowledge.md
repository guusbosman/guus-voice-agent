# Backend and Knowledge Integration

## Recommended Backend Topology

Use two services, each with a clear responsibility boundary.

1. API service (control plane)
- Handles authentication and authorization.
- Mints short-lived LiveKit access tokens.
- Creates and tracks sessions (`session_id`, timestamps, status).
- Enforces rate limits and abuse prevention.

2. Agent service (realtime plane)
- Runs LiveKit Agent workers.
- Connects voice stream to OpenAI Realtime model.
- Manages turn-taking and interruptions.
- Executes tools/functions to fetch custom data.
- Emits structured events and telemetry.

Optional support services:

- DynamoDB for session metadata, summaries, and audit trails.
- Redis for rate limiting, short-lived state, and idempotency keys.

## Where The LLM Lives

The LLM is accessed through OpenAI Realtime from the agent service. You do not need to run your own LLM server for the MVP.

Flow:

1. Client publishes mic audio to LiveKit.
2. Agent service receives audio track.
3. Agent calls OpenAI Realtime.
4. Realtime returns assistant audio/text.
5. Agent sends results to room and logs turn events.

## Custom Source Access Pattern

Keep this simple for MVP: expose Google Sheets and DynamoDB through a few agent tools.

Example tools:

- `sheet_lookup(sheet_id, worksheet, filters)`
- `sheet_append_row(sheet_id, worksheet, row_data)`
- `dynamo_get_item(table_name, key)`
- `dynamo_query(table_name, key_condition, limit)`

Each tool should:

- Validate caller identity.
- Apply source-level authorization checks (which sheets/tables this user may access).
- Time out quickly with graceful fallback.
- Return structured JSON suitable for model grounding.

## Data Retrieval Options

1. Google Sheets-backed data
- Use a service account with scoped access only to approved spreadsheets.
- Normalize sheet rows into predictable JSON field names.
- Cache read results briefly to reduce API latency and quota pressure.

2. DynamoDB-backed data
- Use table-specific adapters to hide raw key expressions from the model.
- Validate all query inputs against allowlisted table/index names.
- Return compact result objects (avoid raw unbounded table dumps).

3. Simple hybrid responses
- Start with a DynamoDB lookup first, then enrich with Google Sheets info when needed.
- Include source identifiers in payloads for traceability (`source: \"dynamodb:table\"` or `source: \"sheet:sheet_id\"`).

## Safety and Governance

- Never let the client call private data sources directly.
- Keep all credentials in backend secret manager.
- Log tool invocation metadata (`tool_name`, `duration_ms`, `status`, `trace_id`).
- Redact PII in logs by default.
- Enforce per-user and per-tenant query budgets.

## Minimal API Contract (v1)

- `POST /livekit/token`
- `POST /sessions`
- `POST /sessions/{id}/end`
- `GET /sessions/{id}`

Token response fields (minimum):

- `livekit_url`
- `room_name`
- `participant_token`
- `session_id`
- `expires_at`

## Suggested Tech Choices

If optimizing for speed of delivery:

- API service: FastAPI
- Agent service: Python LiveKit Agents runtime
- Storage: DynamoDB + Redis
- Observability: OpenTelemetry + Prometheus/Grafana (or hosted equivalent)

## Scalability Notes

- Scale API service horizontally behind a load balancer.
- Scale agent workers based on active sessions.
- Keep agent workers stateless; store durable state in DynamoDB.
- Use queue-based buffering for async post-processing (summaries, analytics).
