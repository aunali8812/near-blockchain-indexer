# API Documentation

Complete reference for the Potlock Indexer REST API.

## Base URL

```
http://localhost:3000/api/v1
```

For production deployments, replace with your domain.

## Interactive Documentation

Swagger UI is available at `/api/docs` for interactive API exploration and testing.

## Authentication

Currently, the API is publicly accessible without authentication. All endpoints are read-only.

## Rate Limiting

- **Limit:** 500 requests per minute per IP address
- **Headers:** Rate limit information is included in response headers
- **Exceeded:** Returns 429 Too Many Requests with retry information

## Common Parameters

### Pagination

Most list endpoints support pagination:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |

**Response Format:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Sorting

Endpoints that support sorting use the `sort` parameter:

**Format:** `field:order`

**Example:** `?sort=totalDonatedUsd:desc`

**Valid orders:** `asc`, `desc`

### Filtering

Date range and amount filters where applicable:

| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| `startDate` | string | ISO 8601 | Filter records after this date |
| `endDate` | string | ISO 8601 | Filter records before this date |
| `minAmount` | number | USD | Minimum USD amount |
| `maxAmount` | number | USD | Maximum USD amount |
| `type` | string | enum | Donation type filter |

## Endpoints

### Accounts

#### List Accounts

```
GET /accounts
```

Retrieve paginated list of accounts with aggregated metrics.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `sort` | string | Sort field and order |

**Sortable Fields:**
- `totalDonatedUsd`
- `totalReceivedUsd`
- `referralFeesEarnedUsd`
- `donationsSentCount`
- `donationsReceivedCount`
- `lastActivityAt`

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts?page=1&limit=10&sort=totalDonatedUsd:desc"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "alice.testnet",
      "firstSeenAt": "2024-01-15T10:30:00.000Z",
      "lastActivityAt": "2024-11-20T14:22:00.000Z",
      "totalDonatedNear": "125.500000",
      "totalDonatedUsd": "850.25",
      "totalReceivedNear": "50.000000",
      "totalReceivedUsd": "340.00",
      "donationsSentCount": 45,
      "donationsReceivedCount": 12,
      "referralFeesEarnedUsd": "25.50",
      "referralFeesPaidUsd": "10.20"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3245,
    "totalPages": 325
  }
}
```

#### Get Account Details

```
GET /accounts/:accountId
```

Retrieve detailed information for a specific account.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | NEAR account ID |

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet"
```

**Example Response:**
```json
{
  "id": "alice.testnet",
  "firstSeenAt": "2024-01-15T10:30:00.000Z",
  "lastActivityAt": "2024-11-20T14:22:00.000Z",
  "totalDonatedNear": "125.500000",
  "totalDonatedUsd": "850.25",
  "totalReceivedNear": "50.000000",
  "totalReceivedUsd": "340.00",
  "donationsSentCount": 45,
  "donationsReceivedCount": 12,
  "referralFeesEarnedNear": "3.750000",
  "referralFeesEarnedUsd": "25.50",
  "referralFeesPaidNear": "1.500000",
  "referralFeesPaidUsd": "10.20",
  "directDonatedUsd": "400.00",
  "directReceivedUsd": "150.00",
  "directSentCount": 20,
  "directReceivedCount": 5,
  "potDonatedUsd": "350.25",
  "potReceivedUsd": "150.00",
  "potSentCount": 20,
  "potReceivedCount": 5,
  "campaignDonatedUsd": "100.00",
  "campaignReceivedUsd": "40.00",
  "campaignSentCount": 5,
  "campaignReceivedCount": 2,
  "firstDonationDate": "2024-01-15T10:30:00.000Z",
  "lastDonationDate": "2024-11-20T14:22:00.000Z"
}
```

#### Get Donation Summary

```
GET /accounts/:accountId/donation-summary
```

