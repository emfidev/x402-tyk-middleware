# X402 Payment Protocol - Test Suite

Comprehensive test suite for the X402 payment protocol implementation with Tyk Gateway.

## Overview

This test suite verifies the complete X402 payment flow including:

- ✅ **Payment Verification** - Pre-request payment validation
- ✅ **Content Delivery** - Protected resource access
- ✅ **Payment Settlement** - Post-request settlement with facilitator
- ✅ **Blockchain Validation** - Solana transaction verification
- ✅ **Error Handling** - Edge cases and failure scenarios
- ✅ **Performance** - Response times and throughput

## Test Structure

```
tests/
├── unit/                           # Unit tests
│   └── middleware-validation.test.ts
├── integration/                    # Integration tests
│   └── x402-payment-flow.test.ts
├── blockchain/                     # Blockchain verification tests
│   └── solana-verification.test.ts
├── scripts/                        # Test utilities
│   └── check-prerequisites.js
├── jest.config.js                  # Jest configuration
├── setup.ts                        # Test setup
├── package.json                    # Test dependencies
└── README.md                       # This file
```

## Prerequisites

### Required

1. **Node.js 18+**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **Environment Variables**
   Create a `.env` file in the project root:
   ```env
   # Required
   WALLET_PRIVATE_KEY=your_solana_wallet_private_key_base58

   # Optional (defaults shown)
   GATEWAY_URL=http://localhost:8080
   SOLANA_RPC_URL=https://api.devnet.solana.com
   FACILITATOR_URL=https://facilitator.emfi.dev
   ```

3. **Running Services**
   - Tyk Gateway with X402 middleware
   - Solana devnet access
   - X402 Facilitator service

### Optional

- Docker (for running gateway locally)
- Solana CLI (for advanced blockchain verification)

## Installation

1. Install dependencies:
   ```bash
   cd tests
   npm install
   # or
   pnpm install
   ```

2. Check prerequisites:
   ```bash
   npm run pretest
   ```

   This will verify:
   - Environment variables are set
   - Tyk Gateway is running
   - Solana RPC is accessible
   - Facilitator is reachable

## Running Tests

### All Tests

```bash
npm test
```

### Test by Category

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Blockchain verification tests only
npm run test:blockchain
```

### Specific Test File

```bash
# Bitcoin endpoint tests
npm run test:bitcoin

# Or with Jest directly
npx jest integration/x402-payment-flow.test.ts
```

### Watch Mode

```bash
npm run test:watch
```

### With Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `./coverage/`

### Verbose Output

```bash
npm run test:verbose
```

### CI Mode

```bash
npm run test:ci
```

Optimized for CI/CD pipelines with:
- No watch mode
- Coverage reporting
- Limited parallelism
- Fail on console warnings

## Test Categories

### 1. Unit Tests (`unit/`)

Tests individual middleware logic without full integration:

- Payment header parsing
- Payment amount validation
- Network validation
- Address validation
- Response formatting
- Error handling

**Run:** `npm run test:unit`

**Duration:** ~5 seconds

### 2. Integration Tests (`integration/`)

End-to-end tests of the complete payment flow:

- Payment required responses (402)
- Payment verification
- Content delivery
- Settlement
- Multiple endpoints
- Concurrent requests
- Performance

**Run:** `npm run test:integration`

**Duration:** ~30-60 seconds

**Requirements:**
- Tyk Gateway running
- Facilitator accessible
- Test wallet with funds

### 3. Blockchain Tests (`blockchain/`)

Verifies Solana blockchain integration:

- Transaction submission
- Transaction validation
- On-chain verification
- Token program verification
- Payment amount verification
- Network consistency

**Run:** `npm run test:blockchain`

**Duration:** ~30-60 seconds

**Requirements:**
- Solana RPC access
- Valid network configuration

## Test Scenarios

### Happy Path

1. ✅ Client requests protected resource
2. ✅ Gateway returns 402 with payment requirements
3. ✅ Client creates and signs payment
4. ✅ Gateway verifies payment with facilitator
5. ✅ Content delivered to client
6. ✅ Payment settled on blockchain

### Error Scenarios

- ❌ No payment provided → 402 Payment Required
- ❌ Invalid payment format → 402 Payment Invalid
- ❌ Insufficient payment → 402 Payment Invalid
- ❌ Wrong recipient → 402 Payment Invalid
- ❌ Facilitator down → 500 Internal Server Error
- ❌ Settlement fails → Content still delivered (non-blocking)

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `WALLET_PRIVATE_KEY` | Solana wallet private key (base58) | `5J7Xq...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_URL` | Tyk Gateway URL | `http://localhost:8080` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `FACILITATOR_URL` | X402 Facilitator URL | `https://facilitator.emfi.dev` |
| `SOLANA_NETWORK` | Network name | `devnet` |

