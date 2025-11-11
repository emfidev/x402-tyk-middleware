/**
 * Jest setup file
 * Runs before all tests
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Set test timeouts
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console logs in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn
  error: console.error,
  warn: console.warn,
};

// Add custom matchers if needed
expect.extend({
  toBeValidSolanaAddress(received: string) {
    const pass = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(received);

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid Solana address`
        : `expected ${received} to be a valid Solana address`
    };
  },

  toBeValidTransactionSignature(received: string) {
    const pass = typeof received === 'string' && received.length > 0;

    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid transaction signature`
        : `expected ${received} to be a valid transaction signature`
    };
  }
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidSolanaAddress(): R;
      toBeValidTransactionSignature(): R;
    }
  }
}

// Log test environment info
console.error('🧪 Test Environment Setup');
console.error('Gateway URL:', process.env.GATEWAY_URL || 'http://localhost:8080');
console.error('Solana RPC:', process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
console.error('Wallet configured:', !!process.env.WALLET_PRIVATE_KEY);
