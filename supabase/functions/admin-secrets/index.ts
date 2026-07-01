// Admin-only management of Paystack secret keys and webhook secret.
// Reads/writes public.secure_secrets via service role.
// Validates Paystack keys by calling GET /bank on Paystack before saving.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const SECRET_NAMES = [
  'paystack_test_secret_key',
  'paystack_live_secret_key',
  'paystack_webhook_secret',
] as const

type SecretName = typeof SECRET_NAMES[number]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function validatePaystackKey(secret: string) {
  try {
    const r = await fetch('https://api.paystack.co/bank?perPage=1', { headers: { Authorization: `Bearer ${secret}` } })
    const j = await r.json()
    return !!j?.status
  } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Missing auth' }, 401)
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data: userData, error: uerr } = await userClient.auth.getUser()
    if (uerr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const uid = userData.user.id

    const svc = createClient(supaUrl, svcKey)
    const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', uid)
    const isAdmin = !!roles?.some((r: any) => r.role === 'admin')
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)

    if (req.method === 'GET') {
      const { data } = await svc.from('secure_secrets').select('name, updated_at').in('name', SECRET_NAMES as unknown as string[])
      const map: Record<string, { set: boolean; updated_at?: string }> = {}
      for (const n of SECRET_NAMES) map[n] = { set: false }
      for (const row of data || []) map[row.name] = { set: true, updated_at: row.updated_at }
      return json({ secrets: map })
    }

    const body = await req.json().catch(() => ({}))
    const { action, name, value } = body as { action: string; name?: string; value?: string }

    if (action === 'validate') {
      if (!value) return json({ ok: false, error: 'Missing key' })
      const ok = await validatePaystackKey(value)
      return json({ ok })
    }

    if (action === 'save') {
      if (!name || !SECRET_NAMES.includes(name as SecretName)) return json({ error: 'Invalid secret name' }, 400)
      if (typeof value !== 'string' || value.length < 8) return json({ error: 'Value too short' }, 400)
      if (name === 'paystack_test_secret_key' || name === 'paystack_live_secret_key') {
        const ok = await validatePaystackKey(value)
        if (!ok) return json({ error: 'Paystack rejected this key. Please double-check it.' }, 400)
      }
      const { error } = await svc.from('secure_secrets').upsert({ name, value, updated_by: uid, updated_at: new Date().toISOString() })
      if (error) return json({ error: error.message }, 500)
      await svc.rpc('log_admin_action', { _action: 'update_secret', _target_type: 'secure_secrets', _target_id: name, _details: { name } }).catch(() => {})
      return json({ ok: true })
    }

    if (action === 'delete') {
      if (!name || !SECRET_NAMES.includes(name as SecretName)) return json({ error: 'Invalid secret name' }, 400)
      await svc.from('secure_secrets').delete().eq('name', name)
      await svc.rpc('log_admin_action', { _action: 'delete_secret', _target_type: 'secure_secrets', _target_id: name, _details: {} }).catch(() => {})
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }
})
