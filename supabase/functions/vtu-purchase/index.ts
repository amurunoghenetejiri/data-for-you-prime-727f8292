// DATA4ME — VTU Purchase Edge Function (production)
// Fixes: correct SMEAPI base URL + auth + PIN, correct debit_wallet result parsing,
// only refund on confirmed provider failure, complete transaction via direct update.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

// ============================================
// CONFIG
// ============================================

interface Config {
  supabaseUrl: string;
  supabaseServiceKey: string;
  smeapiKey: string;
  smeapiUsername: string;
  smeapiPin: string;
  smeapiBaseUrl: string;
}

function loadConfig(): Config {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  // Accept both names for backwards compat, prefer SMEAPI_API_KEY
  const smeapiKey =
    Deno.env.get('SMEAPI_API_KEY') || Deno.env.get('SMEAPI_KEY') || '';
  const smeapiUsername = Deno.env.get('SMEAPI_USERNAME') || '';
  const smeapiPin = Deno.env.get('SMEAPI_PIN') || '';
  const smeapiBaseUrl =
    Deno.env.get('SMEAPI_BASE_URL') || 'https://smeapi.com/api';

  if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  if (!smeapiKey) throw new Error('SMEAPI_API_KEY not configured');

  return {
    supabaseUrl,
    supabaseServiceKey,
    smeapiKey,
    smeapiUsername,
    smeapiPin,
    smeapiBaseUrl,
  };
}

// ============================================
// LOGGER
// ============================================

function createLogger() {
  const logs: any[] = [];
  const emit = (level: string, step: string, data: any = {}, error?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      step,
      data,
      ...(error !== undefined
        ? { error: error instanceof Error ? error.message : String(error) }
        : {}),
    };
    logs.push(entry);
    console.log(`[${level}] ${step}`, JSON.stringify(entry));
  };
  return {
    log: (step: string, data?: any) => emit('INFO', step, data),
    error: (step: string, error: any, data?: any) => emit('ERROR', step, data, error),
    getLogs: () => logs,
  };
}
type Logger = ReturnType<typeof createLogger>;

// ============================================
// RESPONSES
// ============================================

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const ok = (data: any) =>
  new Response(JSON.stringify({ success: true, ...data }), { status: 200, headers: jsonHeaders });
const fail = (error: string, status = 400, extra: any = {}) =>
  new Response(JSON.stringify({ success: false, error, ...extra }), { status, headers: jsonHeaders });

// ============================================
// VALIDATION
// ============================================

const NETWORKS = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'];
const validPhone = (p: string) => typeof p === 'string' && /^0\d{10}$/.test(p.trim());
const validUuid = (v: string) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function normalizeNetwork(n: string): string | null {
  const u = (n || '').toUpperCase().trim();
  return NETWORKS.includes(u) ? u : null;
}

// SMEAPI network codes (integer IDs used by /data endpoint)
const NETWORK_CODES: Record<string, number> = {
  MTN: 1,
  GLO: 2,
  AIRTEL: 4,
  '9MOBILE': 3,
};

// ============================================
// SMEAPI CLIENT
// ============================================

async function smeapiCall(
  cfg: Config,
  logger: Logger,
  path: string,
  body: any,
): Promise<{ httpOk: boolean; status: number; body: any; raw: string; networkError?: string }> {
  const url = `${cfg.smeapiBaseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.smeapiKey}`,
    'x-api-key': cfg.smeapiKey,
  };
  if (cfg.smeapiUsername) headers['x-username'] = cfg.smeapiUsername;

  logger.log('SMEAPI_REQUEST', { url, bodyKeys: Object.keys(body || {}) });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const raw = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }
    logger.log('SMEAPI_RESPONSE', { status: res.status, body: parsed });
    return { httpOk: res.ok, status: res.status, body: parsed, raw };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('SMEAPI_NETWORK_ERROR', err, { url });
    return { httpOk: false, status: 0, body: null, raw: '', networkError: msg };
  }
}

/**
 * Determine whether an SMEAPI response is a CONFIRMED success.
 * Conservative: unknown/ambiguous responses are NOT treated as success — we do NOT refund
 * on ambiguity either (see caller). SMEAPI (smeplug) returns { status: 'success', ... } on OK.
 */
