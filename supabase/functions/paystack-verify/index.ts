import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { reference } = await req.json()
    if (!reference) return new Response(JSON.stringify({ error: 'reference required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secret) return new Response(JSON.stringify({ error: 'Paystack not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await r.json()
    const success = data?.status && data?.data?.status === 'success'
    return new Response(JSON.stringify({
      success,
      reference,
      amount: success ? Number(data.data.amount) / 100 : 0,
      email: data?.data?.customer?.email ?? null,
      raw_status: data?.data?.status ?? 'unknown',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})