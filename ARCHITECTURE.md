# Architecture Documentation

This document outlines the system architecture and design decisions for the Potlock NEAR blockchain indexer.

## Overview

The indexer is a real-time blockchain data processing system that monitors NEAR Protocol for Potlock-related transactions, processes donation events, and exposes the data through a RESTful API.

### Core Components

```
NEAR Blockchain → Indexer → PostgreSQL → REST API → Clients
                     ↓
                Price Service
```

## System Architecture

### 1. Blockchain Indexer

The indexer (`src/blockchain/indexer.service.ts`) continuously polls the NEAR RPC endpoint for new blocks and processes them sequentially.

**Key Responsibilities:**
- Fetch blocks from NEAR Protocol
- Extract and parse transaction receipts
- Coordinate event parsing and data storage
- Maintain checkpoint state for resumability

**Processing Flow:**
```
Block → Chunks → Receipt Execution Outcomes → Event Logs → Parsed Data
```

The indexer processes receipts rather than transactions directly, as NEAR's execution model emits events through receipt logs. Each receipt can contain multiple EVENT_JSON logs that represent donation events.

**Checkpoint Mechanism:**

The system maintains a single checkpoint record tracking the last successfully processed block. On startup, the indexer either:
- Resumes from the last checkpoint if available
- Starts from the configured `START_BLOCK_HEIGHT`
- Defaults to current block height minus 10 if no configuration exists

This design ensures the indexer can safely restart without data loss or duplication.

### 2. Event Parser

The parser (`src/blockchain/event-parser.service.ts`) extracts structured donation data from blockchain event logs.

**Supported Event Types:**
- `donate` - Direct donations between accounts
- `pot_donate` - Contributions to quadratic funding pots
- `pot_project_donation` - QF round donations to specific projects
- `campaign_donate` - Campaign contributions
- `pot_payout` - Distribution of funds from pots to projects

**Event Format:**

Events follow the Potlock standard with JSON structure:
```json
{
  "standard": "potlock",
  "version": "1.0.0",
  "event": "donate",
  "data": { /* event-specific fields */ }
}
```

The parser validates event structure and extracts relevant fields based on event type, handling missing or malformed data gracefully.

### 3. Price Service

The price service (`src/pricing/price.service.ts`) handles NEAR to USD conversion for all monetary values.

**Functionality:**
- Fetches current NEAR/USD price from CoinGecko API
- Caches prices in-memory and persists to database
- Provides historical price lookup for backdated conversions
- Falls back to last known price if external API unavailable

**Conversion Process:**
1. Convert yoctoNEAR (10^-24) to NEAR amount
2. Retrieve USD price at donation timestamp
3. Calculate USD value using historical rate

### 4. Database Layer

PostgreSQL database managed through Prisma ORM with the following data model:

**Primary Models:**

**Account** - Aggregated metrics per blockchain account
- Total donated/received amounts (NEAR and USD)
- Donation counts by type (direct, pot, campaign)
- Referral fee tracking
- Temporal data (first/last donation dates)

**Donation** - Individual donation records
- Donor, recipient, and referrer references
- Amounts in NEAR and USD
- Fee breakdowns (protocol, referrer, chef)
- Blockchain metadata (transaction hash, block height, timestamp)

**Pot** - Quadratic funding rounds
- Related donations and payouts

**Campaign** - Crowdfunding campaigns
- Related donations

**TokenPrice** - Historical price data
- Token ID, USD price, timestamp
- Indexed for efficient historical lookups

**IndexerCheckpoint** - Sync state tracking
- Last processed block height, hash, and timestamp

**Design Pattern:**

The system uses denormalized aggregates in the Account table. While donation data is stored individually, aggregate metrics are pre-calculated and updated incrementally. This trades some storage and update complexity for significantly faster query performance.

### 5. REST API

NestJS-based REST API providing access to indexed data.

**Module Organization:**
- `accounts` - Account information and donation history
- `stats` - Platform-wide statistics and leaderboards
- `donations` - Donation queries (currently integrated with accounts)

**Features:**
- Pagination support with configurable limits
- Filtering by donation type, date range, amount
- Sorting on multiple fields
- Rate limiting (500 requests/minute)
- Swagger/OpenAPI documentation

## Data Flow

### Indexing Pipeline

```
┌──────────────────────────────────────────────────────────┐
│ 1. NEAR RPC Service fetches block by height              │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ 2. Indexer extracts chunks and receipt execution outcomes│
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ 3. Event Parser identifies and parses EVENT_JSON logs    │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ 4. Price Service converts amounts to USD                 │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ 5. Database transaction:                                 │
│    - Create/update accounts                              │
│    - Insert donation record                              │
│    - Update aggregate metrics                            │
│    - Update checkpoint                                   │
└──────────────────────────────────────────────────────────┘
```

### API Request Flow

