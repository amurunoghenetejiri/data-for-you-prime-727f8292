# Payment Management System

Complete payment management system for Data4Me with support for Paystack, Monnify, and manual payment methods.

## Overview

The Payment Management System allows administrators to:
- Configure multiple payment providers (Paystack, Monnify)
- Switch between test and live modes without code changes
- Manage manual payment methods (bank transfers)
- Enable/disable payment providers dynamically
- Audit all payment configuration changes

## Features

### 1. Payment Providers

#### Paystack Integration
- **Test Mode**: Configure test credentials for development
- **Live Mode**: Switch to production credentials when ready
- **Mode Switching**: Change modes instantly from admin panel
- **Webhook Support**: Optional webhook secret configuration
- **Public Key Management**: Secure key storage in database

#### Monnify Integration
- **Sandbox/Production**: Support for both environments
- **Full Configuration**: API key, secret key, contract code
- **Base URL Management**: Customizable endpoints
- **Enable/Disable**: Toggle Monnify payment option

#### Manual Payment Methods
- **Multiple Methods**: Add unlimited manual payment options
- **Customizable**: Bank name, account details, instructions
- **Logos**: Upload and manage payment method icons
- **Sort Order**: Control display order on checkout
- **Enable/Disable**: Toggle individual methods

### 2. Admin Panel

Access Payment Settings via: **Admin Console → Payment Settings**

#### Tabs:
1. **Providers**: View and toggle payment providers
2. **Paystack**: Configure test and live credentials
3. **Monnify**: Configure Monnify integration
4. **Manual Methods**: Manage bank transfer and other methods

### 3. Database Schema

#### Tables:
- `payment_providers`: List of available providers
- `paystack_config`: Paystack configuration (singleton)
- `monnify_config`: Monnify configuration (singleton)
- `manual_payment_methods`: Custom payment methods
- `payment_method_secrets`: Encrypted secrets storage
- `payment_config_audit`: Audit trail of changes

All tables have RLS policies ensuring only admins can access.

## Usage

### Configuration

#### Paystack Setup

1. Go to Admin → Payment Settings → Paystack
2. Enter your test credentials:
   - Test Public Key: `pk_test_...`
   - Test Secret Key: `sk_test_...`
   - Test Webhook Secret (optional): `whsec_test_...`
3. Enter your live credentials:
   - Live Public Key: `pk_live_...`
   - Live Secret Key: `sk_live_...`
   - Live Webhook Secret (optional): `whsec_live_...`
4. Select active mode: Test or Live
5. Click "Save Configuration"
6. Go to Providers tab and enable Paystack

#### Monnify Setup

1. Go to Admin → Payment Settings → Monnify
2. Configure:
   - Environment: Sandbox or Production
   - API Key: Your Monnify API key
   - Secret Key: Your Monnify secret key
   - Contract Code: Your contract code
   - Base URL: Custom API endpoint (optional)
3. Click "Save Configuration"
4. Check "Enabled" checkbox
5. Go to Providers tab and enable Monnify

#### Manual Payment Methods

1. Go to Admin → Payment Settings → Manual Methods
2. Click "Add Payment Method"
3. Fill in details:
   - Display Name: "Access Bank Transfer"
   - Bank Name: "Access Bank"
   - Account Name: "Company Name"
   - Account Number: "1234567890"
   - Description: "Instructions for users"
   - Sort Order: 1 (display priority)
4. Click "Add Method"
5. The method appears on wallet funding page

### Frontend Usage

#### Getting Payment Configuration

```typescript
import { getPaymentConfig } from '@/lib/paymentConfig';

const config = await getPaymentConfig(supabase);
// config.paystackMode: 'test' | 'live'
// config.paystackPublicKey: string
// config.monnifyEnabled: boolean
```

#### Getting Checkout Methods

```typescript
import { getCheckoutPaymentMethods } from '@/lib/paymentConfig';

const methods = await getCheckoutPaymentMethods(supabase);
// methods.paystack: boolean
// methods.monnify: boolean
// methods.manualMethods: ManualPaymentMethod[]
```

#### Getting Manual Payment Methods

```typescript
import { getEnabledManualPaymentMethods } from '@/lib/paymentConfig';

const methods = await getEnabledManualPaymentMethods(supabase);
// Array of enabled manual payment methods, sorted by sort_order
```

#### Validating Configuration

```typescript
import { validatePaymentConfig } from '@/lib/paymentConfig';

const result = await validatePaymentConfig(supabase, 'paystack');
if (!result.valid) {
  console.error('Errors:', result.errors);
}
```

## API Functions

All functions are exported from `src/lib/paymentConfig.ts`:

### Configuration Getters

- `getPaymentConfig(supabase)` - Get all payment settings
- `getPaystackConfig(supabase)` - Get Paystack config
- `getMonnifyConfig(supabase)` - Get Monnify config
- `getPaystackPublicKey(supabase)` - Get Paystack public key (safe for frontend)

### Payment Methods

- `getEnabledManualPaymentMethods(supabase)` - Get enabled manual methods only
- `getAllManualPaymentMethods(supabase)` - Get all manual methods (including disabled)
- `getCheckoutPaymentMethods(supabase)` - Get all enabled payment options for checkout

### Provider Management

