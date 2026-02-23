# Security and Operations

## Security Baseline

1. Key handling
- Keep provider API keys server-side only.
- Use short-lived LiveKit access tokens from backend.
- Rotate signing keys on schedule.

2. AuthN/AuthZ
- Require authenticated app user for token minting.
- Bind token identity to user/session.
- Restrict room permissions to minimum required.

3. Data handling
- Avoid storing raw audio by default.
- Store only metadata and redacted transcripts when possible.
- Define retention windows and deletion process.

## Abuse Prevention

- Per-user and per-IP rate limits on token endpoint.
- Session duration cap and concurrency cap.
- Blocklist policy for repeated abuse.

## Observability

Track at minimum:

- Time to first assistant audio
- End-to-end turn latency
- Interrupt success rate
- Session drops and reconnect duration
- Token mint failures
- Agent worker restarts

## Operations Runbook (Minimum)

- Incident severity levels and on-call owner
- Health checks for API and agent worker
- Rollback procedure for agent deployment
- Dependency outage behavior (degraded mode messaging)

## Deployment Model

- Runtime: ECS on Fargate for `api` and `agent-service`.
- Container registry: Amazon ECR.
- Delivery: manual deploys from developer laptop (no GitHub Actions).
- Minimum manual deployment steps:
1. Build and tag container image locally.
2. Push image to ECR.
3. Update ECS task definition image tag.
4. Trigger ECS service deployment.
5. Verify health checks and rollback if needed.

## Cost Controls

- Per-session usage accounting
- Daily budget alarms
- Automatic cutoff thresholds for abusive spikes
