-- Database Functions for VTU Purchase System

-- ============================================
-- 1. Initialize Wallet for User
-- ============================================
CREATE OR REPLACE FUNCTION public.init_user_wallet(_user_id UUID)
RETURNS UUID AS $$
DECLARE
  _wallet_id UUID;
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO _wallet_id;
  
  IF _wallet_id IS NULL THEN
    SELECT id INTO _wallet_id FROM public.wallets WHERE user_id = _user_id;
  END IF;
  
  RETURN _wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Apply Transaction Charge
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_charge(
  _service TEXT,
  _amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  _charge DECIMAL;
BEGIN
  -- Fixed ₦1 charge for all transactions
  _charge := 1.00;
  
  RAISE LOG '[CHARGE] Service: %, Amount: %, Charge: %', _service, _amount, _charge;
  
  RETURN _charge;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Debit Wallet with Atomic Transaction
-- ============================================
CREATE OR REPLACE FUNCTION public.debit_wallet(
  _user_id UUID,
  _amount DECIMAL,
  _type TEXT,
  _description TEXT,
  _meta JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  product_amount DECIMAL,
  charge_amount DECIMAL,
  total_amount DECIMAL,
  wallet_debit_confirmed BOOLEAN
) AS $$
DECLARE
  _wallet_id UUID;
  _current_balance DECIMAL;
  _product_amount DECIMAL;
  _charge_amount DECIMAL;
  _total_amount DECIMAL;
  _tx_id UUID;
BEGIN
  -- Extract product and charge amounts from metadata
  _product_amount := COALESCE((_meta->>'product_amount')::DECIMAL, _amount);
  _charge_amount := COALESCE((_meta->>'charge_amount')::DECIMAL, 0);
  _total_amount := _product_amount + _charge_amount;
  
  -- Initialize wallet if needed
  _wallet_id := public.init_user_wallet(_user_id);
  
  -- Get current balance
  SELECT balance INTO _current_balance FROM public.wallets WHERE user_id = _user_id;
  
  IF _current_balance IS NULL THEN
    _current_balance := 0;
  END IF;
  
  -- Check sufficient balance
  IF _current_balance < _total_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Required: %.2f, Available: %.2f', _total_amount, _current_balance;
  END IF;
  
  -- Create transaction record (ATOMIC)
  INSERT INTO public.transactions (
    user_id,
    type,
    status,
    product_amount,
    charge_amount,
    total_amount,
    description,
    meta,
    wallet_debit_confirmed,
    provider_success_confirmed,
    refund_issued
  ) VALUES (
    _user_id,
    _type,
    'processing',
    _product_amount,
    _charge_amount,
    _total_amount,
    _description,
    _meta,
    FALSE,
    FALSE,
    FALSE
  ) RETURNING transactions.id INTO _tx_id;
  
  -- Debit wallet
  UPDATE public.wallets
  SET balance = balance - _total_amount,
      updated_at = NOW()
  WHERE user_id = _user_id;
  
  -- Mark wallet debit as confirmed in transaction
  UPDATE public.transactions
  SET wallet_debit_confirmed = TRUE,
      updated_at = NOW()
  WHERE id = _tx_id;
  
  RAISE LOG '[DEBIT] User: %, Amount: %.2f (Product: %.2f + Charge: %.2f), Tx: %', 
    _user_id, _total_amount, _product_amount, _charge_amount, _tx_id;
  
  RETURN QUERY SELECT
    _tx_id,
    _user_id,
    _type,
    _product_amount,
    _charge_amount,
    _total_amount,
    TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Complete Transaction (Mark as Success)
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_transaction(
  _tx_id UUID,
  _supplier_reference TEXT DEFAULT NULL,
  _provider_response JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  total_amount DECIMAL
) AS $$
DECLARE
  _wallet_debit_confirmed BOOLEAN;
BEGIN
  -- Verify wallet was debited
  SELECT wallet_debit_confirmed INTO _wallet_debit_confirmed
  FROM public.transactions WHERE id = _tx_id;
  
  IF NOT _wallet_debit_confirmed THEN
    RAISE EXCEPTION 'Cannot complete transaction: wallet debit not confirmed for Tx: %', _tx_id;
  END IF;
  
  -- Mark as success only after provider confirms
  UPDATE public.transactions
  SET 
    status = 'success',
    provider_success_confirmed = TRUE,
    supplier_reference = COALESCE(_supplier_reference, supplier_reference),
    provider_response = COALESCE(_provider_response, provider_response),
    updated_at = NOW()
  WHERE id = _tx_id;
  
  RAISE LOG '[COMPLETE] Transaction % marked as SUCCESS', _tx_id;
  
  RETURN QUERY SELECT
    id,
    status,
    total_amount
  FROM public.transactions WHERE id = _tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Refund Transaction (Only when provider fails)
-- ============================================
CREATE OR REPLACE FUNCTION public.refund_transaction(
  _tx_id UUID,
  _reason TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  refunded_amount DECIMAL,
  new_balance DECIMAL
) AS $$
DECLARE
  _tx_record RECORD;
  _refund_id UUID;
  _new_balance DECIMAL;
BEGIN
  -- Get transaction details
  SELECT * INTO _tx_record FROM public.transactions WHERE id = _tx_id;
  
  IF _tx_record IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', _tx_id;
  END IF;
  
  -- Prevent duplicate refunds
  IF _tx_record.refund_issued THEN
    RAISE EXCEPTION 'Transaction already refunded: %', _tx_id;
  END IF;
  
  -- Prevent refunding successful transactions
  IF _tx_record.status = 'success' THEN
    RAISE EXCEPTION 'Cannot refund successful transaction: %', _tx_id;
  END IF;
  
  -- Refund exact amount: product_amount + charge_amount
  UPDATE public.wallets
  SET balance = balance + _tx_record.total_amount,
      updated_at = NOW()
  WHERE user_id = _tx_record.user_id
  RETURNING balance INTO _new_balance;
  
  -- Create refund log
  INSERT INTO public.refund_logs (
    transaction_id,
    user_id,
    reason,
    amount,
    status
  ) VALUES (
    _tx_id,
    _tx_record.user_id,
    _reason,
    _tx_record.total_amount,
    'completed'
  ) RETURNING id INTO _refund_id;
  
  -- Mark transaction as refunded
  UPDATE public.transactions
  SET 
    status = 'refunded',
    refund_issued = TRUE,
    error_message = _reason,
    updated_at = NOW()
  WHERE id = _tx_id;
  
  RAISE LOG '[REFUND] Transaction: %, Amount: %.2f (Product: %.2f + Charge: %.2f), Reason: %, New Balance: %.2f',
    _tx_id, _tx_record.total_amount, _tx_record.product_amount, _tx_record.charge_amount, _reason, _new_balance;
  
  RETURN QUERY SELECT
    _tx_id,
    'refunded'::TEXT,
    _tx_record.total_amount,
    _new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Log API Request/Response
-- ============================================
CREATE OR REPLACE FUNCTION public.log_api_call(
  _tx_id UUID,
  _user_id UUID,
  _provider TEXT,
  _endpoint TEXT,
  _method TEXT,
  _request_body JSONB,
  _response_status INTEGER,
  _response_body JSONB,
  _error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.api_logs (
    transaction_id,
    user_id,
    provider,
    endpoint,
    method,
    request_body,
    response_status,
    response_body,
    error_message
  ) VALUES (
    _tx_id,
    _user_id,
    _provider,
    _endpoint,
    _method,
    _request_body,
    _response_status,
    _response_body,
    _error_message
  ) RETURNING id INTO _log_id;
  
  RAISE LOG '[API-LOG] Provider: %, Endpoint: %, Status: %, TxID: %', 
    _provider, _endpoint, _response_status, _tx_id;
  
  RETURN _log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Get User Wallet Balance
-- ============================================
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  _balance DECIMAL;
BEGIN
  SELECT balance INTO _balance FROM public.wallets WHERE user_id = _user_id;
  RETURN COALESCE(_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Get Transaction History
-- ============================================
CREATE OR REPLACE FUNCTION public.get_transaction_history(
  _user_id UUID,
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  status TEXT,
  product_amount DECIMAL,
  charge_amount DECIMAL,
  total_amount DECIMAL,
  phone_number TEXT,
  network TEXT,
  data_size TEXT,
  supplier_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.type,
    t.status,
    t.product_amount,
    t.charge_amount,
    t.total_amount,
    t.phone_number,
    t.network,
    t.data_size,
    t.supplier_reference,
    t.created_at
  FROM public.transactions t
  WHERE t.user_id = _user_id
  ORDER BY t.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Verify Transaction State
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_transaction_state(_tx_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  wallet_debited BOOLEAN,
  provider_confirmed BOOLEAN,
  refund_issued BOOLEAN,
  total_amount DECIMAL,
  phone_number TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.status,
    t.wallet_debit_confirmed,
    t.provider_success_confirmed,
    t.refund_issued,
    t.total_amount,
    t.phone_number
  FROM public.transactions t
  WHERE t.id = _tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. Mark Transaction Failed (Before Completion)
-- ============================================
CREATE OR REPLACE FUNCTION public.fail_transaction(
  _tx_id UUID,
  _error_message TEXT,
  _provider_response JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  error_message TEXT
) AS $$
DECLARE
  _tx_record RECORD;
BEGIN
  -- Get transaction
  SELECT * INTO _tx_record FROM public.transactions WHERE id = _tx_id;
  
  IF _tx_record IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', _tx_id;
  END IF;
  
  -- Only mark as failed if not already processed
  IF _tx_record.provider_success_confirmed OR _tx_record.refund_issued THEN
    RAISE EXCEPTION 'Cannot fail already processed transaction: %', _tx_id;
  END IF;
  
  -- Update transaction
  UPDATE public.transactions
  SET 
    status = 'failed',
    error_message = _error_message,
    provider_response = COALESCE(_provider_response, provider_response),
    updated_at = NOW()
  WHERE id = _tx_id;
  
  -- Refund the transaction
  PERFORM public.refund_transaction(_tx_id, _error_message);
  
  RAISE LOG '[FAIL] Transaction: %, Error: %', _tx_id, _error_message;
  
  RETURN QUERY SELECT
    _tx_id,
    'failed'::TEXT,
    _error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
