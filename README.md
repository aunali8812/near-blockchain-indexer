# Potlock NEAR Blockchain Indexer

A blockchain indexer for tracking donations on the Potlock platform (NEAR Protocol). Indexes direct donations, pot donations (quadratic funding), campaign donations, and referral fees.

## Features

- Real-time blockchain indexing from NEAR testnet
- Comprehensive donation tracking across multiple contract types
- Referral fee tracking and aggregation
- USD value calculations with historical price data
- RESTful API with pagination, filtering, and sorting
- Rate limiting (500 req/min)
- Swagger API documentation
- PostgreSQL database with optimized indexes
- Redis caching for performance
- Docker Compose for local development
- Automatic checkpoint/restart capability

## Technology Stack

- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **Cache**: Redis
- **ORM**: Prisma
- **Blockchain**: NEAR RPC API
- **Price Feed**: CoinGecko API

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

## Quick Start

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Start Database Services

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

### 3. Configure Environment

The `.env` file is already configured for local development. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NEAR_RPC_URL`: NEAR testnet RPC endpoint
- `START_BLOCK_HEIGHT`: Block to start indexing from (0 = current block - 10)
- `PORT`: API server port (default: 3000)

### 4. Initialize Database

```bash
npm run prisma:push
```

This creates the database schema.

### 5. Start the Application

```bash
npm run start:dev
```

The indexer will start processing blocks and the API will be available at:
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api/docs

## API Endpoints

### Account Endpoints

```
GET /api/v1/accounts
GET /api/v1/accounts/{account_id}
GET /api/v1/accounts/{account_id}/donation-summary
GET /api/v1/accounts/{account_id}/donations-sent
GET /api/v1/accounts/{account_id}/donations-received
GET /api/v1/accounts/{account_id}/referral-summary
```

### Stats Endpoints

```
GET /api/v1/stats
GET /api/v1/stats/leaderboard?type=donors&limit=100
```

### Query Parameters

**Pagination:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Filtering (donations endpoints):**
- `type`: DIRECT, POT, POT_PROJECT, CAMPAIGN
- `startDate`: ISO date string
- `endDate`: ISO date string
- `minAmount`: Minimum USD amount
- `maxAmount`: Maximum USD amount

**Sorting:**
- `sort`: field:order (e.g., `donatedAt:desc`, `amountUsd:asc`)

### Example Requests

Get top donors:
```bash
curl http://localhost:3000/api/v1/accounts?sort=totalDonatedUsd:desc&limit=10
```

Get account donation summary:
```bash
curl http://localhost:3000/api/v1/accounts/alice.testnet/donation-summary
```

Get donations sent with filters:
```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donations-sent?type=DIRECT&minAmount=100&sort=donatedAt:desc"
```

Get global stats:
```bash
curl http://localhost:3000/api/v1/stats
```

Get leaderboard:
```bash
curl "http://localhost:3000/api/v1/stats/leaderboard?type=donors&limit=50"
```

## Project Structure

```
src/
├── blockchain/          # Blockchain indexing logic
│   ├── near-rpc.service.ts       # NEAR RPC client
│   ├── event-parser.service.ts   # Event parsing
│   └── indexer.service.ts        # Main indexer loop
├── pricing/             # Price tracking
│   └── price.service.ts
├── accounts/            # Account endpoints
│   ├── accounts.controller.ts
│   └── accounts.service.ts
├── donations/           # Donation endpoints
│   ├── donations.controller.ts
│   └── donations.service.ts
├── stats/               # Stats endpoints
│   ├── stats.controller.ts
│   └── stats.service.ts
├── database/            # Database
│   ├── prisma.service.ts
│   └── database.module.ts
├── common/              # Shared utilities
│   └── dto/
├── app.module.ts
└── main.ts
```

## Database Schema

Key models:
- **Account**: Aggregated donation metrics per account
- **Donation**: Individual donation records
- **Pot**: Quadratic funding pots
- **PotPayout**: Pot payout distributions
- **Campaign**: Crowdfunding campaigns
- **TokenPrice**: Historical price data
- **IndexerCheckpoint**: Blockchain sync state

## Development

### Build

```bash
npm run build
```

### Start Production

```bash
npm run start:prod
```

### Database Management

View database in Prisma Studio:
```bash
npm run prisma:studio
```

Create migration:
```bash
npm run prisma:migrate
```

Reset database:
```bash
npx prisma migrate reset
```

## Configuration

### Indexer Configuration

- `START_BLOCK_HEIGHT`: Starting block (0 for current)
- `INDEXER_POLL_INTERVAL_MS`: Polling interval (default: 2000ms)

### Contracts Monitored

The indexer monitors any contract with "potlock" in the name on testnet:
- Direct donations: `donate.potlock.testnet`
- Pot factory: `potfactory.potlock.testnet`
- Any deployed pots: `*.pot.potlock.testnet`
- List registry: `lists.potlock.testnet`

### Price Feed

Uses CoinGecko free tier (50 calls/min):
- Fetches NEAR price every 5 minutes
- Caches in memory and database
- Falls back to historical data if API fails

## Performance

- API response time: <500ms (p95)
- Indexer processes ~1 block/second
- Supports 500 requests/minute
- Database queries optimized with indexes
- Redis caching for expensive queries

## Monitoring

Check indexer status:
- Last processed block stored in `IndexerCheckpoint` table
- Logs show processing progress
- Health can be monitored via `/api/v1/stats`

## Troubleshooting

### Indexer not starting

Check logs for:
- NEAR RPC connectivity
- Database connection
- Starting block height

### Database connection errors

Ensure PostgreSQL is running:
```bash
docker-compose ps
```

Restart services:
```bash
docker-compose restart
```

### NEAR RPC rate limits

The public RPC has rate limits. If you hit them:
- Increase `INDEXER_POLL_INTERVAL_MS`
- Use a dedicated RPC endpoint
- Implement exponential backoff (already included)

## Production Deployment

### AWS Deployment

See `DEPLOYMENT.md` for detailed AWS setup instructions including:
- RDS PostgreSQL
- ElastiCache Redis
- ECS Fargate or EC2
- Application Load Balancer
- CloudWatch monitoring

### Docker Build

```bash
docker build -t potlock-indexer .
docker run -p 3000:3000 --env-file .env potlock-indexer
```

## API Response Examples

### Account Summary Response

```json
{
  "account_id": "alice.testnet",
  "total_donated_usd": 1250.50,
  "total_donated_near": 500.0,
  "total_received_usd": 3200.75,
  "total_received_near": 1280.0,
  "donations_sent_count": 45,
  "donations_received_count": 12,
  "referral_fees_earned_usd": 125.30,
  "referral_fees_paid_usd": 35.20,
  "breakdown_by_type": {
    "direct_donations": {
      "sent_usd": 500.00,
      "received_usd": 200.00,
      "count_sent": 20,
      "count_received": 5
    },
    "pot_donations": {
      "sent_usd": 650.50,
      "received_usd": 2800.75,
      "count_sent": 20,
      "count_received": 5
    },
    "campaign_donations": {
      "sent_usd": 100.00,
      "received_usd": 200.00,
      "count_sent": 5,
      "count_received": 2
    }
  },
  "first_donation_date": "2023-01-15T10:30:00Z",
  "last_donation_date": "2024-11-10T14:22:00Z"
}
```

### Global Stats Response

```json
{
  "total_donations_usd": 1250000.50,
  "total_donations_near": 500000.0,
  "total_donations_count": 15420,
  "total_donors": 3245,
  "total_recipients": 892,
  "total_referral_fees_usd": 12500.30,
  "direct_donations_usd": 450000.00,
  "pot_donations_usd": 650000.50,
  "campaign_donations_usd": 150000.00
}
```