Retrieve comprehensive donation summary with type breakdowns.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | NEAR account ID |

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donation-summary"
```

**Example Response:**
```json
{
  "account_id": "alice.testnet",
  "total_donated_usd": "850.25",
  "total_donated_near": "125.500000",
  "total_received_usd": "340.00",
  "total_received_near": "50.000000",
  "donations_sent_count": 45,
  "donations_received_count": 12,
  "referral_fees_earned_usd": "25.50",
  "referral_fees_paid_usd": "10.20",
  "breakdown_by_type": {
    "direct_donations": {
      "sent_usd": "400.00",
      "received_usd": "150.00",
      "count_sent": 20,
      "count_received": 5
    },
    "pot_donations": {
      "sent_usd": "350.25",
      "received_usd": "150.00",
      "count_sent": 20,
      "count_received": 5
    },
    "campaign_donations": {
      "sent_usd": "100.00",
      "received_usd": "40.00",
      "count_sent": 5,
      "count_received": 2
    }
  },
  "first_donation_date": "2024-01-15T10:30:00.000Z",
  "last_donation_date": "2024-11-20T14:22:00.000Z"
}
```

#### Get Referral Summary

```
GET /accounts/:accountId/referral-summary
```

Retrieve referral fee statistics for an account.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | NEAR account ID |

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/referral-summary"
```

**Example Response:**
```json
{
  "account_id": "alice.testnet",
  "referral_fees_earned_near": "3.750000",
  "referral_fees_earned_usd": "25.50",
  "referral_fees_paid_near": "1.500000",
  "referral_fees_paid_usd": "10.20",
  "total_referrals": 8
}
```

### Donations

Donation queries are accessed through account endpoints.

#### Get Donations Sent

```
GET /accounts/:accountId/donations-sent
```

Retrieve donations sent by an account.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | NEAR account ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `type` | string | Filter by donation type |
| `startDate` | string | Start date (ISO 8601) |
| `endDate` | string | End date (ISO 8601) |
| `minAmount` | number | Minimum USD amount |
| `maxAmount` | number | Maximum USD amount |
| `sort` | string | Sort field and order |

**Donation Types:**
- `DIRECT` - Direct peer-to-peer donations
- `POT` - Donations to quadratic funding pots
- `POT_PROJECT` - QF round donations to projects
- `CAMPAIGN` - Campaign donations

**Sortable Fields:**
- `donatedAt`
- `amountUsd`
- `amountNear`

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donations-sent?type=DIRECT&minAmount=10&sort=donatedAt:desc"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "clx123abc456",
      "type": "DIRECT",
      "donorId": "alice.testnet",
      "recipientId": "bob.testnet",
      "amountNear": "5.000000",
      "amountUsd": "34.50",
      "ftId": "near",
      "message": "Great work on the project!",
      "donatedAt": "2024-11-20T14:22:00.000Z",
      "blockHeight": "123456789",
      "transactionHash": "ABC123DEF456...",
      "protocolFeeNear": "0.050000",
      "protocolFeeUsd": "0.35",
      "referrerId": "charlie.testnet",
      "referrerFeeNear": "0.025000",
      "referrerFeeUsd": "0.17"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### Get Donations Received

```
GET /accounts/:accountId/donations-received
```

Retrieve donations received by an account.

Uses the same parameters and response format as donations-sent.

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/accounts/bob.testnet/donations-received?limit=10"
```

### Statistics

#### Get Global Stats

```
GET /stats
```

Retrieve platform-wide donation statistics.

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/stats"
```

**Example Response:**
```json
{
  "total_donations_usd": "1250000.50",
  "total_donations_near": "500000.000000",
  "total_donations_count": 15420,
  "total_donors": 3245,
  "total_recipients": 892,
  "total_referral_fees_usd": "12500.30",
  "direct_donations_usd": "450000.00",
  "pot_donations_usd": "650000.50",
  "campaign_donations_usd": "150000.00",
  "avg_donation_usd": "81.09",
  "median_donation_usd": "25.00"
}
```

#### Get Leaderboard

```
GET /stats/leaderboard
```

Retrieve ranked lists of top accounts by category.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | donors | Leaderboard type |
| `limit` | integer | 100 | Number of results |

**Leaderboard Types:**
- `donors` - Top donors by total donated USD
- `recipients` - Top recipients by total received USD
- `referrers` - Top referrers by fees earned USD

**Example Request:**
```bash
curl "http://localhost:3000/api/v1/stats/leaderboard?type=donors&limit=10"
```

**Example Response:**
```json
{
  "type": "donors",
  "limit": 10,
  "data": [
    {
      "rank": 1,
      "account_id": "whale.testnet",
      "total_donated_usd": "125000.00",
      "total_donated_near": "50000.000000",
      "donations_sent_count": 523
    },
    {
      "rank": 2,
      "account_id": "generous.testnet",
      "total_donated_usd": "98500.50",
      "total_donated_near": "39400.000000",
      "donations_sent_count": 412
    }
  ]
}
```

