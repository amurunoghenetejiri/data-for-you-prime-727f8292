# DATA4ME VTU Purchase System - Complete Documentation

## Overview

The DATA4ME VTU Purchase System is a fully integrated airtime and data purchase platform that:
- Safely deducts funds from user wallets
- Sends purchases to SMEAPI
- Automatically refunds on failure
- Tracks all transactions with detailed logs
- Ensures accurate wallet balances

## Architecture

### Key Components

1. **Edge Function** (`supabase/functions/vtu-purchase/index.ts`)
   - Handles airtime and data purchase requests
   - Validates user input
   - Manages SMEAPI integration
   - Coordinates transaction flow

2. **Database Functions** (`supabase/migrations/0002_vtu_functions.sql`)
   - `debit_wallet()` - Safely deduct funds and create transaction
   - `complete_transaction()` - Mark transaction as successful
   - `refund_transaction()` - Refund exact amount on failure
   - `log_api_call()` - Log all API requests/responses
   - `get_wallet_balance()` - Query user balance
   - `get_transaction_history()` - Fetch user transactions

3. **Database Tables** (`supabase/migrations/0001_init_vtu_system.sql`)
   - `api_providers` - Provider configuration
   - `data_plans` - Available data plans
   - `wallets` - User wallet balances
   - `transactions` - Transaction records
   - `api_logs` - SMEAPI request/response logs
   - `refund_logs` - Refund history

## Transaction Flow

### Airtime Purchase Flow

```
1. User initiates purchase (network, phone, amount)
   ↓
2. Function validates input (network, phone format, amount ≥ ₦50)
   ↓
3. Calculate amounts:
   - product_amount = user input (e.g., ₦500)
   - charge_amount = ₦1 (fixed)
   - total_amount = ₦501
   ↓
4. Debit wallet atomically:
   - Create transaction record (status: processing)
   - Deduct total_amount from wallet
   - Mark wallet_debit_confirmed = TRUE
   ↓
5. Call SMEAPI /airtime endpoint with:
   - network: MTN/GLO/AIRTEL/9MOBILE
   - amount: product_amount (₦500)
   - mobile_number: 08012345678
   - airtime_type: VTU
   ↓
6. Check SMEAPI response:
   - IF success (Status = "successful"):
     - Mark transaction as "success"
     - Set provider_success_confirmed = TRUE
     - Return success to user
   - IF failure (Status != "successful"):
     - Call refund_transaction()
     - Refund exact amount: ₦501
     - Mark transaction as "refunded"
     - Return error to user
   ↓
7. Log complete request/response to api_logs table
```

### Data Purchase Flow

```
1. User initiates purchase (plan_id, phone)
   ↓
2. Function validates input
   ↓
3. Fetch data plan from database
   - Get network, api_code, selling_price, cost_price
   ↓
4. Calculate amounts:
   - product_amount = plan.selling_price
   - charge_amount = ₦1 (fixed)
   - total_amount = product_amount + ₦1
   ↓
5. Debit wallet (same as airtime)
   ↓
6. Call SMEAPI /data endpoint with:
   - network: plan.network
   - plan: plan.api_code
   - mobile_number: phone
   - Ported_number: true
   ↓
7. Check response and handle success/failure (same as airtime)
```

## Refund Logic (THE FIX)

### The Problem (Before)
- A ₦15 airtime purchase would deduct ₦16 (₦15 + ₦1 charge)
- But on failure, the system would refund ₦17 instead of ₦16
- This caused wallet balance inconsistencies

### The Solution (After)
Each transaction now stores:
```javascript
{
  product_amount: 500,        // What user actually bought
  charge_amount: 1,           // Fixed ₦1 charge
  total_amount: 501           // Exact amount deducted from wallet
}
```

When refunding:
```sql
UPDATE wallets 
SET balance = balance + total_amount  -- Always use total_amount
WHERE user_id = user_id
```

This ensures:
- ✓ Exact amount refunded (₦501 for a ₦500 purchase)
- ✓ No duplicate refunds (refund_issued flag prevents double refunds)
- ✓ Accurate wallet balances
- ✓ Clear audit trail in refund_logs

## SMEAPI Success Detection

The system detects SMEAPI success by checking the response status:

```typescript
const successStatuses = ['successful', 'success', 'completed', '200', '000'];
const status = String(response.Status || response.status || response.response_code || '').toLowerCase();
const isSuccess = successStatuses.includes(status);
```

## Logging & Debugging

### Transaction Logs
Every step is logged with timestamps:
```
[2026-07-03T12:00:00Z] [VTU-PURCHASE] BUY_AIRTIME_START
[2026-07-03T12:00:01Z] [VTU-PURCHASE] WALLET_DEBITED
[2026-07-03T12:00:02Z] [VTU-PURCHASE] CALLING_SMEAPI_AIRTIME
[2026-07-03T12:00:03Z] [VTU-PURCHASE] SMEAPI_RESPONSE_RECEIVED
[2026-07-03T12:00:04Z] [VTU-PURCHASE] AIRTIME_PURCHASE_SUCCESS
```

### Database Logs

