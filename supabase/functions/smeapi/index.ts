// DATA4ME SMEAPI proxy edge function
// Routes: balance | dataplans | buy-data | buy-airtime | cabletv-verify | electricity-verify
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const BASE = 'https://smeapi.com/api';
const USERNAME = Deno.env.get('SMEAPI_USERNAME') || '';
const API_KEY = Deno.env.get('SMEAPI_API_KEY') || '';
const PIN = Deno.env.get('SMEAPI_PIN') || '';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'x-api-key': API_KEY,
    'x-username': USERNAME,
  } as Record<string, string>;
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!API_KEY || !USERNAME) {
      return new Response(JSON.stringify({ error: 'SMEAPI credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'POST' ? (await req.clone().json().catch(() => ({})))?.action : null);
    let payload: any = {};
    if (req.method === 'POST') { try { payload = await req.json(); } catch { payload = {}; } }

    let result;
    switch (action) {
      case 'balance':
        result = await call('/user', { method: 'GET' });
        break;
      case 'dataplans':
        result = await call('/dataplans', { method: 'GET' });
        break;
      case 'buy-data':
        result = await call('/data', {
          method: 'POST',
          body: JSON.stringify({
            network: payload.network,
            mobile_number: payload.phone,
            plan: payload.plan_id,
            Ported_number: true,
            pin: PIN,
          }),
        });
        break;
      case 'buy-airtime':
        result = await call('/airtime', {
          method: 'POST',
          body: JSON.stringify({
            network: payload.network,
            amount: payload.amount,
            mobile_number: payload.phone,
            Ported_number: true,
            airtime_type: 'VTU',
            pin: PIN,
          }),
        });
        break;
      case 'cabletv-verify':
        result = await call('/cabletv/verify', {
          method: 'POST',
          body: JSON.stringify({ cablename: payload.provider, smart_card_number: payload.smart_card_number }),
        });
        break;
      case 'electricity-verify':
        result = await call('/electricity/verify', {
          method: 'POST',
          body: JSON.stringify({ disco_name: payload.disco, meter_number: payload.meter_number, MeterType: payload.meter_type || 'PREPAID' }),
        });
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
