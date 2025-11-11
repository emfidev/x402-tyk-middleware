#!/bin/bash

#
# Quick Test Script
# Runs a fast smoke test to verify basic functionality
#

set -e

echo "🚀 X402 Quick Test Suite"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f "../.env" ]; then
    echo -e "${YELLOW}⚠ Warning: .env file not found${NC}"
    echo "Using environment variables if set..."
    echo ""
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."
node check-prerequisites.js

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Prerequisites check failed${NC}"
    exit 1
fi

echo ""
echo "🧪 Running quick smoke tests..."
echo ""

# Run specific quick tests
npx jest \
    --testPathPattern="integration/x402-payment-flow.test.ts" \
    --testNamePattern="should return 402 when no payment is provided|should accept valid payment and deliver content" \
    --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Quick tests passed!${NC}"
    echo ""
    echo "Run full test suite with: npm test"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Tests failed${NC}"
    exit 1
fi
