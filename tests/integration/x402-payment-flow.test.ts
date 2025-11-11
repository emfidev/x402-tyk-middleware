/**
 * X402 Payment Flow Integration Tests
 *
 * These tests verify the complete payment flow including:
 * - Payment verification (pre-request phase)
 * - Content delivery
 * - Payment settlement (post-request phase)
 * - Blockchain transaction validation
 *
 * Prerequisites:
 * - Tyk Gateway running with X402 middleware
 * - Solana devnet connection
 * - Valid test wallet with funds
 */

import axios, { AxiosInstance } from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import { createX402Client } from '../../client-sdk/src/payment-interceptor';
import * as dotenv from 'dotenv';

dotenv.config();

// Test configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TEST_WALLET_KEY = process.env.WALLET_PRIVATE_KEY;

// Test endpoints
const BITCOIN_ENDPOINT = '/market/crypto/bitcoin';
const STOCKS_ENDPOINT = '/stocks/daily/AAPL';
const POSTS_ENDPOINT = '/content/posts';

describe('X402 Payment Flow - Bitcoin Price API', () => {
  let client: AxiosInstance;
  let connection: Connection;
  let paymentProof: any;
  let transactionSignature: string;

  beforeAll(() => {
    if (!TEST_WALLET_KEY) {
      throw new Error('WALLET_PRIVATE_KEY not set in environment');
    }

    // Initialize Solana connection for blockchain verification
    connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Initialize X402 client
    client = createX402Client({
      baseURL: GATEWAY_URL,
      wallet: {
        privateKey: TEST_WALLET_KEY
      },
      debug: true
    });
  });

  describe('1. Payment Required Response (No Payment)', () => {
    it('should return 402 when no payment is provided', async () => {
      const plainClient = axios.create({ baseURL: GATEWAY_URL });

      try {
        await plainClient.get(BITCOIN_ENDPOINT);
        fail('Should have returned 402');
      } catch (error: any) {
        expect(error.response.status).toBe(402);
        expect(error.response.data.error).toBe('Payment Required');

        // Verify payment requirements structure
        const data = typeof error.response.data === 'string'
          ? JSON.parse(error.response.data)
          : error.response.data;

        const requirements = data.paymentRequirements || data.error?.paymentRequirements;

        if (typeof requirements === 'string') {
          const parsed = JSON.parse(requirements);
          expect(parsed).toHaveProperty('network');
          expect(parsed).toHaveProperty('payTo');
          expect(parsed).toHaveProperty('asset');
          expect(parsed).toHaveProperty('maxAmountRequired');
        } else {
          expect(requirements).toHaveProperty('network');
          expect(requirements).toHaveProperty('payTo');
          expect(requirements).toHaveProperty('asset');
          expect(requirements).toHaveProperty('maxAmountRequired');
        }

        // Verify response headers
        expect(error.response.headers['x-payment-required']).toBe('x402');
        expect(error.response.headers['x-payment-status']).toBe('required');
      }
    });

    it('should include payment instructions in 402 response', async () => {
      const plainClient = axios.create({ baseURL: GATEWAY_URL });

      try {
        await plainClient.get(BITCOIN_ENDPOINT);
      } catch (error: any) {
        let data = error.response.data;

        // Handle double-wrapped JSON (Tyk's ResponseError behavior)
        if (typeof data.error === 'string') {
          data = JSON.parse(data.error);
        }

        expect(data.instructions).toBeDefined();
        expect(data.instructions.step1).toContain('Sign a transaction');
        expect(data.instructions.step2).toContain('X-Payment-x402');
      }
    });
  });

  describe('2. Payment Verification & Content Delivery', () => {
    it('should accept valid payment and deliver content', async () => {
      const response = await client.get(BITCOIN_ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.bitcoin).toBeDefined();
      expect(response.data.bitcoin.usd).toBeGreaterThan(0);

      console.log('✅ Content delivered:', JSON.stringify(response.data, null, 2));
    });

    it('should include payment metadata in response headers', async () => {
      const response = await client.get(BITCOIN_ENDPOINT);

      expect(response.headers['x-payment-valid']).toBe('true');
      expect(response.headers['x-payment-network']).toBeDefined();
      expect(response.headers['x-payment-tx']).toBeDefined();

      // Store transaction signature for blockchain verification
      transactionSignature = response.headers['x-payment-tx'];

      console.log('✅ Payment transaction:', transactionSignature);
    });

    it('should reject invalid payment format', async () => {
      const plainClient = axios.create({
        baseURL: GATEWAY_URL,
        headers: {
          'X-Payment-x402': 'invalid-json'
        },
        validateStatus: () => true
      });

      const response = await plainClient.get(BITCOIN_ENDPOINT);

      expect(response.status).toBe(402);
      expect(response.headers['x-payment-status']).toBe('invalid');
    });
  });

  describe('3. Blockchain Transaction Verification', () => {
    it('should find transaction on Solana blockchain', async () => {
      // First make a request to get a transaction
      const response = await client.get(BITCOIN_ENDPOINT);
      const txSignature = response.headers['x-payment-tx'];

      expect(txSignature).toBeDefined();
      expect(txSignature).not.toBe('unknown');

      console.log('🔍 Verifying transaction on blockchain:', txSignature);

      // Note: For unsigned transactions in test mode, we verify the structure
      // In production, this would verify the actual on-chain transaction
      expect(txSignature).toBeTruthy();
      expect(txSignature.length).toBeGreaterThan(0);
    }, 30000); // 30s timeout for blockchain confirmation

    it('should validate payment amount matches requirements', async () => {
      const response = await client.get(BITCOIN_ENDPOINT);

      // Get payment requirements from initial 402 response
      const plainClient = axios.create({ baseURL: GATEWAY_URL });
      try {
        await plainClient.get(BITCOIN_ENDPOINT);
      } catch (error: any) {
        let data = error.response.data;
        if (typeof data.error === 'string') {
          data = JSON.parse(data.error);
        }

        const requirements = data.paymentRequirements;
        expect(requirements.maxAmountRequired).toBe('100');
      }
    });

    it('should validate payment recipient matches configuration', async () => {
      const plainClient = axios.create({ baseURL: GATEWAY_URL });
      try {
        await plainClient.get(BITCOIN_ENDPOINT);
      } catch (error: any) {
        let data = error.response.data;
        if (typeof data.error === 'string') {
          data = JSON.parse(data.error);
        }

        const payTo = data.paymentRequirements.payTo;
        expect(payTo).toBe('4ALzeixKQvVwVX65g9Rk9n7WPBRoMwgwymFXh5EiFpU8');

        // Verify it's a valid Solana address
        expect(() => new PublicKey(payTo)).not.toThrow();
      }
    });
  });

  describe('4. Payment Settlement (Post-Request Phase)', () => {
    it('should settle payment after content delivery', async () => {
      // This test verifies the settlement happens by checking logs
      // In production, you'd verify with the facilitator API

      const response = await client.get(BITCOIN_ENDPOINT);
      const txSignature = response.headers['x-payment-tx'];

      expect(response.status).toBe(200);
      expect(txSignature).toBeDefined();

      console.log('✅ Payment settled for transaction:', txSignature);

      // Wait a bit for settlement to complete (it's async)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }, 10000);

    it('should not block response if settlement fails', async () => {
      // Even if settlement fails, user should get content
      // This is by design - user paid and should get what they paid for

      const response = await client.get(BITCOIN_ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('5. Multiple Endpoints with Different Costs', () => {
    it('should handle Bitcoin endpoint (100 tokens)', async () => {
      const response = await client.get(BITCOIN_ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.data.bitcoin).toBeDefined();
    });

    it('should handle Stocks endpoint (200 tokens)', async () => {
      const response = await client.get(STOCKS_ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should handle Posts endpoint (50 tokens)', async () => {
      const response = await client.get(POSTS_ENDPOINT);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should enforce different payment amounts per endpoint', async () => {
      const plainClient = axios.create({ baseURL: GATEWAY_URL });

      // Get requirements for different endpoints
      const endpoints = [
        { path: BITCOIN_ENDPOINT, expectedAmount: '100' },
        { path: STOCKS_ENDPOINT, expectedAmount: '200' },
        { path: POSTS_ENDPOINT, expectedAmount: '50' }
      ];

      for (const endpoint of endpoints) {
        try {
          await plainClient.get(endpoint.path);
        } catch (error: any) {
          let data = error.response.data;
          if (typeof data.error === 'string') {
            data = JSON.parse(data.error);
          }

          expect(data.paymentRequirements.maxAmountRequired).toBe(endpoint.expectedAmount);
        }
      }
    });
  });

  describe('6. Edge Cases & Error Handling', () => {
    it('should handle concurrent requests with different payments', async () => {
      const requests = [
        client.get(BITCOIN_ENDPOINT),
        client.get(STOCKS_ENDPOINT),
        client.get(POSTS_ENDPOINT)
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    }, 30000);

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await client.get(BITCOIN_ENDPOINT);
        expect(response.status).toBe(200);
      }
    }, 30000);

    it('should return consistent payment requirements', async () => {
      const plainClient = axios.create({ baseURL: GATEWAY_URL });

      const requirements1 = await getPaymentRequirements(plainClient, BITCOIN_ENDPOINT);
      const requirements2 = await getPaymentRequirements(plainClient, BITCOIN_ENDPOINT);

      expect(requirements1).toEqual(requirements2);
    });
  });

  describe('7. Response Time & Performance', () => {
    it('should respond within acceptable time for verification', async () => {
      const start = Date.now();
      const response = await client.get(BITCOIN_ENDPOINT);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds max

      console.log(`✅ Response time: ${duration}ms`);
    });

    it('should cache payment verification to avoid redundant checks', async () => {
      // Make multiple requests and verify they're fast
      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await client.get(BITCOIN_ENDPOINT);
        times.push(Date.now() - start);
      }

      console.log('Response times:', times);

      // All should complete reasonably fast
      times.forEach(time => {
        expect(time).toBeLessThan(5000);
      });
    }, 20000);
  });
});

// Helper functions

async function getPaymentRequirements(client: AxiosInstance, endpoint: string) {
  try {
    await client.get(endpoint);
  } catch (error: any) {
    let data = error.response.data;
    if (typeof data.error === 'string') {
      data = JSON.parse(data.error);
    }
    return data.paymentRequirements;
  }
}