```
Client Request
      │
      ▼
Controller (validation, routing)
      │
      ▼
Service (business logic)
      │
      ▼
Prisma Service (query builder)
      │
      ▼
PostgreSQL (indexed queries)
      │
      ▼
JSON Response
```

## Design Decisions

### Sequential Block Processing

Blocks are processed sequentially rather than in parallel to ensure:
- Consistent checkpoint state
- No race conditions on aggregate updates
- Deterministic ordering of donations
- Simplified error recovery

The processing rate (~1 block/second) matches NEAR's block production rate, making parallelization unnecessary.

### Aggregate Denormalization

Account-level aggregates are pre-calculated and stored rather than computed on-demand because:
- Leaderboard queries require sorting across all accounts
- Summing thousands of donations per request creates performance bottlenecks
- Read-heavy workload benefits from write-time computation
- Database indexes on aggregates enable efficient filtering and sorting

### Error Handling Strategy

The system prioritizes availability over strict consistency:
- Network errors trigger retry with backoff
- Parse errors are logged but don't halt processing
- Duplicate transactions are silently ignored (prevented by unique constraints)
- Missing price data falls back to nearest available price

This approach ensures the indexer continues processing new blocks even when individual transactions fail.

### Checkpoint Implementation

Single-row checkpoint pattern provides:
- Atomic updates (single row transaction)
- Simple state management
- Efficient queries (no table scans)
- Clear restart semantics

The indexer validates checkpoint integrity on startup and resets if inconsistencies are detected.

## Performance Considerations

### Current Metrics
- Indexing throughput: ~1 block/second
- API response time: <500ms (p95)
- Database size: ~500KB per 1,000 donations
- Memory footprint: ~200MB

### Bottlenecks
- NEAR RPC rate limits (public endpoints)
- CoinGecko API rate limits (50 calls/minute on free tier)
- Database aggregate updates (multiple queries per donation)

### Optimization Strategies
- Use dedicated NEAR RPC endpoint
- Implement Redis caching for API responses
- Batch database operations where possible
- Add read replicas for API query separation
- Optimize database indexes for common query patterns

## Database Indexing Strategy

Indexes are designed around common query patterns:

```
Account:
- totalDonatedUsd (DESC) → donor leaderboards
- totalReceivedUsd (DESC) → recipient leaderboards
- referralFeesEarnedUsd (DESC) → referrer rankings

Donation:
- (donorId, donatedAt DESC) → user donation history
- (recipientId, donatedAt DESC) → received donations
- (type, donatedAt DESC) → type-filtered queries
- amountUsd (DESC) → largest donation queries
- blockHeight → block-based lookups
```

These composite and single-column indexes cover the majority of API query patterns without requiring full table scans.

## Security Model

**Current Implementation:**
- API rate limiting prevents abuse
- Input validation on all parameters
- Prisma ORM prevents SQL injection
- Environment-based configuration management

**Deployment Considerations:**
- API is designed for public read access
- HTTPS should be terminated at load balancer
- Sensitive configuration via environment variables
- Database access restricted to application layer

For restricted access deployments, consider adding API authentication or network-level controls.

## Monitoring and Observability

**Key Metrics:**
- Last processed block height (should continuously increase)
- Block processing latency
- Database connection pool utilization
- API response times and error rates
- NEAR RPC errors (indicates rate limiting)

**Health Checks:**
- API health: Query `/api/v1/stats` endpoint
- Indexer health: Check `IndexerCheckpoint.updatedAt` timestamp
- Database health: Connection pool status

**Logging:**
The application provides structured logging at multiple levels:
- Block processing progress
- Event parsing results
- Database operations
- External API calls
- Error conditions with context

## Scalability Path

**Vertical Scaling:**
- Increase database resources for larger datasets
- More aggressive connection pooling
- Expanded in-memory caching

**Horizontal Scaling:**
- Separate indexer and API processes
- Multiple API instances behind load balancer
- Database read replicas for queries
- Redis cluster for distributed caching

**Note:** The indexer itself cannot be horizontally scaled due to sequential processing requirements. However, the API layer scales independently.

## Technology Stack Rationale

**NestJS:** Provides structure and dependency injection for maintainable backend services

**Prisma:** Type-safe database access with excellent migration tooling

**PostgreSQL:** Strong consistency guarantees and excellent indexing for analytical queries

**Redis:** Fast in-memory caching for frequently accessed data (planned)

**TypeScript:** Type safety reduces runtime errors in blockchain data processing

## Known Limitations

- Testnet only (mainnet support requires configuration changes)
- Sequential processing limits throughput to ~1 block/second
- Dependency on external price API for USD calculations
- No built-in data retention or archival policies
- Limited support for blockchain reorganizations

## Future Considerations

Potential enhancements for production deployment:
- GraphQL API for more flexible querying
- WebSocket support for real-time updates
- Enhanced caching layer with Redis
- Metrics and distributed tracing
- Automated alerting and monitoring
- Support for multiple token types beyond NEAR
- Blockchain reorganization handling
