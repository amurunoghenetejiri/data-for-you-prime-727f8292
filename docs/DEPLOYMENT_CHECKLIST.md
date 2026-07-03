# VTU Purchase System - Configuration Checklist

## Pre-Deployment Checklist

- [ ] Database migrations applied (0001, 0002, 0003)
- [ ] SMEAPI credentials configured in environment
- [ ] Data plans seeded in database
- [ ] API provider configured as active
- [ ] Edge function deployed
- [ ] CORS headers configured
- [ ] Service role key set
- [ ] RLS policies verified

## Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SMEAPI_KEY=65AC10epAx6cC3C3bAC8Gg9BBAboa9t7i2Aqx2z5EAFBwxkCm1BIfydl483v1782217262
SMEAPI_USERNAME=your_smeapi_username
```

## Database Verification

```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('wallets', 'transactions', 'api_logs', 'refund_logs', 'api_providers', 'data_plans');

-- Verify provider configured
SELECT * FROM public.api_providers WHERE is_active = true;

-- Verify data plans
SELECT COUNT(*) FROM public.data_plans;

-- Verify functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

## First Transaction Test

1. **Create test user wallet:**
```sql
SELECT public.init_user_wallet('test-user-id'::uuid);
UPDATE public.wallets SET balance = 10000 WHERE user_id = 'test-user-id'::uuid;
```

2. **Send test airtime request:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/vtu-purchase \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "buy-airtime",
    "network": "MTN",
    "phone": "08012345678",
    "amount": 100
  }'
```

3. **Verify transaction:**
```sql
SELECT * FROM public.transactions 
WHERE user_id = 'test-user-id'::uuid 
ORDER BY created_at DESC LIMIT 1;

SELECT * FROM public.api_logs 
WHERE user_id = 'test-user-id'::uuid 
ORDER BY created_at DESC LIMIT 1;
```

## Monitoring

### Daily Checks
- [ ] Check SMEAPI API logs for errors
- [ ] Verify wallet balances are accurate
- [ ] Monitor transaction success rate
- [ ] Check for any refunds issued

### Weekly Checks
- [ ] Analyze transaction patterns
- [ ] Verify SMEAPI account balance
- [ ] Review error logs
- [ ] Check database performance

### Monthly Tasks
- [ ] Reconcile transactions with SMEAPI
- [ ] Archive old logs
- [ ] Update data plans pricing if needed
- [ ] Review and optimize database indexes

## Common Issues & Solutions

### Issue: Function returns 500 error
**Solution:** Check environment variables are set in Supabase dashboard

### Issue: Wallet debit succeeds but SMEAPI fails
**Solution:** Automatic refund should trigger. Verify in refund_logs table.

### Issue: Duplicate transactions
**Solution:** Each transaction gets unique UUID. Check frontend isn't sending duplicate requests.

### Issue: SMEAPI returns "insufficient balance"
**Solution:** Fund your SMEAPI merchant account

## Rollback Procedure

If critical issues occur:

1. Disable function deployment
2. Rollback last database migration
3. Refund affected users manually
4. Review transaction logs
5. Redeploy after fixes

## Success Metrics

- Transaction success rate: > 95%
- Refund accuracy: 100% (exact amount)
- API response time: < 5 seconds
- Wallet balance consistency: 100%
- Zero duplicate charges: ✓
- Zero duplicate refunds: ✓

---

**Status: Ready for Production**
