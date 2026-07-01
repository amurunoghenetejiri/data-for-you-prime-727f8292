import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getActivePaystackSecret } from '../_shared/paystack.ts'

const KNOWN_CODES: Record<string, string> = {
  'Access Bank': '044', 'GTBank': '058', 'Guaranty Trust Bank': '058',
  'First Bank': '011', 'First Bank of Nigeria': '011',
  'UBA': '033', 'United Bank for Africa': '033',
  'Zenith Bank': '057', 'Fidelity Bank': '070', 'Union Bank': '032',
  'Sterling Bank': '232', 'Wema Bank': '035', 'FCMB': '214',
  'Keystone Bank': '082', 'Polaris Bank': '076', 'Ecobank': '050',
  'Stanbic IBTC': '221', 'Opay': '999992', 'OPay': '999992',
  'PalmPay': '999991', 'Moniepoint': '50515', 'Moniepoint MFB': '50515',
  'Kuda': '50211', 'Kuda Bank': '50211',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function resolveBankCode(bankName: string, secret: string): Promise<string | null> {
  if (KNOWN_CODES[bankName]) return KNOWN_CODES[bankName]
  try {
    const r = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=200', {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const j = await r.json()
    const target = bankName.toLowerCase()
    const match = j?.data?.find((b: any) =>
      String(b.name).toLowerCase() === target ||
      String(b.name).toLowerCase().includes(target),
    )
    return match?.code ?? null
  } catch {
    return null
  }
}

async function logAttempt(userId: string | null, fields: {
  bank_name?: string; bank_code?: string | null; account_number?: string;
  account_name?: string | null; success: boolean; error_message?: string | null;
}) {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(url, key)
    await sb.from('bank_verification_logs').insert({
      user_id: userId, ...fields,
    })
  } catch (_) { /* swallow */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const { account_number, bank_name, bank_code } = body || {}

  // Try to identify the caller for logging (optional — function may be public)
  let userId: string | null = null
  try {
    const auth = req.headers.get('authorization')?.replace('Bearer ', '')
    if (auth) {
      const url = Deno.env.get('SUPABASE_URL')!
      const anon = Deno.env.get('SUPABASE_ANON_KEY')!
      const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${auth}` } } })
      const { data } = await sb.auth.getUser()
      userId = data.user?.id ?? null
    }
  } catch (_) { /* ignore */ }

  try {
    if (!account_number || String(account_number).length < 10) {
      await logAttempt(userId, { bank_name, account_number, success: false, error_message: 'Invalid account number' })
      return jsonResponse({ error: 'Enter a valid 10-digit account number' }, 400)
    }
    const { secret } = await getActivePaystackSecret()
    if (!secret) {
      await logAttempt(userId, { bank_name, account_number, success: false, error_message: 'Paystack not configured' })
      return jsonResponse({ error: 'Bank verification is temporarily unavailable. Please try again later.' }, 503)
    }

    const code = bank_code || (bank_name ? await resolveBankCode(bank_name, secret) : null)
    if (!code) {
      await logAttempt(userId, { bank_name, account_number, success: false, error_message: `Unknown bank: ${bank_name}` })
      return jsonResponse({ error: `Could not find bank code for "${bank_name}". Choose another bank.` }, 400)
    }

    const r = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(code)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    )
    const data = await r.json().catch(() => null) as any

    if (!data?.status) {
      const msg = data?.message || 'Could not verify this account. Please check the number and bank.'
      await logAttempt(userId, { bank_name, bank_code: code, account_number, success: false, error_message: msg })
      return jsonResponse({ error: msg }, 200) // 200 so client doesn't see "non-2xx", just inspects body
    }

    await logAttempt(userId, {
      bank_name, bank_code: code, account_number,
      account_name: data.data.account_name, success: true,
    })
    return jsonResponse({
      account_name: data.data.account_name,
      account_number: data.data.account_number,
      bank_name, bank_code: code,
    })
  } catch (e) {
    const msg = (e as Error).message || 'Unexpected error'
    await logAttempt(userId, { bank_name, account_number, success: false, error_message: msg })
    return jsonResponse({ error: 'Bank verification failed. Please try again.' }, 200)
  }
})
