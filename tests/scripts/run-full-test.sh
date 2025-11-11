#!/bin/bash

#
# Full Test Script
# Runs complete test suite with coverage
#

set -e

echo "🧪 X402 Full Test Suite"
echo "======================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check prerequisites
echo "🔍 Checking prerequisites..."
node scripts/check-prerequisites.js

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Prerequisites check failed${NC}"
    echo "Please fix errors before running tests"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 Test Plan:${NC}"
echo "  1. Unit Tests (~5s)"
echo "  2. Integration Tests (~45s)"
echo "  3. Blockchain Tests (~60s)"
echo "  4. Coverage Report"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test run cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}🧪 Running Unit Tests...${NC}"
echo "================================"
npm run test:unit

echo ""
echo -e "${BLUE}🌐 Running Integration Tests...${NC}"
echo "===================================="
npm run test:integration

echo ""
echo -e "${BLUE}⛓️  Running Blockchain Tests...${NC}"
echo "===================================="
npm run test:blockchain

echo ""
echo -e "${BLUE}📊 Generating Coverage Report...${NC}"
echo "===================================="
npm run test:coverage

echo ""
echo -e "${GREEN}✓ All tests completed!${NC}"
echo ""
echo "Coverage report available at: ./coverage/index.html"
echo ""
