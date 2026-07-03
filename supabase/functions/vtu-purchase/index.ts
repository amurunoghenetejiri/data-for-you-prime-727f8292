// DATA4ME — COMPLETE FIXED VTU Purchase System
// This version resolves ALL issues preventing SMEAPI flow

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

// ============================================
// CONSTANTS
// ============================================

const SMEAPI_KEY = '65AC10epAx6cC3C3bAC8Gg9BBAboa9t7i2Aqx2z5EAFBwxkCm1BIfydl483v1782217262';
const SMEAPI_BASE_URL = 'https://api.smeapi.net';
const TRANSACTION_CHARGE = 1;

// ============================================
// LOGGING
// ============================================

function log(label: string, data: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [VTU-PURCHASE] ${label}:`, JSON.stringify(data, null, 2));
}

// ============================================
// SMEAPI REQUEST (FIXED)
// ============================================

async function smeapiRequest(
  path: string,
  method: string,
  body: any,
  txId: string,
  userId: string,
  svc: any
): Promise<{ ok: boolean; status: number; body: any }> {
  const url = `${SMEAPI_BASE_URL}${path}`;

  log('SMEAPI_REQUEST_INIT', {
    path,
    method,
    url,
    bodyKeys: Object.keys(body || {}),
    hasApiKey: !!SMEAPI_KEY,
  });

  try {
    const requestOptions: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMEAPI_KEY}`,
        'x-api-key': SMEAPI_KEY,
      },
    };

    if (method === 'POST' && body) {
      requestOptions.body = JSON.stringify(body);
    }

    log('SMEAPI_FETCH_START', {
      url,
      headers: requestOptions.headers,
      bodyString: requestOptions.body,
    });

    const response = await fetch(url, requestOptions);
    const responseText = await response.text();

    let responseBody: any;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = { raw: responseText, parseError: String(e) };
    }

    log('SMEAPI_RESPONSE_RAW', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    });

    // Log to database for debugging
    await svc.rpc('log_api_call', {
      _tx_id: txId,
      _user_id: userId,
      _provider: 'smeapi',
      _endpoint: path,
      _method: method,
      _request_body: body,
      _response_status: response.status,
      _response_body: responseBody,
    }).catch((err: any) => log('DB_LOG_FAILED', err));

    return {
      ok: response.ok && response.status >= 200 && response.status < 300,
      status: response.status,
      body: responseBody,
    };
  } catch (err) {
    log('SMEAPI_FETCH_ERROR', {
      url,
      error: String(err),
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      stack: err instanceof Error ? err.stack : 'N/A',
    });

    await svc.rpc('log_api_call', {
      _tx_id: txId,
      _user_id: userId,
      _provider: 'smeapi',
      _endpoint: path,
      _method: method,
      _request_body: body,
      _response_status: 0,
      _response_body: null,
      _error_message: String(err),
    }).catch(() => {});

    throw err;
  }
}

// ============================================
// SUCCESS CHECK (FIXED)
// ============================================

function isSMEAPISuccess(response: any): boolean {
  if (!response) {
    log('SUCCESS_CHECK_NO_RESPONSE', { response });
    return false;
  }

  const status = String(
    response.Status || 
    response.status || 
    response.response_code || 
    response.Status_code ||
    response.statusCode ||
    ''
  ).toLowerCase().trim();

  log('SUCCESS_CHECK_STATUS', {
    rawStatus: response.Status || response.status || response.response_code,
    normalizedStatus: status,
    allKeys: Object.keys(response),
  });

  // Check for success indicators
  const isSuccess = 
    status === 'successful' ||
    status === 'success' ||
    status === 'completed' ||
    status === '200' ||
    status === '000' ||
    response.success === true ||
    response.successful === true ||
    (response.Status === 200) ||
    (response.status === 200) ||
    response.message?.toLowerCase().includes('successful') ||
    response.message?.toLowerCase().includes('completed');

  log('SUCCESS_CHECK_RESULT', {
    isSuccess,
    status,
    fullResponse: response,
  });

  return isSuccess;
}

