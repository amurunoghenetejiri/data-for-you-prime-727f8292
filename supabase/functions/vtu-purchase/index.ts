// DATA4ME — Unified VTU purchase edge function.
// - Resolves the active provider from public.api_providers
// - Reads plan / pricing from the database
// - Applies charge via public.apply_charge()
// - Debits wallet (public.debit_wallet)
// - Dispatches to provider adapter (SMEAPI today, easy to add more)
// - Records supplier response and profit
// - Auto-refunds on failure via public.refund_transaction()

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

type Ctx = {
  svc: ReturnType<typeof createClient>;
  userId: string;
  provider: any;
  secrets: Record<string, string>;
};

async function loadProvider(svc: any) {
  const { data } = await svc.from('api_providers').select('*').eq('is_active', true).limit(1).maybeSingle();
  if (!data) throw new Error('No active VTU provider configured');
  const secrets: Record<string, string> = {};
  const load = (n?: string) => { if (n) secrets[n] = Deno.env.get(n) || ''; };
  load(data.api_key_secret);
  load(data.api_secret_secret);
  load(data.extra_secret);
  if (data.config?.username_secret) load(data.config.username_secret);
  return { provider: data, secrets };
}

// ---------------- SMEAPI adapter ----------------
async function smeapiRequest(ctx: Ctx, path: string, init: RequestInit) {
  const key = ctx.secrets[ctx.provider.api_key_secret] || '';
  const username = ctx.secrets[ctx.provider.config?.username_secret || ''] || '';
  const res = await fetch(`${ctx.provider.base_url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'x-api-key': key,
      'x-username': username,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

async function providerBuyData(ctx: Ctx, args: { network: string; phone: string; api_code: string }) {
  if (ctx.provider.slug === 'smeapi') {
    const pin = ctx.secrets[ctx.provider.extra_secret || ''] || '';
    return smeapiRequest(ctx, '/data', {
      method: 'POST',
      body: JSON.stringify({
        network: args.network, mobile_number: args.phone, plan: args.api_code,
        Ported_number: true, pin,
      }),
    });
  }
  throw new Error(`Unsupported provider: ${ctx.provider.slug}`);
}

async function providerBuyAirtime(ctx: Ctx, args: { network: string; phone: string; amount: number }) {
  if (ctx.provider.slug === 'smeapi') {
    const pin = ctx.secrets[ctx.provider.extra_secret || ''] || '';
    return smeapiRequest(ctx, '/airtime', {
      method: 'POST',
      body: JSON.stringify({
        network: args.network, amount: args.amount, mobile_number: args.phone,
        Ported_number: true, airtime_type: 'VTU', pin,
      }),
    });
  }
  throw new Error(`Unsupported provider: ${ctx.provider.slug}`);
}

// ---------------- main handler ----------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Not authenticated' }, 401);
    const { data: u } = await svc.auth.getUser(token);
    const userId = u?.user?.id;
    if (!userId) return json({ error: 'Invalid session' }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = payload?.action as 'buy-data' | 'buy-airtime';
    if (!action) return json({ error: 'action required' }, 400);

    const { provider, secrets } = await loadProvider(svc);
    const ctx: Ctx = { svc, userId, provider, secrets };

    // ---------- BUY DATA ----------
    if (action === 'buy-data') {
      const { plan_id, phone } = payload;
      if (!plan_id || !/^0[789][01]\d{8}$/.test(phone || '')) return json({ error: 'plan_id and valid phone required' }, 400);

      const { data: plan } = await svc.from('data_plans').select('*').eq('id', plan_id).eq('is_active', true).maybeSingle();
      if (!plan) return json({ error: 'Plan not found or inactive' }, 404);

      const sellingPrice = Number(plan.selling_price);
      const { data: chargeAmt } = await svc.rpc('apply_charge', { _service: 'data', _amount: sellingPrice });
      const charge = Number(chargeAmt || 0);
      const total = sellingPrice + charge;
      const profit = sellingPrice - Number(plan.cost_price || 0);

      // Debit wallet (fails cleanly if insufficient)
      const { data: tx, error: debitErr } = await svc.rpc('debit_wallet', {
        _user_id: userId, _amount: total, _type: 'data',
        _description: `${String(plan.network).toUpperCase()} ${plan.data_size || plan.plan_name} to ${phone}`,
        _meta: { plan_id, phone, network: plan.network, selling_price: sellingPrice, charge },
      });
      if (debitErr) return json({ error: debitErr.message }, 400);

      const txId = (tx as any)?.id ?? (Array.isArray(tx) ? (tx as any)[0]?.id : null);

      // Attach charge/profit
      if (txId) await svc.from('transactions').update({ charge, profit }).eq('id', txId);

      // Call provider
      try {
        const resp = await providerBuyData(ctx, {
          network: String(plan.network), phone, api_code: plan.api_code || plan.plan_id,
        });
        const success = resp.ok && ['successful', 'success', 'completed'].includes(String(resp.body?.Status || resp.body?.status || '').toLowerCase());

        if (txId) {
          await svc.from('transactions').update({
            provider_response: resp.body,
            supplier_reference: resp.body?.api_response?.reference || resp.body?.ident || null,
            status: success ? 'success' : 'failed',
          }).eq('id', txId);
        }

        if (!success) {
          if (txId) await svc.rpc('refund_transaction', { _tx_id: txId, _reason: 'Supplier failure' });
          return json({ success: false, error: resp.body?.message || 'Provider declined the request', response: resp.body }, 502);
        }

        return json({ success: true, tx_id: txId, charge, total, response: resp.body });
      } catch (err) {
        if (txId) await svc.rpc('refund_transaction', { _tx_id: txId, _reason: 'Network error' });
        return json({ success: false, error: String(err) }, 502);
      }
    }

    // ---------- BUY AIRTIME ----------
    if (action === 'buy-airtime') {
      const { network, phone, amount } = payload;
      const amt = Number(amount);
      if (!network || !/^0[789][01]\d{8}$/.test(phone || '') || !(amt >= 50)) {
        return json({ error: 'network, valid phone, and amount>=50 required' }, 400);
      }
      const { data: chargeAmt } = await svc.rpc('apply_charge', { _service: 'airtime', _amount: amt });
      const charge = Number(chargeAmt || 0);
      const total = amt + charge;
      const profit = 0; // typically airtime margins come from supplier discount

      const { data: tx, error: debitErr } = await svc.rpc('debit_wallet', {
        _user_id: userId, _amount: total, _type: 'airtime',
        _description: `${String(network).toUpperCase()} airtime ₦${amt} to ${phone}`,
        _meta: { network, phone, amount: amt, charge },
      });
      if (debitErr) return json({ error: debitErr.message }, 400);
      const txId = (tx as any)?.id ?? (Array.isArray(tx) ? (tx as any)[0]?.id : null);
      if (txId) await svc.from('transactions').update({ charge, profit }).eq('id', txId);

      try {
        const resp = await providerBuyAirtime(ctx, { network: String(network), phone, amount: amt });
        const success = resp.ok && ['successful', 'success', 'completed'].includes(String(resp.body?.Status || resp.body?.status || '').toLowerCase());
        if (txId) {
          await svc.from('transactions').update({
            provider_response: resp.body,
            supplier_reference: resp.body?.api_response?.reference || resp.body?.ident || null,
            status: success ? 'success' : 'failed',
          }).eq('id', txId);
        }
        if (!success) {
          if (txId) await svc.rpc('refund_transaction', { _tx_id: txId, _reason: 'Supplier failure' });
          return json({ success: false, error: resp.body?.message || 'Provider declined', response: resp.body }, 502);
        }
        return json({ success: true, tx_id: txId, charge, total, response: resp.body });
      } catch (err) {
        if (txId) await svc.rpc('refund_transaction', { _tx_id: txId, _reason: 'Network error' });
        return json({ success: false, error: String(err) }, 502);
      }
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