function isConfirmedSuccess(resp: { httpOk: boolean; status: number; body: any }): boolean {
  if (!resp.httpOk || !resp.body) return false;
  const b = resp.body;
  const status = String(b.Status ?? b.status ?? '').toLowerCase().trim();
  if (['success', 'successful', 'completed', 'complete'].includes(status)) return true;
  if (b.success === true || b.successful === true) return true;
  if (typeof b.message === 'string' && /success|delivered|completed/i.test(b.message)) return true;
  return false;
}

/**
 * Determine whether the response is an EXPLICIT failure the provider is confident about.
 * Only on explicit failure do we refund. Ambiguous responses become "pending" instead.
 */
function isConfirmedFailure(resp: { httpOk: boolean; status: number; body: any; networkError?: string }): boolean {
  // Client-side validation errors from provider (4xx) are definite failures
  if (resp.status >= 400 && resp.status < 500) return true;
  if (!resp.body) return false;
  const b = resp.body;
  const status = String(b.Status ?? b.status ?? '').toLowerCase().trim();
  if (['failed', 'failure', 'error', 'declined', 'rejected'].includes(status)) return true;
  if (b.success === false || b.successful === false) return true;
  if (typeof b.error === 'string' && b.error.length > 0) return true;
  return false;
}

function extractReference(body: any): string | null {
  if (!body || typeof body !== 'object') return null;
  return (
    body.reference ??
    body.ident ??
    body.transaction_id ??
    body.transactionId ??
    body.ref ??
    body.request_id ??
    body.data?.reference ??
    body.data?.id ??
    null
  );
}

// ============================================
// TRANSACTION LIFECYCLE
// ============================================

async function updateTx(svc: any, logger: Logger, txId: string, patch: Record<string, any>) {
  try {
    const { error } = await svc.from('transactions').update(patch).eq('id', txId);
    if (error) logger.error('TX_UPDATE_FAILED', error, { txId, patch });
  } catch (err) {
    logger.error('TX_UPDATE_EXCEPTION', err, { txId });
  }
}

async function issueRefund(svc: any, logger: Logger, txId: string, reason: string) {
  try {
    const { error } = await svc.rpc('refund_transaction', { _tx_id: txId, _reason: reason });
    if (error) {
      logger.error('REFUND_RPC_ERROR', error, { txId });
      return false;
    }
    logger.log('REFUND_ISSUED', { txId, reason });
    return true;
  } catch (err) {
    logger.error('REFUND_EXCEPTION', err, { txId });
    return false;
  }
}

// debit_wallet RPC returns a single `transactions` row (not an array).
async function debitWallet(
  svc: any,
  logger: Logger,
  userId: string,
  amount: number,
  type: string,
  description: string,
  meta: Record<string, any>,
): Promise<{ txId: string | null; error?: string }> {
  const { data, error } = await svc.rpc('debit_wallet', {
    _user_id: userId,
    _amount: amount,
    _type: type,
    _description: description,
    _meta: meta,
  });
  if (error) {
    logger.error('DEBIT_WALLET_ERROR', error, { userId, amount });
    return { txId: null, error: error.message || 'Failed to debit wallet' };
  }
  // PostgREST returns a single row for a function returning a composite type.
  const row = Array.isArray(data) ? data[0] : data;
  const txId = row?.id ?? null;
  if (!txId) {
    logger.error('DEBIT_WALLET_NO_ROW', new Error('no row'), { data });
    return { txId: null, error: 'Failed to create transaction' };
  }
  logger.log('WALLET_DEBITED', { txId, amount });
  return { txId };
}

// ============================================
// BUY AIRTIME
// ============================================

