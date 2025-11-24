# AWS Deployment Files

This directory contains everything you need to deploy the NEAR Potlock Indexer to AWS ECS Fargate.

## Files Overview

**aws-infrastructure.yml**
CloudFormation template that creates all the AWS resources you need. This includes the VPC, subnets, security groups, RDS PostgreSQL database, ElastiCache Redis, Application Load Balancer, ECS cluster, IAM roles, and ECR repository. It's a complete infrastructure-as-code setup.

**aws-ecs-task-definition.json**
Defines how your Docker container should run on ECS. Specifies CPU, memory, environment variables, secrets, logging configuration, and health checks. You'll need to update the placeholder values with your actual AWS account ID and region.

**deploy.sh**
Automated deployment script that handles everything: validates prerequisites, deploys infrastructure, builds your Docker image, pushes it to ECR, and creates the ECS service. This is the easiest way to deploy.

**DEPLOYMENT.md**
Complete deployment guide with instructions for both automated and manual deployment, troubleshooting tips, and production best practices.

**.env.production.example**
Template for production environment variables. The actual secrets will be stored in AWS Secrets Manager for security.

## Quick Start

The simplest deployment path is:

1. Make sure you have AWS CLI and Docker installed
2. Configure AWS CLI with your credentials: `aws configure`
3. Run the deployment script: `./deploy.sh`
4. Wait for it to complete and grab your API URL

If you prefer manual control, follow the step-by-step instructions in DEPLOYMENT.md.

## What Gets Created

Running the deployment creates:
- VPC with public and private subnets across 2 availability zones
- Internet gateway and route tables for network connectivity
- Security groups controlling traffic between components
- RDS PostgreSQL database (db.t3.micro, free tier eligible)
- ElastiCache Redis cluster (cache.t3.micro, free tier eligible)
- Application Load Balancer for distributing traffic
- ECS Fargate cluster and service running your container
- ECR repository for storing your Docker images
- CloudWatch log groups for application logs
- Secrets Manager secrets for database credentials and API keys
- IAM roles for ECS task execution

## Cost Expectations

Free tier (first 12 months): Around $16-20/month for just the load balancer.
After free tier: Around $60-75/month total.

You can reduce costs by using Fargate Spot instances and stopping non-production environments when not in use.

## Architecture

The deployed application follows this flow:

```
Internet → Application Load Balancer → ECS Fargate Tasks
                                            ↓
                                    RDS PostgreSQL
                                            ↓
                                    ElastiCache Redis
```

All database credentials are stored securely in AWS Secrets Manager and injected into the container at runtime. Logs go to CloudWatch for easy monitoring.

## Updating After Deployment

When you make code changes, rebuild and push your Docker image, then force a new deployment:

```bash
docker build -t potlock-indexer:latest .
docker tag potlock-indexer:latest $ECR_URI:latest
docker push $ECR_URI:latest

aws ecs update-service \
  --cluster potlock-indexer-cluster \
  --service potlock-indexer \
  --force-new-deployment \
  --region us-east-1
```

## Monitoring

View logs in real-time:
```bash
aws logs tail /ecs/potlock-indexer --follow --region us-east-1
```

Check service health:
```bash
aws ecs describe-services \
  --cluster potlock-indexer-cluster \
  --services potlock-indexer \
  --region us-east-1
```

## Cleanup

To delete everything and avoid charges:

```bash
aws ecs delete-service --cluster potlock-indexer-cluster --service potlock-indexer --force --region us-east-1
aws cloudformation delete-stack --stack-name potlock-indexer --region us-east-1
```

This will remove all resources. The RDS database creates a final snapshot before deletion so you can restore later if needed.
