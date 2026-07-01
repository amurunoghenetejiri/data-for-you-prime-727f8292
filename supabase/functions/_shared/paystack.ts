// Shared helper: resolve the active Paystack secret key.
// Preference order:
//   1. secure_secrets row for current mode (paystack_(mode)_secret_key)
//   2. PAYSTACK_SECRET_KEY environment variable (legacy fallback)
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

export async function getActivePaystackSecret(): Promise<{ secret: string | null; mode: 'test' | 'live' }> {
  const url = Deno.env.get('SUPABASE_URL')
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  let mode: 'test' | 'live' = 'test'
  let dbSecret: string | null = null
  if (url && svcKey) {
    try {
      const svc = createClient(url, svcKey)
      const { data: settings } = await svc.from('app_settings').select('paystack_mode').eq('id', 1).maybeSingle()
      mode = (settings?.paystack_mode as 'test' | 'live') || 'test'
      const secretName = mode === 'live' ? 'paystack_live_secret_key' : 'paystack_test_secret_key'
      const { data: secret } = await svc.from('secure_secrets').select('value').eq('name', secretName).maybeSingle()
      if (secret?.value) dbSecret = secret.value
    } catch { /* fall through to env */ }
  }
  const envSecret = Deno.env.get('PAYSTACK_SECRET_KEY') || null
  return { secret: dbSecret || envSecret, mode }
}