**API Logs Table:**
```sql
SELECT * FROM api_logs 
WHERE provider = 'smeapi' 
ORDER BY created_at DESC 
LIMIT 20;
```

**Transaction Records:**
```sql
SELECT * FROM transactions 
WHERE user_id = 'user_id' 
ORDER BY created_at DESC;
```

**Refund History:**
```sql
SELECT * FROM refund_logs 
WHERE user_id = 'user_id' 
ORDER BY created_at DESC;
```

## API Endpoint

### Request Format

**Airtime Purchase:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/vtu-purchase \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy-airtime",
    "network": "MTN",
    "phone": "08012345678",
    "amount": 500
  }'
```

**Data Purchase:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/vtu-purchase \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy-data",
    "plan_id": "plan-uuid-here",
    "phone": "08012345678"
  }'
```

### Response Format

**Success:**
```json
{
  "success": true,
  "txId": "transaction-uuid",
  "phone": "08012345678",
  "network": "MTN",
  "airtime": "₦500",
  "totalDeducted": 501,
  "message": "₦500 airtime + ₦1 charge = ₦501 deducted. Airtime delivery in progress."
}
```

**Failure:**
```json
{
  "success": false,
  "error": "Network error or SMEAPI rejection reason",
  "txId": "transaction-uuid"
}
```

## Setup Instructions

### 1. Run Database Migrations
```bash
# Run in order:
1. supabase/migrations/0001_init_vtu_system.sql
2. supabase/migrations/0002_vtu_functions.sql
3. supabase/migrations/0003_setup_guide.sql
```

### 2. Configure Environment
Set in Supabase Edge Function secrets:
```
SMEAPI_KEY=65AC10epAx6cC3C3bAC8Gg9BBAboa9t7i2Aqx2z5EAFBwxkCm1BIfydl483v1782217262
SMEAPI_USERNAME=your_smeapi_username
```

### 3. Seed Data Plans
Run the INSERT statements from `0003_setup_guide.sql` to populate:
- MTN data plans
- GLO data plans
- AIRTEL data plans
- 9MOBILE data plans

### 4. Deploy Edge Function
```bash
supabase functions deploy vtu-purchase
```

## Verification Queries

### Check Wallet Balance
```sql
SELECT user_id, balance 
FROM public.wallets 
WHERE user_id = 'user-uuid';
```

### Check Transaction Status
```sql
SELECT 
  id, 
  status, 
  product_amount, 
  charge_amount, 
  total_amount, 
  phone_number,
  wallet_debit_confirmed,
  provider_success_confirmed,
  refund_issued,
  created_at
FROM public.transactions 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Refunds
```sql
SELECT 
  t.id as transaction_id,
  r.reason,
  r.amount,
  r.status,
  r.created_at
FROM public.refund_logs r
JOIN public.transactions t ON r.transaction_id = t.id
WHERE r.user_id = 'user-uuid'
ORDER BY r.created_at DESC;
```

### Check SMEAPI Communication
```sql
SELECT 
  provider,
  endpoint,
  method,
  response_status,
  response_body,
  created_at
FROM public.api_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC 
LIMIT 20;
```

## Troubleshooting

### Issue: Transaction goes from Processing to Refunded

**Check:**
1. SMEAPI response status in api_logs table
2. Transaction status and error_message
3. Provider response body for error details

**Common Causes:**
- Invalid phone number format
- Insufficient SMEAPI balance
- Network provider service issue
- Wrong data plan API code

### Issue: Wallet balance inconsistent

**Check:**
```sql
-- Sum of all debits
SELECT SUM(total_amount) as total_debited
FROM transactions 
WHERE user_id = 'user-uuid' AND status IN ('success', 'processing');

-- Sum of all refunds
SELECT SUM(amount) as total_refunded
FROM refund_logs 
WHERE user_id = 'user-uuid' AND status = 'completed';
```

### Issue: Duplicate charges

**Verify:**
- `wallet_debit_confirmed` is only set once per transaction
- `refund_issued` flag prevents duplicate refunds
- Check api_logs for duplicate SMEAPI requests

## Security Notes

- Service role key used for database operations
- User authenticated with Bearer token
- Phone numbers validated with Nigerian format regex
- Amount validation (minimum ₦50 for airtime)
- RLS policies enforce user data isolation
- All transactions logged for audit trail

## Performance

- Database indexes on frequently queried columns
- Transaction-level consistency checks
- Atomic wallet debit operations
- Efficient SMEAPI request handling

## Support & Next Steps

1. **Monitor live transactions:** Check api_logs table regularly
2. **User wallet funding:** Implement payment gateway integration
3. **SMEAPI balance:** Monitor and maintain SMEAPI account balance
4. **Error handling:** Add customer support notifications
5. **Analytics:** Track transaction success rates by network

---

**System Status: ✅ Production Ready**

All critical issues fixed:
- ✅ Refund logic corrected (always refunds exact amount)
- ✅ SMEAPI integration verified
- ✅ Transaction atomicity ensured
- ✅ Duplicate prevention implemented
- ✅ Comprehensive logging added
