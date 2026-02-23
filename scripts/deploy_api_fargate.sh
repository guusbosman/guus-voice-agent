#!/usr/bin/env bash
set -euo pipefail

# Manual deploy script for FastAPI service on ECS Fargate.
# Prerequisites:
# - aws CLI configured on this laptop
# - docker installed
# - IAM permissions for ECR, ECS, IAM PassRole

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
ECR_REPOSITORY="${ECR_REPOSITORY:-guus-voice-agent-api}"
ECS_CLUSTER="${ECS_CLUSTER:-guus-voice-agent-cluster}"
ECS_SERVICE="${ECS_SERVICE:-guus-voice-agent-api-service}"
TASK_FAMILY="${TASK_FAMILY:-guus-voice-agent-api-task}"
EXECUTION_ROLE_ARN="${EXECUTION_ROLE_ARN:-}"
TASK_ROLE_ARN="${TASK_ROLE_ARN:-}"
SUBNET_IDS="${SUBNET_IDS:-}"
SECURITY_GROUP_IDS="${SECURITY_GROUP_IDS:-}"
DESIRED_COUNT="${DESIRED_COUNT:-1}"
CPU="${CPU:-512}"
MEMORY="${MEMORY:-1024}"
CONTAINER_PORT="${CONTAINER_PORT:-8000}"

if [[ -z "${AWS_ACCOUNT_ID}" ]]; then
  echo "ERROR: AWS_ACCOUNT_ID is required"
  exit 1
fi

if [[ -z "${EXECUTION_ROLE_ARN}" || -z "${TASK_ROLE_ARN}" ]]; then
  echo "ERROR: EXECUTION_ROLE_ARN and TASK_ROLE_ARN are required"
  exit 1
fi

if [[ -z "${SUBNET_IDS}" || -z "${SECURITY_GROUP_IDS}" ]]; then
  echo "ERROR: SUBNET_IDS and SECURITY_GROUP_IDS are required"
  exit 1
fi

IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/api"

echo "==> Ensuring ECR repository exists"
aws ecr describe-repositories \
  --repository-names "${ECR_REPOSITORY}" \
  --region "${AWS_REGION}" >/dev/null 2>&1 || \
aws ecr create-repository \
  --repository-name "${ECR_REPOSITORY}" \
  --region "${AWS_REGION}" >/dev/null

echo "==> Logging into ECR"
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> Building API image: ${ECR_URI}"
docker build -t "${ECR_URI}" "${API_DIR}"

echo "==> Pushing image"
docker push "${ECR_URI}"

echo "==> Registering task definition"
TASK_DEF_FILE="$(mktemp)"
cat > "${TASK_DEF_FILE}" <<JSON
{
  "family": "${TASK_FAMILY}",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "${CPU}",
  "memory": "${MEMORY}",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "${ECR_URI}",
      "essential": true,
      "portMappings": [
        {
          "containerPort": ${CONTAINER_PORT},
          "hostPort": ${CONTAINER_PORT},
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${TASK_FAMILY}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
JSON

aws logs create-log-group --log-group-name "/ecs/${TASK_FAMILY}" --region "${AWS_REGION}" >/dev/null 2>&1 || true
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${TASK_DEF_FILE}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "==> Ensuring ECS cluster exists"
aws ecs describe-clusters --clusters "${ECS_CLUSTER}" --region "${AWS_REGION}" \
  --query 'clusters[0].clusterName' --output text >/dev/null 2>&1 || \
aws ecs create-cluster --cluster-name "${ECS_CLUSTER}" --region "${AWS_REGION}" >/dev/null

echo "==> Creating or updating ECS service"
if aws ecs describe-services --cluster "${ECS_CLUSTER}" --services "${ECS_SERVICE}" --region "${AWS_REGION}" \
  --query 'services[0].serviceName' --output text 2>/dev/null | grep -q "${ECS_SERVICE}"; then
  aws ecs update-service \
    --cluster "${ECS_CLUSTER}" \
    --service "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF_ARN}" \
    --force-new-deployment \
    --region "${AWS_REGION}" >/dev/null
  echo "Updated service: ${ECS_SERVICE}"
else
  aws ecs create-service \
    --cluster "${ECS_CLUSTER}" \
    --service-name "${ECS_SERVICE}" \
    --task-definition "${TASK_DEF_ARN}" \
    --desired-count "${DESIRED_COUNT}" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SECURITY_GROUP_IDS}],assignPublicIp=ENABLED}" \
    --region "${AWS_REGION}" >/dev/null
  echo "Created service: ${ECS_SERVICE}"
fi

echo "Deploy complete."
echo "Image: ${ECR_URI}"
echo "Task definition: ${TASK_DEF_ARN}"
