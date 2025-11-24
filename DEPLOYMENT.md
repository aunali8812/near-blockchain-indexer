# AWS Deployment Guide

## Why ECS Fargate?

After looking at the options, ECS Fargate makes the most sense for this application. Lambda won't work because it has a 15-minute execution limit and this indexer needs to run continuously 24/7 polling the blockchain. EC2 would work but we'd have to manage servers, do OS updates, handle security patches - all that operational overhead we'd rather avoid.

Fargate is the sweet spot. It's designed for long-running containerized applications like this one, there's no server management, and we can use AWS Free Tier effectively.

The architecture is as follows: Our containerized app runs on Fargate, connects to RDS PostgreSQL and ElastiCache Redis, and sits behind an Application Load Balancer that handles incoming traffic.

## What It'll Cost

If we're on the AWS Free Tier (first 12 months), we can run the database and Redis for free using db.t3.micro and cache.t3.micro instances. The only real cost is the load balancer at around $16-20 per month. After the free tier expires, expect around $60-75 per month total.

You can reduce costs further by using Fargate Spot instances which can save up to 70%, or just stop our development environments when we're not using them.

## Prerequisites

We need an AWS account, AWS CLI installed and configured, and Docker running locally. If we don't have AWS CLI set up yet, install it and run `aws configure` to add our credentials.

## Quick Deployment

The easiest way is to use the deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

It'll walk us through everything: deploying the infrastructure, building our Docker image, pushing it to ECR, and creating the ECS service. When it's done we'll get the URL where our API is running.

## Manual Deployment

If the script doesn't work or we want more control, here's the manual process:

First, deploy the infrastructure using CloudFormation:

```bash
aws cloudformation deploy \
  --template-file aws-infrastructure.yml \
  --stack-name potlock-indexer \
  --region us-east-1 \
  --parameter-overrides \
      DatabasePassword="YourSecurePassword123!" \
      CoinGeckoApiKey="" \
  --capabilities CAPABILITY_NAMED_IAM
```

This takes about 10-15 minutes to create the VPC, subnets, security groups, RDS database, Redis cache, load balancer, and everything else we need.

Once that's done, get our ECR repository URI:

```bash
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name potlock-indexer \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryUri`].OutputValue' \
  --output text)
```

Build and push our Docker image:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

docker build -t potlock-indexer:latest .
docker tag potlock-indexer:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

Now we need to grab a bunch of values from CloudFormation for the ECS service. Get the cluster name, target group ARN, security group, subnet IDs, and role ARNs using similar commands as above with different OutputKey values.

Update the `aws-ecs-task-definition.json` file with our actual AWS account ID, region, and the ECR image URI. Then register it:

```bash
aws ecs register-task-definition \
  --cli-input-json file://aws-ecs-task-definition.json \
  --region us-east-1
```

Finally, create the ECS service that actually runs our application:

```bash
aws ecs create-service \
  --cluster $ECS_CLUSTER \
  --service-name potlock-indexer \
  --task-definition potlock-indexer \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_1,$PUBLIC_SUBNET_2],securityGroups=[$ECS_SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=potlock-indexer,containerPort=3000" \
  --region us-east-1
```

Wait for the service to stabilize with `aws ecs wait services-stable` and then grab our load balancer URL to access the API.

## Checking Everything Works

Test the API endpoint at our load balancer URL:

```bash
curl http://our-alb-url.amazonaws.com/api/v1/stats
```

You can view logs in real-time to see what's happening:

```bash
aws logs tail /ecs/potlock-indexer --follow --region us-east-1
```

The Swagger documentation will be available at `/api/docs` on our load balancer URL.

## Updating Your Application

When we make code changes, just rebuild and push the image, then force a new deployment:

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

## Troubleshooting

If the service won't start, check the logs first. Most issues are either database connection problems (check our security groups allow port 5432) or the application not binding to port 3000 properly.

For database issues, verify the connection string in Secrets Manager is correct and that the RDS instance is actually running. Redis problems are usually also security group related, make sure port 6379 is accessible.

If we see health check failures, the load balancer is trying to hit `/api/v1/stats` and not getting a 200 response. Make sure our app is actually running and responding on that endpoint.

## Scaling

You can scale horizontally by increasing the desired count:

```bash
aws ecs update-service \
  --cluster potlock-indexer-cluster \
  --service potlock-indexer \
  --desired-count 2 \
  --region us-east-1
```

For auto-scaling based on CPU or memory, use Application Auto Scaling to set target tracking policies. The basic idea is to register a scalable target and then create a scaling policy that adjusts based on metrics like CPU utilization.

## Cleaning Up

To delete everything and stop charges:

```bash
aws ecs update-service \
  --cluster potlock-indexer-cluster \
  --service potlock-indexer \
  --desired-count 0 \
  --region us-east-1

aws ecs delete-service \
  --cluster potlock-indexer-cluster \
  --service potlock-indexer \
  --force \
  --region us-east-1

aws cloudformation delete-stack \
  --stack-name potlock-indexer \
  --region us-east-1
```

The RDS database will create a final snapshot before deletion by default.

## Production Improvements

For a production deployment we should add a custom domain with HTTPS using ACM certificates. Set up CloudWatch alarms for high CPU usage, database connections, and error rates. Consider moving the ECS tasks to private subnets with a NAT Gateway for better security.

Enable VPC Flow Logs and CloudTrail for monitoring and auditing. If we're expecting high traffic, add AWS WAF in front of the load balancer for DDoS protection. Make sure to rotate our database credentials regularly through Secrets Manager.

## CI/CD Pipeline

You can automate deployments with GitHub Actions or AWS CodePipeline. The basic flow is: push to main branch, build Docker image, push to ECR, update ECS service. This way we don't have to manually deploy every time we make changes.