## Interpreting Results

### Successful Test Run

```
 PASS  integration/x402-payment-flow.test.ts
  X402 Payment Flow - Bitcoin Price API
    1. Payment Required Response (No Payment)
      ✓ should return 402 when no payment is provided (234ms)
      ✓ should include payment instructions in 402 response (156ms)
    2. Payment Verification & Content Delivery
      ✓ should accept valid payment and deliver content (1892ms)
      ✓ should include payment metadata in response headers (1456ms)
    ...

Test Suites: 3 passed, 3 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        45.234s
```

### Failed Test

```
 FAIL  integration/x402-payment-flow.test.ts
  X402 Payment Flow - Bitcoin Price API
    ✕ should accept valid payment and deliver content (2134ms)

  ● should accept valid payment and deliver content

    expect(received).toBe(expected)

    Expected: 200
    Received: 402

    Payment verification failed: Invalid signature
```

**Common failures:**
- Gateway not running
- Invalid wallet configuration
- Facilitator unavailable
- Network mismatch

## Troubleshooting

### Tests Fail with "ECONNREFUSED"

Gateway is not running:
```bash
# Start gateway
cd ..
docker compose -f docker-compose.gateway.yml up -d

# Verify it's running
curl http://localhost:8080/health
```

### Tests Fail with "Wallet not configured"

Set wallet private key:
```bash
export WALLET_PRIVATE_KEY="your_private_key_base58"

# Or add to .env file
echo "WALLET_PRIVATE_KEY=your_key" >> ../.env
```

### Tests Timeout

Increase timeout in test file:
```typescript
it('test name', async () => {
  // ...
}, 60000); // 60 second timeout
```

Or globally in `jest.config.js`:
```javascript
testTimeout: 60000
```

### Blockchain Tests Fail

Check Solana RPC:
```bash
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getHealth"
}
'
```

### Settlement Tests Fail

Check facilitator:
```bash
curl https://facilitator.emfi.dev/health
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      tyk-gateway:
        image: tykio/tyk-gateway:latest
        ports:
          - 8080:8080

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests
          npm ci

      - name: Run tests
        env:
          WALLET_PRIVATE_KEY: ${{ secrets.WALLET_PRIVATE_KEY }}
          GATEWAY_URL: http://localhost:8080
        run: |
          cd tests
          npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: ./tests/coverage
```

### GitLab CI

```yaml
test:
  image: node:18
  services:
    - name: tykio/tyk-gateway:latest
      alias: tyk-gateway
  variables:
    GATEWAY_URL: http://tyk-gateway:8080
  script:
    - cd tests
    - npm ci
    - npm run test:ci
  coverage: '/Statements\s+:\s+(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: tests/coverage/cobertura-coverage.xml
```

## Writing New Tests

### Test Template

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

describe('My New Test Suite', () => {
  let client: any;

  beforeAll(() => {
    client = axios.create({
      baseURL: process.env.GATEWAY_URL || 'http://localhost:8080'
    });
  });

  describe('Feature X', () => {
    it('should do something specific', async () => {
      const response = await client.get('/endpoint');

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      try {
        await client.get('/invalid');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });
});
```

### Best Practices

1. **Descriptive names** - Test names should clearly state what they verify
2. **One assertion per test** - Keep tests focused and simple
3. **Clean up** - Use `afterEach` to clean up resources
4. **Timeouts** - Set appropriate timeouts for async operations
5. **Mocking** - Mock external dependencies when appropriate
6. **Documentation** - Comment complex test logic

## Performance Benchmarks

Expected performance on modern hardware:

| Test Suite | Duration | Tests |
|------------|----------|-------|
| Unit | ~5s | 30+ |
| Integration | ~45s | 20+ |
| Blockchain | ~60s | 15+ |
| **Total** | **~110s** | **65+** |

## Contributing

When adding new tests:

1. Follow existing test structure
2. Add tests for both happy and sad paths
3. Update this README if adding new test categories
4. Ensure all tests pass before submitting PR
5. Maintain >80% code coverage

## Support

- **Issues**: [GitHub Issues](https://github.com/emfidev/x402-tyk-middleware/issues)
- **Discussions**: [GitHub Discussions](https://github.com/emfidev/x402-tyk-middleware/discussions)
- **Documentation**: [Main README](../README.md)

## License

MIT License - see [LICENSE](../LICENSE) for details

---

**Built with ❤️ for reliable micropayments**
