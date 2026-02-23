# Guus Voice Agent

Single-repo implementation for a Tulip-branded voice agent product:

- `web/`: browser UI with animated avatar, text chat, and voice controls
- `api/`: Python FastAPI backend (sessions, chat, LiveKit token placeholder)
- `docs/`: architecture and product docs
- `scripts/`: manual AWS deployment scripts

## Current Build

### UI (`web/`)

- Tulip logo branding
- Animated smiley avatar with states: `idle`, `listening`, `thinking`, `speaking`, `happy`
- Text conversation panel
- Voice input controls (browser speech recognition for MVP preview)
- Speech synthesis for assistant responses where browser support exists

### API (`api/`)

- `GET /health`
- `POST /sessions`
- `GET /sessions/{session_id}`
- `POST /sessions/{session_id}/end`
- `POST /chat/message`
- `POST /livekit/token` (placeholder response to be replaced with real LiveKit JWT)

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

## AWS Deployment (API on ECS Fargate)

Manual laptop deployment script:

- `scripts/deploy_api_fargate.sh`

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

## Architecture And Product Docs

- `docs/architecture.md`
- `docs/backend-and-knowledge.md`
- `docs/avatar-ui.md`
- `docs/mvp-plan.md`
- `docs/android-native-transition.md`
- `docs/security-and-ops.md`

## Next Implementation Steps

1. Replace `POST /livekit/token` placeholder with real LiveKit JWT minting.
2. Add `agent-service/` runtime for LiveKit Agents + OpenAI Realtime.
3. Wire real voice events from the agent into avatar state updates.
4. Add Google Sheets and DynamoDB tool integrations in the agent layer.
