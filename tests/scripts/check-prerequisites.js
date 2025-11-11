#!/usr/bin/env node

/**
 * Pre-test check script
 * Verifies all prerequisites are met before running tests
 */

const { existsSync } = require('fs');
const { resolve } = require('path');
const http = require('http');
const https = require('https');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log('🔍 Checking test prerequisites...\n');

let hasErrors = false;
let hasWarnings = false;

// Check environment variables
const requiredEnvVars = ['WALLET_PRIVATE_KEY'];
const optionalEnvVars = ['GATEWAY_URL', 'SOLANA_RPC_URL', 'FACILITATOR_URL'];

console.log('📋 Environment Variables:');
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ${GREEN}✓${RESET} ${varName} is set`);
  } else {
    console.log(`  ${RED}✗${RESET} ${varName} is NOT set (required)`);
    hasErrors = true;
  }
});

optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ${GREEN}✓${RESET} ${varName} is set`);
  } else {
    console.log(`  ${YELLOW}⚠${RESET} ${varName} not set (using default)`);
  }
});

// Check .env file exists
console.log('\n📄 Configuration Files:');
const envPath = resolve(__dirname, '../../.env');
if (existsSync(envPath)) {
  console.log(`  ${GREEN}✓${RESET} .env file exists`);
} else {
  console.log(`  ${YELLOW}⚠${RESET} .env file not found (using environment variables)`);
  hasWarnings = true;
}

// Check Tyk Gateway is running
console.log('\n🌐 Services:');
const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8080';

checkService('Tyk Gateway', gatewayUrl)
  .then(() => {
    // Check Solana RPC
    const solanaRpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    return checkService('Solana RPC', solanaRpc);
  })
  .then(() => {
    // Check Facilitator
    const facilitatorUrl = process.env.FACILITATOR_URL || 'https://facilitator.emfi.dev';
    return checkService('Facilitator', facilitatorUrl + '/health', true);
  })
  .then(() => {
    console.log('\n📊 Summary:');
    if (hasErrors) {
      console.log(`${RED}✗ Prerequisites check FAILED${RESET}`);
      console.log('Please fix the errors above before running tests.\n');
      process.exit(1);
    } else if (hasWarnings) {
      console.log(`${YELLOW}⚠ Prerequisites check passed with warnings${RESET}`);
      console.log('Tests will run but some may fail.\n');
      process.exit(0);
    } else {
      console.log(`${GREEN}✓ All prerequisites met${RESET}`);
      console.log('Ready to run tests!\n');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error(`\n${RED}✗ Prerequisites check failed${RESET}`);
    console.error(error.message);
    process.exit(1);
  });

function checkService(name, url, optional = false) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = 5000;

    const req = client.get(url, { timeout }, (res) => {
      if (res.statusCode && res.statusCode < 500) {
        console.log(`  ${GREEN}✓${RESET} ${name} is reachable (${res.statusCode})`);
        resolve();
      } else {
        if (optional) {
          console.log(`  ${YELLOW}⚠${RESET} ${name} returned ${res.statusCode} (optional)`);
          hasWarnings = true;
          resolve();
        } else {
          console.log(`  ${RED}✗${RESET} ${name} returned ${res.statusCode}`);
          hasErrors = true;
          resolve();
        }
      }
    });

    req.on('error', (error) => {
      if (optional) {
        console.log(`  ${YELLOW}⚠${RESET} ${name} not reachable: ${error.message} (optional)`);
        hasWarnings = true;
        resolve();
      } else {
        console.log(`  ${RED}✗${RESET} ${name} not reachable: ${error.message}`);
        hasErrors = true;
        resolve();
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (optional) {
        console.log(`  ${YELLOW}⚠${RESET} ${name} timeout (optional)`);
        hasWarnings = true;
        resolve();
      } else {
        console.log(`  ${RED}✗${RESET} ${name} timeout`);
        hasErrors = true;
        resolve();
      }
    });
  });
}
