import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { amount, email, username } = await req.json()
    if (!amount || amount < 100 || !email) {
      return new Response(JSON.stringify({ error: 'amount (>=100) and email are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!secret) return new Response(JSON.stringify({ error: 'Paystack not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const reference = `D4M-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const origin = req.headers.get('origin') ?? ''
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        reference,
        callback_url: `${origin}/wallet?paystack_ref=${reference}`,
        metadata: { username, source: 'data4me-wallet' },
      }),
    })
    const data = await r.json()
    if (!data?.status) return new Response(JSON.stringify({ error: data?.message || 'Init failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ authorization_url: data.data.authorization_url, reference: data.data.reference }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})