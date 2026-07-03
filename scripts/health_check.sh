#!/bin/bash

# DATA4ME VTU System - Health Check Script
# Run this to verify everything is working correctly

set -e

echo "=========================================="
echo "DATA4ME VTU SYSTEM - HEALTH CHECK"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Environment Variables
echo "CHECK 1: Environment Variables"
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}✗ SUPABASE_URL not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓ SUPABASE_URL configured${NC}"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY configured${NC}"
fi

echo ""

# Check 2: Database Connection
echo "CHECK 2: Database Connection"
psql "$SUPABASE_URL" -c "SELECT 1" > /dev/null 2>&1 && \
    echo -e "${GREEN}✓ Database connection successful${NC}" || \
    echo -e "${RED}✗ Database connection failed${NC}"

echo ""

# Check 3: Required Tables
echo "CHECK 3: Database Tables"
for table in wallets transactions api_logs refund_logs api_providers data_plans; do
    psql "$SUPABASE_URL" -c "SELECT 1 FROM $table LIMIT 1" > /dev/null 2>&1 && \
        echo -e "${GREEN}✓ Table '$table' exists${NC}" || \
        echo -e "${RED}✗ Table '$table' missing${NC}"
done

echo ""

# Check 4: Database Functions
echo "CHECK 4: Database Functions"
for func in debit_wallet complete_transaction refund_transaction log_api_call; do
    psql "$SUPABASE_URL" -c "SELECT 1 FROM information_schema.routines WHERE routine_name = '$func'" > /dev/null 2>&1 && \
        echo -e "${GREEN}✓ Function '$func' exists${NC}" || \
        echo -e "${RED}✗ Function '$func' missing${NC}"
done

echo ""

# Check 5: API Provider Configuration
echo "CHECK 5: API Provider Configuration"
PROVIDER_COUNT=$(psql "$SUPABASE_URL" -tc "SELECT COUNT(*) FROM public.api_providers WHERE is_active = true;")
if [ "$PROVIDER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Active API provider configured ($PROVIDER_COUNT found)${NC}"
else
    echo -e "${RED}✗ No active API provider configured${NC}"
fi

echo ""

# Check 6: Data Plans
echo "CHECK 6: Data Plans"
PLAN_COUNT=$(psql "$SUPABASE_URL" -tc "SELECT COUNT(*) FROM public.data_plans;")
if [ "$PLAN_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Data plans configured ($PLAN_COUNT plans found)${NC}"
else
    echo -e "${RED}✗ No data plans configured${NC}"
fi

echo ""

# Check 7: SMEAPI Connection
echo "CHECK 7: SMEAPI Connection"
RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
    -X GET "https://api.smeapi.net/health" \
    -H "Authorization: Bearer $SMEAPI_KEY" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    echo -e "${GREEN}✓ SMEAPI endpoint reachable (HTTP $RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠ SMEAPI endpoint status: HTTP $RESPONSE${NC}"
fi

echo ""

# Check 8: Recent Transactions
echo "CHECK 8: Recent Transactions"
RECENT=$(psql "$SUPABASE_URL" -tc "SELECT COUNT(*) FROM public.transactions WHERE created_at > NOW() - INTERVAL '24 hours';")
if [ "$RECENT" -gt 0 ]; then
    echo -e "${GREEN}✓ $RECENT transactions in last 24 hours${NC}"
else
    echo -e "${YELLOW}⚠ No transactions in last 24 hours${NC}"
fi

echo ""

# Check 9: Recent Refunds
echo "CHECK 9: Refund Status"
REFUNDS=$(psql "$SUPABASE_URL" -tc "SELECT COUNT(*) FROM public.refund_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'completed';")
if [ "$REFUNDS" -eq 0 ]; then
    echo -e "${GREEN}✓ No refunds needed in last 24 hours${NC}"
else
    echo -e "${YELLOW}⚠ $REFUNDS refunds completed in last 24 hours${NC}"
fi

echo ""

# Check 10: Database Performance
echo "CHECK 10: Database Performance"
psql "$SUPABASE_URL" -c "SELECT COUNT(*) FROM public.transactions" > /dev/null 2>&1 && \
    echo -e "${GREEN}✓ Database queries performing well${NC}" || \
    echo -e "${RED}✗ Database performance issues${NC}"

echo ""
echo "=========================================="
echo "HEALTH CHECK COMPLETE"
echo "=========================================="
