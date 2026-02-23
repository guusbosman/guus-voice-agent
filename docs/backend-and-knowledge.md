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

- Postgres for session metadata, summaries, and audit trails.
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

Expose your private data as tools callable by the agent.

Example tools:

- `search_knowledge_base(query)`
- `get_customer_profile(customer_id)`
- `lookup_internal_policy(topic)`
- `get_order_status(order_id)`

Each tool should:

- Validate caller identity and tenant scope.
- Apply source-level authorization checks.
- Time out quickly with graceful fallback.
- Return structured JSON suitable for model grounding.

## Data Retrieval Options

1. Unstructured content (docs, notes, manuals)
- Index chunks in a vector database.
- Retrieve top-k by semantic similarity.
- Return snippets with source identifiers.

2. Structured business data
- Query SQL/REST backends directly via tool adapters.
- Use strict schemas and input validation.

3. Hybrid responses
- Combine vector retrieval with transactional data lookup.
- Include citations in tool payload for traceability.

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
- Storage: Postgres + Redis
- Observability: OpenTelemetry + Prometheus/Grafana (or hosted equivalent)

If your team is TypeScript-heavy, keep API in NestJS and maintain the agent service separately in Python.

## Scalability Notes

- Scale API service horizontally behind a load balancer.
- Scale agent workers based on active sessions.
- Keep agent workers stateless; store durable state in Postgres.
- Use queue-based buffering for async post-processing (summaries, analytics).
