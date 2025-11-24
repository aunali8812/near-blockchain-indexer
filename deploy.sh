#!/bin/bash

# NEAR Potlock Indexer - AWS ECS Deployment Script
# This script automates the deployment of the indexer to AWS ECS Fargate

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="potlock-indexer"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}NEAR Potlock Indexer - AWS Deployment${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME"
echo ""

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}ERROR: AWS CLI is not installed${NC}"
        echo "Please install AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    fi
    echo -e "${GREEN}✓ AWS CLI installed${NC}"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}ERROR: Docker is not installed${NC}"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker installed${NC}"
}

# Function to prompt for database password
get_db_password() {
    if [ -z "$DB_PASSWORD" ]; then
        echo -e "${YELLOW}Enter PostgreSQL database password (min 8 characters):${NC}"
        read -s DB_PASSWORD
        echo ""
    fi
}

# Function to prompt for CoinGecko API key
get_coingecko_key() {
    if [ -z "$COINGECKO_API_KEY" ]; then
        echo -e "${YELLOW}Enter CoinGecko API Key (optional, press enter to skip):${NC}"
        read -s COINGECKO_API_KEY
        echo ""
    fi
}

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
check_aws_cli
check_docker
get_db_password
get_coingecko_key

# Step 2: Deploy CloudFormation stack
echo -e "${YELLOW}Step 2: Deploying infrastructure with CloudFormation...${NC}"
aws cloudformation deploy \
    --template-file aws-infrastructure.yml \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --parameter-overrides \
        DatabasePassword="$DB_PASSWORD" \
        CoinGeckoApiKey="${COINGECKO_API_KEY:-}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset

echo -e "${GREEN}✓ Infrastructure deployed${NC}"

# Step 3: Get outputs from CloudFormation
echo -e "${YELLOW}Step 3: Retrieving infrastructure details...${NC}"
ECR_URI=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' \
    --output text)

ECS_CLUSTER=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' \
    --output text)

TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`TargetGroupArn`].OutputValue' \
    --output text)

ECS_SECURITY_GROUP=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' \
    --output text)

PUBLIC_SUBNET_1=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1Id`].OutputValue' \
    --output text)

PUBLIC_SUBNET_2=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' \
    --output text)

EXECUTION_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskExecutionRoleArn`].OutputValue' \
    --output text)

TASK_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ECSTaskRoleArn`].OutputValue' \
    --output text)

ALB_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' \
    --output text)

echo "ECR Repository: $ECR_URI"
echo "ECS Cluster: $ECS_CLUSTER"
echo -e "${GREEN}✓ Infrastructure details retrieved${NC}"

# Step 4: Build and push Docker image
echo -e "${YELLOW}Step 4: Building and pushing Docker image...${NC}"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Build Docker image
docker build -t $STACK_NAME:latest .

# Tag image
docker tag $STACK_NAME:latest $ECR_URI:latest

# Push to ECR
docker push $ECR_URI:latest

echo -e "${GREEN}✓ Docker image built and pushed${NC}"

# Step 5: Update task definition with actual values
echo -e "${YELLOW}Step 5: Creating ECS task definition...${NC}"

TASK_DEFINITION=$(cat <<EOF
{
  "family": "$STACK_NAME",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "$STACK_NAME",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {"name": "PORT", "value": "3000"},
        {"name": "NEAR_NETWORK", "value": "mainnet"},
        {"name": "NEAR_RPC_URL", "value": "https://rpc.fastnear.com"},
        {"name": "DIRECT_DONATIONS_CONTRACT", "value": "donate.potlock.near"},
        {"name": "POT_FACTORY_CONTRACT", "value": "potfactory.potlock.near"},
        {"name": "LIST_REGISTRY_CONTRACT", "value": "lists.potlock.near"},
        {"name": "START_BLOCK_HEIGHT", "value": "176000000"},
        {"name": "INDEXER_POLL_INTERVAL_MS", "value": "5000"},
        {"name": "PRICE_UPDATE_INTERVAL_MS", "value": "300000"},
        {"name": "RATE_LIMIT_TTL", "value": "60"},
        {"name": "RATE_LIMIT_MAX", "value": "500"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:$STACK_NAME/database-url"},
        {"name": "REDIS_HOST", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:$STACK_NAME/redis-host"},
        {"name": "REDIS_PORT", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:$STACK_NAME/redis-port"},
        {"name": "COINGECKO_API_KEY", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:$STACK_NAME/coingecko-key"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$STACK_NAME",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/stats || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF
)

# Register task definition
TASK_DEF_ARN=$(echo $TASK_DEFINITION | aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo -e "${GREEN}✓ Task definition registered: $TASK_DEF_ARN${NC}"

# Step 6: Create or update ECS service
echo -e "${YELLOW}Step 6: Creating ECS service...${NC}"

# Check if service exists
SERVICE_EXISTS=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $STACK_NAME \
    --region $AWS_REGION \
    --query 'services[0].status' \
    --output text 2>/dev/null || echo "INACTIVE")

if [ "$SERVICE_EXISTS" = "ACTIVE" ]; then
    echo "Service exists, updating..."
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $STACK_NAME \
        --task-definition $TASK_DEF_ARN \
        --region $AWS_REGION \
        --force-new-deployment \
        > /dev/null
    echo -e "${GREEN}✓ Service updated${NC}"
else
    echo "Creating new service..."
    aws ecs create-service \
        --cluster $ECS_CLUSTER \
        --service-name $STACK_NAME \
        --task-definition $TASK_DEF_ARN \
        --desired-count 1 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_1,$PUBLIC_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$STACK_NAME,containerPort=3000" \
        --region $AWS_REGION \
        > /dev/null
    echo -e "${GREEN}✓ Service created${NC}"
fi

# Step 7: Wait for service to stabilize
echo -e "${YELLOW}Step 7: Waiting for service to become stable (this may take a few minutes)...${NC}"
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $STACK_NAME \
    --region $AWS_REGION

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${GREEN}Your application is now deployed!${NC}"
echo ""
echo "API URL: http://$ALB_URL"
echo "Swagger Docs: http://$ALB_URL/api/docs"
echo "Health Check: http://$ALB_URL/api/v1/stats"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/$STACK_NAME --follow --region $AWS_REGION"
echo ""
echo "Monitor service:"
echo "  aws ecs describe-services --cluster $ECS_CLUSTER --services $STACK_NAME --region $AWS_REGION"
echo ""
echo -e "${YELLOW}Note: It may take a few minutes for the load balancer to become healthy.${NC}"