async function buyAirtime(
  cfg: Config,
  logger: Logger,
  svc: any,
  userId: string,
  network: string,
  phone: string,
  amount: any,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const net = normalizeNetwork(network);
  if (!net) return { success: false, error: `Invalid network. Supported: ${NETWORKS.join(', ')}` };
  if (!validPhone(phone)) return { success: false, error: 'Invalid Nigerian phone number. Format: 08012345678' };
  const productAmount = Number(amount);
  if (!Number.isFinite(productAmount) || productAmount < 50 || productAmount > 1_000_000) {
    return { success: false, error: 'Amount must be between ₦50 and ₦1,000,000' };
  }

  const chargeAmount = 1;
  const totalAmount = productAmount + chargeAmount;

  // Balance check
  const { data: wallet, error: wErr } = await svc
    .from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (wErr) {
    logger.error('WALLET_READ_ERROR', wErr, { userId });
    return { success: false, error: 'Failed to check wallet balance' };
  }
  const balance = Number(wallet?.balance || 0);
  if (balance < totalAmount) {
    return { success: false, error: `Insufficient balance. Required: ₦${totalAmount}, Available: ₦${balance}` };
  }

  // Debit
  const { txId, error: debitError } = await debitWallet(
    svc, logger, userId, totalAmount, 'airtime',
    `${net} airtime ₦${productAmount} to ${phone.trim()}`,
    { product_amount: productAmount, charge_amount: chargeAmount, network: net, phone: phone.trim() },
  );
  if (!txId) return { success: false, error: debitError || 'Failed to debit wallet' };

  // Mark pending for provider call
  await updateTx(svc, logger, txId, { status: 'pending' });

  // Call SMEAPI
  const payload = {
    network: NETWORK_CODES[net],
    amount: productAmount,
    mobile_number: phone.trim(),
    Ported_number: true,
    airtime_type: 'VTU',
    pin: cfg.smeapiPin,
  };
  const resp = await smeapiCall(cfg, logger, '/topup/', payload);

  // Persist provider response regardless of outcome
  await updateTx(svc, logger, txId, {
    provider_response: resp.body ?? { networkError: resp.networkError, raw: resp.raw },
    supplier_reference: extractReference(resp.body),
  });

  if (isConfirmedSuccess(resp)) {
    await updateTx(svc, logger, txId, { status: 'success' });
    return {
      success: true,
      data: {
        txId, phone, network: net,
        amount: productAmount, charge: chargeAmount, total: totalAmount,
        supplier_reference: extractReference(resp.body),
        message: `✓ Airtime purchase successful. ₦${productAmount} sent to ${phone}.`,
      },
    };
  }

  if (isConfirmedFailure(resp)) {
    const reason =
      resp.body?.message || resp.body?.error || resp.networkError ||
      `Provider rejected (HTTP ${resp.status})`;
    await updateTx(svc, logger, txId, { status: 'failed' });
    await issueRefund(svc, logger, txId, reason);
    return { success: false, error: reason, data: { txId } };
  }

  // Ambiguous (5xx, timeout, unknown shape) — leave as pending, do NOT refund automatically.
  logger.log('SMEAPI_AMBIGUOUS', { txId, status: resp.status });
  await updateTx(svc, logger, txId, { status: 'pending' });
  return {
    success: false,
    error:
      'Provider response was inconclusive. Your transaction is pending review — do not retry. If not delivered within 30 minutes, it will be refunded.',
    data: { txId, pending: true },
  };
}

// ============================================
// BUY DATA
// ============================================