- `getAvailablePaymentProviders(supabase)` - Get list of enabled providers
- `isPaymentProviderEnabled(supabase, provider)` - Check if provider is enabled
- `validatePaymentConfig(supabase, provider)` - Validate provider configuration

## Security

### Best Practices

1. **Admin-Only Access**: Payment Settings page requires admin role
2. **Row-Level Security**: RLS policies prevent unauthorized access
3. **Audit Trail**: All changes logged in `payment_config_audit` table
4. **Secret Protection**: 
   - Secret keys stored in database (encrypted at rest if Supabase encryption enabled)
   - Only admins can access secrets
   - Public keys safe to expose to frontend
5. **Input Validation**: All inputs validated before saving

### Never Expose

- Secret keys to client-side code
- API keys in environment files
- Webhook secrets in frontend code

Always use server-side functions for secret key operations.

## Migration Guide

### From Hardcoded Settings

#### Before (Old Way)
```typescript
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const PAYSTACK_MODE = 'test';
```

#### After (New Way)
```typescript
import { getPaystackPublicKey } from '@/lib/paymentConfig';

const publicKey = await getPaystackPublicKey(supabase);
// Mode is automatically determined from database config
```

### Updating Existing Payment Flows

1. Replace hardcoded keys with `getPaymentConfig()`
2. Replace hardcoded payment methods with `getCheckoutPaymentMethods()`
3. Validate configuration before enabling providers
4. Test in test mode before going live

## Troubleshooting

### Paystack Not Appearing on Checkout

1. Check if Paystack is enabled in Providers tab
2. Verify active mode and keys are configured
3. Validate config: `validatePaymentConfig(supabase, 'paystack')`
4. Check browser console for errors

### Manual Payment Methods Not Showing

1. Verify at least one method is enabled
2. Check sort_order values
3. Ensure account details are filled in
4. Run: `getEnabledManualPaymentMethods(supabase)`

### Configuration Changes Not Appearing

1. Clear browser cache
2. Refresh the page
3. Query cache might be stale - check React Query cache
4. Verify changes were saved (check audit log)

## Database Audit

All payment configuration changes are logged:

```sql
SELECT * FROM payment_config_audit 
ORDER BY created_at DESC 
LIMIT 20;
```

Fields:
- `admin_id`: Who made the change
- `action`: create, update, delete
- `target_type`: paystack, monnify, manual_payment_method
- `target_id`: ID of the configuration
- `changes`: What was changed (JSONB)
- `created_at`: When the change was made

## Testing

### Test Paystack Credentials
- Public Key: `pk_test_...` (from Paystack dashboard)
- Secret Key: `sk_test_...` (from Paystack dashboard)
- Use test card: 4111 1111 1111 1111

### Test Monnify
- Use Sandbox environment
- Test credentials from Monnify dashboard
- Test USSD and Transfer methods

## Implementation Examples

### Example 1: Payment Method Selection

```typescript
import { getCheckoutPaymentMethods } from '@/lib/paymentConfig';

function CheckoutPaymentOptions() {
  const [methods, setMethods] = useState(null);

  useEffect(() => {
    (async () => {
      const available = await getCheckoutPaymentMethods(supabase);
      setMethods(available);
    })();
  }, []);

  if (!methods) return <Loading />;

  return (
    <>
      {methods.paystack && <PaystackOption />}
      {methods.monnify && <MonnifyOption />}
      {methods.manualMethods.map(m => (
        <ManualPaymentOption key={m.id} method={m} />
      ))}
    </>
  );
}
```

### Example 2: Server-Side Payment Initialization

```typescript
// Edge Function: functions/paystack-initialize/index.ts
import { getPaymentConfig } from '@/lib/paymentConfig';

export async function initializePaystack(supabase, amount, email) {
  const config = await getPaymentConfig(supabase);
  
  if (!config.paystackPublicKey) {
    throw new Error('Paystack not configured');
  }

  // Use config.paystackSecretKey for API calls (server-side only)
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amount * 100, // Paystack uses cents
      email,
    }),
  });

  return response.json();
}
```

### Example 3: Admin Configuration Validation

```typescript
async function enablePayment Provider(provider: string) {
  const validation = await validatePaymentConfig(supabase, provider);
  
  if (!validation.valid) {
    toast.error('Configuration incomplete:\n' + validation.errors.join('\n'));
    return;
  }

  // Proceed with enabling
  await supabase
    .from('payment_providers')
    .update({ is_enabled: true })
    .eq('provider_name', provider);
}
```

## Support

For issues or questions:
1. Check the audit log for configuration history
2. Verify all required fields are filled
3. Test with test credentials first
4. Check browser console for errors
5. Review the database tables directly if needed

## Files Modified/Created

### New Files
- `supabase/migrations/001_create_payment_management.sql` - Database schema
- `src/pages/admin/PaymentSettings.tsx` - Admin configuration UI
- `src/lib/paymentConfig.ts` - Payment configuration utilities

### Modified Files
- `src/App.tsx` - Added payment-settings route
- `src/pages/admin/_layout.tsx` - Added payment settings navigation
- `src/pages/Wallet.tsx` - Integrated payment configuration system

### Database Tables
- `payment_providers` - Available payment providers
- `paystack_config` - Paystack configuration
- `monnify_config` - Monnify configuration
- `manual_payment_methods` - Custom payment methods
- `payment_method_secrets` - Encrypted secrets
- `payment_config_audit` - Audit trail
