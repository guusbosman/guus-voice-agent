# Guus Voice Agent

Single-repo implementation for a Tulip-branded voice agent product:

- `web/`: browser UI with animated avatar, text chat, and voice controls
- `api/`: Python FastAPI backend (sessions, chat, LiveKit token minting)
- `agent-service/`: LiveKit Agents worker using OpenAI Realtime
- `docs/`: architecture and product docs
- `scripts/`: manual AWS deployment scripts

## Current Build

### UI (`web/`)

- Tulip logo branding
- Animated smiley avatar with states: `idle`, `listening`, `thinking`, `speaking`, `happy`
- Text conversation panel
- Voice session controls backed by LiveKit room streaming
- Remote audio playback from agent track subscriptions

### API (`api/`)

- `GET /health`
- `POST /sessions`
- `GET /sessions/{session_id}`
- `POST /sessions/{session_id}/end`
- `POST /chat/message`
- `POST /livekit/token` (real LiveKit JWT with room join grant)
- `/livekit/token` also creates/ensures room and dispatches `LIVEKIT_AGENT_NAME`

Persistence is DynamoDB-first, with in-memory fallback for local development.

## Local Development

### 1. Run API

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Run Web

```bash
cd web
npm install
npm run dev
```

Optional web env:

```bash
# web/.env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Run Agent Service

```bash
cd agent-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python agent.py dev
```

## AWS Deployment (ECS Fargate)

Manual laptop deployment scripts:

- `scripts/deploy_api_fargate.sh`
- `scripts/deploy_agent_fargate.sh`

Example:

```bash
AWS_ACCOUNT_ID=123456789012 \
AWS_REGION=us-east-1 \
EXECUTION_ROLE_ARN=arn:aws:iam::123456789012:role/ecsTaskExecutionRole \
TASK_ROLE_ARN=arn:aws:iam::123456789012:role/guus-voice-agent-api-task-role \
SUBNET_IDS=subnet-aaa,subnet-bbb \
SECURITY_GROUP_IDS=sg-abc123 \
./scripts/deploy_api_fargate.sh
```

Reference task definition template:

- `infra/ecs-task-definitions/api-task-definition.example.json`
- `infra/ecs-task-definitions/agent-task-definition.example.json`

## Architecture And Product Docs

- `docs/architecture.md`
- `docs/backend-and-knowledge.md`
- `docs/avatar-ui.md`
- `docs/mvp-plan.md`
- `docs/android-native-transition.md`
- `docs/security-and-ops.md`

## Next Implementation Steps

1. Add Google Sheets and DynamoDB tool calls inside `agent-service/agent.py`.
2. Wire realtime agent events to richer avatar behaviors (nod/smile/think transitions).
3. Add auth and rate limiting middleware to API endpoints.
4. Split web bundle chunks to reduce initial payload size.