async function buyData(
  cfg: Config,
  logger: Logger,
  svc: any,
  userId: string,
  planId: string,
  phone: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!validUuid(planId)) return { success: false, error: 'Invalid plan ID' };
  if (!validPhone(phone)) return { success: false, error: 'Invalid Nigerian phone number. Format: 08012345678' };

  const { data: plan, error: planErr } = await svc
    .from('data_plans').select('*').eq('id', planId).eq('is_active', true).maybeSingle();
  if (planErr) {
    logger.error('PLAN_READ_ERROR', planErr, { planId });
    return { success: false, error: 'Failed to fetch data plan' };
  }
  if (!plan) return { success: false, error: 'Data plan not found or inactive' };

  const net = normalizeNetwork(plan.network);
  if (!net) return { success: false, error: `Unsupported plan network: ${plan.network}` };
  const productAmount = Number(plan.selling_price || 0);
  if (productAmount <= 0) return { success: false, error: 'Invalid plan price' };
  const chargeAmount = 1;
  const totalAmount = productAmount + chargeAmount;

  const { data: wallet, error: wErr } = await svc
    .from('wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (wErr) return { success: false, error: 'Failed to check wallet balance' };
  const balance = Number(wallet?.balance || 0);
  if (balance < totalAmount) {
    return { success: false, error: `Insufficient balance. Required: ₦${totalAmount}, Available: ₦${balance}` };
  }

  const { txId, error: debitError } = await debitWallet(
    svc, logger, userId, totalAmount, 'data',
    `${net} ${plan.data_size || plan.plan_name} data to ${phone.trim()}`,
    {
      product_amount: productAmount, charge_amount: chargeAmount,
      plan_id: planId, network: net, data_size: plan.data_size, phone: phone.trim(),
    },
  );
  if (!txId) return { success: false, error: debitError || 'Failed to debit wallet' };

  await updateTx(svc, logger, txId, { status: 'pending' });

  const providerPlan = plan.api_code || plan.plan_id;
  if (!providerPlan) {
    await updateTx(svc, logger, txId, { status: 'failed' });
    await issueRefund(svc, logger, txId, 'Plan has no provider api_code configured');
    return { success: false, error: 'Data plan is missing provider mapping. Refunded.', data: { txId } };
  }

  const payload = {
    network: NETWORK_CODES[net],
    mobile_number: phone.trim(),
    plan: Number(providerPlan) || providerPlan,
    Ported_number: true,
    pin: cfg.smeapiPin,
  };
  const resp = await smeapiCall(cfg, logger, '/data/', payload);

  await updateTx(svc, logger, txId, {
    provider_response: resp.body ?? { networkError: resp.networkError, raw: resp.raw },
    supplier_reference: extractReference(resp.body),
  });

  if (isConfirmedSuccess(resp)) {
    await updateTx(svc, logger, txId, { status: 'success' });
    return {
      success: true,
      data: {
        txId, phone, network: net,
        dataSize: plan.data_size,
        amount: productAmount, charge: chargeAmount, total: totalAmount,
        supplier_reference: extractReference(resp.body),
        message: `✓ Data purchase successful. ${plan.data_size || ''} sent to ${phone}.`,
      },
    };
  }

  if (isConfirmedFailure(resp)) {
    const reason =
      resp.body?.message || resp.body?.error || resp.networkError ||
      `Provider rejected (HTTP ${resp.status})`;
    await updateTx(svc, logger, txId, { status: 'failed' });
    await issueRefund(svc, logger, txId, reason);
    return { success: false, error: reason, data: { txId } };
  }

  logger.log('SMEAPI_AMBIGUOUS', { txId, status: resp.status });
  await updateTx(svc, logger, txId, { status: 'pending' });
  return {
    success: false,
    error:
      'Provider response was inconclusive. Your transaction is pending review — do not retry. If not delivered within 30 minutes, it will be refunded.',
    data: { txId, pending: true },
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logger = createLogger();
  let cfg: Config;
  try {
    cfg = loadConfig();
  } catch (err) {
    logger.error('CONFIG_LOAD_FAILED', err);
    return fail('Server configuration error: ' + (err instanceof Error ? err.message : String(err)), 500);
  }

  const svc = createClient(cfg.supabaseUrl, cfg.supabaseServiceKey);

  // Auth
  let userId: string;
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) return fail('Authentication required', 401);
    const { data, error } = await svc.auth.getUser(token);
    if (error || !data?.user?.id) return fail('Invalid session', 401);
    userId = data.user.id;
  } catch (err) {
    logger.error('AUTH_ERROR', err);
    return fail('Authentication error', 401);
  }

  // Parse
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return fail('Invalid JSON in request body', 400);
  }
  const action = payload?.action;
  if (!action) return fail('Action is required (buy-airtime or buy-data)', 400);

  try {
    if (action === 'buy-airtime') {
      const { network, phone, amount } = payload;
      const result = await buyAirtime(cfg, logger, svc, userId, network, phone, amount);
      return result.success
        ? ok(result.data)
        : fail(result.error || 'Airtime purchase failed', 400, { data: result.data });
    }
    if (action === 'buy-data') {
      const { plan_id, phone } = payload;
      const result = await buyData(cfg, logger, svc, userId, plan_id, phone);
      return result.success
        ? ok(result.data)
        : fail(result.error || 'Data purchase failed', 400, { data: result.data });
    }
    return fail('Unknown action. Use buy-airtime or buy-data', 400);
  } catch (err) {
    logger.error('UNHANDLED', err);
    return fail('An unexpected error occurred. Please try again later.', 500);
  }
});