// ============================================
// BUY AIRTIME (COMPLETELY FIXED)
// ============================================

async function buyAirtime(
  svc: any,
  userId: string,
  network: string,
  phone: string,
  amount: number
): Promise<any> {
  log('AIRTIME_START', { userId, network, phone, amount });

  try {
    // Validate
    if (!network || !phone || !amount) {
      log('AIRTIME_VALIDATION_FAILED', { network, phone, amount });
      return { success: false, error: 'Missing required fields: network, phone, amount' };
    }

    if (!/^0[789][01]\d{8}$/.test(phone)) {
      log('AIRTIME_PHONE_INVALID', { phone });
      return { success: false, error: 'Invalid Nigerian phone number format' };
    }

    const productAmount = Number(amount);
    if (productAmount < 50) {
      log('AIRTIME_AMOUNT_TOO_LOW', { productAmount });
      return { success: false, error: 'Minimum airtime is ₦50' };
    }

    const chargeAmount = TRANSACTION_CHARGE;
    const totalAmount = productAmount + chargeAmount;

    log('AIRTIME_AMOUNTS', { productAmount, chargeAmount, totalAmount });

    // STEP 1: Debit wallet
    let txId: string | null = null;
    
    const { data: debitResult, error: debitErr } = await svc.rpc('debit_wallet', {
      _user_id: userId,
      _amount: totalAmount,
      _type: 'airtime',
      _description: `${network} airtime ₦${productAmount} to ${phone}`,
      _meta: {
        product_amount: productAmount,
        charge_amount: chargeAmount,
        network,
        phone,
      },
    });

    if (debitErr) {
      log('AIRTIME_DEBIT_ERROR', { debitErr });
      return { success: false, error: debitErr.message || 'Failed to debit wallet' };
    }

    if (!debitResult || debitResult.length === 0) {
      log('AIRTIME_DEBIT_EMPTY', {});
      return { success: false, error: 'Failed to create transaction' };
    }

    txId = debitResult[0]?.id;
    log('AIRTIME_WALLET_DEBITED', { txId, totalAmount });

    // STEP 2: Call SMEAPI
    const smeapiPayload = {
      network: network.toUpperCase(),
      amount: productAmount,
      mobile_number: phone,
      Ported_number: true,
      airtime_type: 'VTU',
      pin: '',
    };

    log('AIRTIME_CALLING_SMEAPI', { txId, payload: smeapiPayload });

    let smeapiResp: any;
    try {
      smeapiResp = await smeapiRequest('/airtime', 'POST', smeapiPayload, txId, userId, svc);
      log('AIRTIME_SMEAPI_RESPONSE', { txId, response: smeapiResp });
    } catch (err) {
      log('AIRTIME_SMEAPI_EXCEPTION', { txId, error: String(err) });
      
      // Refund on SMEAPI error
      await svc.rpc('refund_transaction', {
        _tx_id: txId,
        _reason: `SMEAPI connection error: ${String(err)}`,
      }).catch(() => {});

      return {
        success: false,
        error: `SMEAPI error: ${String(err)}`,
        txId,
      };
    }

    // STEP 3: Check success
    const smeapiSuccess = isSMEAPISuccess(smeapiResp.body);
    log('AIRTIME_SUCCESS_CHECK', { txId, smeapiSuccess, response: smeapiResp.body });

    // STEP 4: Update transaction with provider response
    await svc.from('transactions')
      .update({
        provider_response: smeapiResp.body,
        supplier_reference: smeapiResp.body?.reference || smeapiResp.body?.ident || smeapiResp.body?.transaction_id,
      })
      .eq('id', txId)
      .catch((err: any) => log('UPDATE_RESPONSE_ERROR', err));

    // STEP 5: Handle result
    if (!smeapiSuccess) {
      log('AIRTIME_SMEAPI_FAILED', { txId, response: smeapiResp.body });

      // Refund on SMEAPI failure
      await svc.rpc('refund_transaction', {
        _tx_id: txId,
        _reason: smeapiResp.body?.message || smeapiResp.body?.error || 'SMEAPI failed',
      }).catch((err: any) => log('REFUND_ERROR', err));

      return {
        success: false,
        error: smeapiResp.body?.message || smeapiResp.body?.error || 'Airtime purchase failed',
        txId,
      };
    }

    // STEP 6: Mark as success
    await svc.rpc('complete_transaction', {
      _tx_id: txId,
      _supplier_reference: smeapiResp.body?.reference || smeapiResp.body?.ident,
      _provider_response: smeapiResp.body,
    }).catch((err: any) => log('COMPLETE_ERROR', err));

    log('AIRTIME_SUCCESS', { txId, network, phone, amount: productAmount });

    return {
      success: true,
      txId,
      phone,
      network,
      amount: productAmount,
      charge: chargeAmount,
      total: totalAmount,
      message: `Airtime processed successfully. ₦${productAmount} + ₦${chargeAmount} charge = ₦${totalAmount} deducted.`,
    };
  } catch (err) {
    log('AIRTIME_UNHANDLED_ERROR', { error: String(err), stack: err instanceof Error ? err.stack : 'N/A' });
    return { success: false, error: String(err) };
  }
}