## Response Formats

### Success Response

Successful requests return HTTP 200 with data in the response body.

Single resource:
```json
{
  "id": "...",
  "field1": "value1",
  ...
}
```

List of resources:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

Errors return appropriate HTTP status codes with error details:

```json
{
  "statusCode": 400,
  "message": "Invalid query parameter: limit must be less than 100",
  "error": "Bad Request"
}
```

**Common Status Codes:**

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters or request format |
| 404 | Not Found | Resource does not exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

## Data Types

### Account Object

```typescript
{
  id: string;                      // NEAR account ID
  firstSeenAt: string;             // ISO 8601 timestamp
  lastActivityAt: string;          // ISO 8601 timestamp
  totalDonatedNear: string;        // Decimal string
  totalDonatedUsd: string;         // Decimal string
  totalReceivedNear: string;       // Decimal string
  totalReceivedUsd: string;        // Decimal string
  donationsSentCount: number;      // Integer
  donationsReceivedCount: number;  // Integer
  referralFeesEarnedNear: string;  // Decimal string
  referralFeesEarnedUsd: string;   // Decimal string
  referralFeesPaidNear: string;    // Decimal string
  referralFeesPaidUsd: string;     // Decimal string

  // Breakdown fields
  directDonatedUsd: string;
  directReceivedUsd: string;
  directSentCount: number;
  directReceivedCount: number;
  potDonatedUsd: string;
  potReceivedUsd: string;
  potSentCount: number;
  potReceivedCount: number;
  campaignDonatedUsd: string;
  campaignReceivedUsd: string;
  campaignSentCount: number;
  campaignReceivedCount: number;

  // Temporal
  firstDonationDate: string | null;
  lastDonationDate: string | null;
}
```

### Donation Object

```typescript
{
  id: string;                    // Unique donation ID
  type: DonationType;            // Enum: DIRECT, POT, POT_PROJECT, CAMPAIGN
  donorId: string;               // NEAR account ID
  recipientId: string | null;    // NEAR account ID (nullable)
  amountNear: string;            // Decimal string
  amountUsd: string;             // Decimal string
  ftId: string;                  // Token ID (usually "near")
  message: string | null;        // Optional donation message
  donatedAt: string;             // ISO 8601 timestamp
  blockHeight: string;           // BigInt as string
  transactionHash: string;       // Blockchain transaction hash
  protocolFeeNear: string;       // Decimal string
  protocolFeeUsd: string;        // Decimal string
  referrerId: string | null;     // NEAR account ID (nullable)
  referrerFeeNear: string;       // Decimal string
  referrerFeeUsd: string;        // Decimal string

  // Type-specific fields (may be null)
  potId: string | null;          // For POT and POT_PROJECT types
  campaignId: string | null;     // For CAMPAIGN type
  projectId: string | null;      // For POT_PROJECT type
  netAmount: string | null;      // Net amount after fees
  chefId: string | null;         // Chef account for pots
  chefFee: string | null;        // Chef fee amount
}
```

## Usage Examples

### Get Top 10 Donors

```bash
curl "http://localhost:3000/api/v1/stats/leaderboard?type=donors&limit=10"
```

### Find Large Donations

```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donations-sent?minAmount=1000&sort=amountUsd:desc"
```

### Get Recent Activity

```bash
curl "http://localhost:3000/api/v1/accounts/bob.testnet/donations-received?sort=donatedAt:desc&limit=5"
```

### Filter by Date Range

```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donations-sent?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z"
```

### Get Pot Donations Only

```bash
curl "http://localhost:3000/api/v1/accounts/alice.testnet/donations-sent?type=POT"
```

## Notes on Decimal Precision

- **NEAR amounts:** 6 decimal places
- **USD amounts:** 2 decimal places
- **All amounts returned as strings** to preserve precision in JSON

When working with amounts in client applications, parse strings to appropriate decimal types rather than using floating point numbers to avoid precision loss.

## CORS Configuration

The API allows cross-origin requests from all domains. For production deployments, configure CORS to restrict access to specific domains.

## Versioning

The API is versioned via URL path (`/api/v1`). Breaking changes will increment the version number. The current version will be maintained for a reasonable deprecation period.

## Support

For API issues or questions:
- Check Swagger documentation at `/api/docs`
- Review source code in `src/` directory
- Open an issue on the project repository
