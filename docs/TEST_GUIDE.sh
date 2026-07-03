#!/bin/bash
# DATA4ME VTU Purchase System - Testing Guide

echo "=========================================="
echo "DATA4ME VTU PURCHASE SYSTEM - TEST GUIDE"
echo "=========================================="

# Configuration
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
FUNCTION_URL="https://your-project.supabase.co/functions/v1/vtu-purchase"

# Test User Token (Get from your app)
USER_TOKEN="your-user-token"

echo ""
echo "========== TEST 1: BUY AIRTIME =========="
echo "Testing airtime purchase with SMEAPI"
echo ""

curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy-airtime",
    "network": "MTN",
    "phone": "08012345678",
    "amount": 500
  }' \
  | jq .

echo ""
echo "========== TEST 2: BUY DATA =========="
echo "Testing data purchase with SMEAPI"
echo ""

# First get a data plan ID from your database
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy-data",
    "plan_id": "PLAN_ID_HERE",
    "phone": "08012345678"
  }' \
  | jq .

echo ""
echo "========== TEST 3: CHECK TRANSACTION HISTORY =========="
echo "Fetching your transaction history"
echo ""

# Query transactions from database
# SELECT * FROM public.transactions WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC;

echo ""
echo "========== TEST 4: CHECK WALLET BALANCE =========="
echo "Fetching your wallet balance"
echo ""

# Query wallet balance
# SELECT balance FROM public.wallets WHERE user_id = 'YOUR_USER_ID';

echo ""
echo "========== TEST 5: CHECK API LOGS =========="
echo "Viewing SMEAPI request/response logs for debugging"
echo ""

# Query API logs
# SELECT * FROM public.api_logs ORDER BY created_at DESC LIMIT 10;

echo ""
echo "=========================================="
echo "TEST GUIDE COMPLETE"
echo "=========================================="
echo ""
echo "Expected Results:"
echo "✓ Airtime purchase: success = true, txId provided"
echo "✓ Data purchase: success = true, txId provided"
echo "✓ Wallet deducted: product_amount + ₦1 charge"
echo "✓ Transaction status: 'success' if SMEAPI succeeded"
echo "✓ Refund: Automatic if SMEAPI failed (exact amount returned)"
echo ""
echo "Debugging:"
echo "- Check api_logs table for SMEAPI request/response"
echo "- Check transactions table for status and provider_response"
echo "- Check refund_logs for any refunds issued"
echo "- Check function logs in Supabase dashboard"