// ============================================
// BUY DATA (COMPLETELY FIXED)
// ============================================

async function buyData(
  svc: any,
  userId: string,
  planId: string,
  phone: string
): Promise<any> {
  log('DATA_START', { userId, planId, phone });

  try {
    // Validate
    if (!planId || !phone) {
      log('DATA_VALIDATION_FAILED', { planId, phone });
      return { success: false, error: 'Missing required fields: plan_id, phone' };
    }

    if (!/^0[789][01]\d{8}$/.test(phone)) {
      log('DATA_PHONE_INVALID', { phone });
      return { success: false, error: 'Invalid Nigerian phone number format' };
    }

    // STEP 1: Get plan
    const { data: plan, error: planErr } = await svc
      .from('data_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle();

    if (planErr || !plan) {
      log('DATA_PLAN_NOT_FOUND', { planId, planErr });
      return { success: false, error: 'Data plan not found' };
    }

    log('DATA_PLAN_FOUND', { planId, network: plan.network, dataSize: plan.data_size, price: plan.selling_price });

    const productAmount = Number(plan.selling_price || 0);
    const chargeAmount = TRANSACTION_CHARGE;
    const totalAmount = productAmount + chargeAmount;

    log('DATA_AMOUNTS', { productAmount, chargeAmount, totalAmount });

    // STEP 2: Debit wallet
    let txId: string | null = null;

    const { data: debitResult, error: debitErr } = await svc.rpc('debit_wallet', {
      _user_id: userId,
      _amount: totalAmount,
      _type: 'data',
      _description: `${plan.network} ${plan.data_size} data to ${phone}`,
      _meta: {
        product_amount: productAmount,
        charge_amount: chargeAmount,
        plan_id: planId,
        network: plan.network,
        phone,
      },
    });

    if (debitErr) {
      log('DATA_DEBIT_ERROR', { debitErr });
      return { success: false, error: debitErr.message || 'Failed to debit wallet' };
    }

    if (!debitResult || debitResult.length === 0) {
      log('DATA_DEBIT_EMPTY', {});
      return { success: false, error: 'Failed to create transaction' };
    }

    txId = debitResult[0]?.id;
    log('DATA_WALLET_DEBITED', { txId, totalAmount });

    // STEP 3: Call SMEAPI
    const smeapiPayload = {
      network: plan.network.toUpperCase(),
      mobile_number: phone,
      plan: plan.api_code || plan.plan_id,
      Ported_number: true,
      pin: '',
    };

    log('DATA_CALLING_SMEAPI', { txId, payload: smeapiPayload });

    let smeapiResp: any;
    try {
      smeapiResp = await smeapiRequest('/data', 'POST', smeapiPayload, txId, userId, svc);
      log('DATA_SMEAPI_RESPONSE', { txId, response: smeapiResp });
    } catch (err) {
      log('DATA_SMEAPI_EXCEPTION', { txId, error: String(err) });

      await svc.rpc('refund_transaction', {
        _tx_id: txId,
        _reason: `SMEAPI connection error: ${String(err)}`,
      }).catch(() => {});

      return {
        success: false,
        error: `SMEAPI error: ${String(err)}`,
        txId,
      };
    }

    // STEP 4: Check success
    const smeapiSuccess = isSMEAPISuccess(smeapiResp.body);
    log('DATA_SUCCESS_CHECK', { txId, smeapiSuccess, response: smeapiResp.body });

    // STEP 5: Update transaction
    await svc.from('transactions')
      .update({
        provider_response: smeapiResp.body,
        supplier_reference: smeapiResp.body?.reference || smeapiResp.body?.ident || smeapiResp.body?.transaction_id,
      })
      .eq('id', txId)
      .catch((err: any) => log('UPDATE_RESPONSE_ERROR', err));

    // STEP 6: Handle result
    if (!smeapiSuccess) {
      log('DATA_SMEAPI_FAILED', { txId, response: smeapiResp.body });

      await svc.rpc('refund_transaction', {
        _tx_id: txId,
        _reason: smeapiResp.body?.message || smeapiResp.body?.error || 'SMEAPI failed',
      }).catch((err: any) => log('REFUND_ERROR', err));

      return {
        success: false,
        error: smeapiResp.body?.message || smeapiResp.body?.error || 'Data purchase failed',
        txId,
      };
    }

    // STEP 7: Mark as success
    await svc.rpc('complete_transaction', {
      _tx_id: txId,
      _supplier_reference: smeapiResp.body?.reference || smeapiResp.body?.ident,
      _provider_response: smeapiResp.body,
    }).catch((err: any) => log('COMPLETE_ERROR', err));

    log('DATA_SUCCESS', { txId, network: plan.network, dataSize: plan.data_size, phone });

    return {
      success: true,
      txId,
      phone,
      network: plan.network,
      data: plan.data_size,
      charge: chargeAmount,
      total: totalAmount,
      message: `Data processed successfully. ₦${productAmount} + ₦${chargeAmount} charge = ₦${totalAmount} deducted.`,
    };
  } catch (err) {
    log('DATA_UNHANDLED_ERROR', { error: String(err), stack: err instanceof Error ? err.stack : 'N/A' });
    return { success: false, error: String(err) };
  }
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      log('MISSING_ENV', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return json({ error: 'Server configuration error' }, 500);
    }

    const svc = createClient(supabaseUrl, supabaseKey);

    // Authenticate
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const { data: authData, error: authErr } = await svc.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      log('AUTH_FAILED', { authErr });
      return json({ error: 'Invalid session' }, 401);
    }

    const userId = authData.user.id;
    log('USER_AUTHENTICATED', { userId });

    // Parse request
    const payload = await req.json().catch(() => ({}));
    const action = payload?.action;

    log('REQUEST', { action, payload });

    if (action === 'buy-airtime') {
      const result = await buyAirtime(svc, userId, payload.network, payload.phone, payload.amount);
      return json(result, result.success ? 200 : 400);
    }

    if (action === 'buy-data') {
      const result = await buyData(svc, userId, payload.plan_id, payload.phone);
      return json(result, result.success ? 200 : 400);
    }

    return json({ error: 'Unknown action. Use buy-airtime or buy-data' }, 400);
  } catch (err) {
    log('FATAL_ERROR', { error: String(err) });
    return json({ error: 'Server error' }, 500);
  }
});
