import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Paystack bank code map for common Nigerian banks. Falls back to Paystack /bank list lookup if not found.
const KNOWN_CODES: Record<string, string> = {
  'Access Bank': '044',
  'GTBank': '058',
  'Guaranty Trust Bank': '058',
  'First Bank': '011',
  'First Bank of Nigeria': '011',
  'UBA': '033',
  'United Bank for Africa': '033',
  'Zenith Bank': '057',
  'Fidelity Bank': '070',
  'Union Bank': '032',
  'Sterling Bank': '232',
  'Wema Bank': '035',
  'FCMB': '214',
  'Keystone Bank': '082',
  'Polaris Bank': '076',
  'Ecobank': '050',
  'Stanbic IBTC': '221',
  'Opay': '999992',
  'OPay': '999992',
  'PalmPay': '999991',
  'Moniepoint': '50515',
  'Moniepoint MFB': '50515',
  'Kuda': '50211',
  'Kuda Bank': '50211',
}

async function resolveBankCode(bankName: string, secret: string): Promise<string | null> {
  if (KNOWN_CODES[bankName]) return KNOWN_CODES[bankName]
  try {
    const r = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=200', {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const j = await r.json()
    const match = j?.data?.find((b: any) =>
      String(b.name).toLowerCase() === bankName.toLowerCase() ||
      String(b.name).toLowerCase().includes(bankName.toLowerCase()),
    )
    return match?.code ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { account_number, bank_name, bank_code } = await req.json()
    if (!account_number || account_number.length < 10) {
      return new Response(JSON.stringify({ error: 'Valid 10-digit account number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secret) return new Response(JSON.stringify({ error: 'Paystack not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const code = bank_code || (bank_name ? await resolveBankCode(bank_name, secret) : null)
    if (!code) return new Response(JSON.stringify({ error: `Unknown bank: ${bank_name}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const r = await fetch(`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(code)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await r.json()
    if (!data?.status) {
      return new Response(JSON.stringify({ error: data?.message || 'Could not verify account' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      account_name: data.data.account_name,
      account_number: data.data.account_number,
      bank_name,
      bank_code: code,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
