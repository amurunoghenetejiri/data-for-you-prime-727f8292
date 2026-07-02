-- Migration: add activity, transactions, receipts, notifications, messages, admin_audit, message_deliveries
-- Run on DATA4ME Postgres. Review before running; BACKUP first.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  username text,
  full_name text,
  email text,
  activity_type text NOT NULL,
  description text,
  transaction_id uuid,
  payment_method text,
  amount numeric(14,2),
  previous_status text,
  current_status text,
  ip_address text,
  device_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  service text,
  network text,
  product text,
  amount numeric(14,2) NOT NULL,
  payment_method text,
  receipt_image text,
  payment_reference text,
  status text NOT NULL DEFAULT 'pending',
  admin_id uuid,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_reference ON transactions(payment_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trg_set_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_timestamp_on_transactions ON transactions;
CREATE TRIGGER set_timestamp_on_transactions
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp();

-- receipts
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid,
  uploader_id uuid,
  amount numeric(14,2),
  payment_method text,
  image_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_id uuid,
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_uploader_id ON receipts(uploader_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  type text NOT NULL,
  title text,
  body text,
  metadata jsonb,
  related_transaction uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid,
  recipient_id uuid,
  is_broadcast boolean NOT NULL DEFAULT false,
  title text,
  body text,
  metadata jsonb,
  delivery_status jsonb,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- message_deliveries
CREATE TABLE IF NOT EXISTS message_deliveries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msg_del_user ON message_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_msg_del_message ON message_deliveries(message_id);

-- admin_audit (immutable)
CREATE TABLE IF NOT EXISTS admin_audit (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL,
  action_type text NOT NULL,
  description text,
  target_user_id uuid,
  related_transaction uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit(created_at DESC);

CREATE OR REPLACE FUNCTION admin_audit_prevent_delete_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit rows are immutable and cannot be deleted or modified';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_audit_mods ON admin_audit;
CREATE TRIGGER trg_prevent_admin_audit_mods
BEFORE UPDATE OR DELETE ON admin_audit
FOR EACH ROW EXECUTE FUNCTION admin_audit_prevent_delete_update();

-- helper functions
CREATE OR REPLACE FUNCTION insert_activity_and_notify(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_email text,
  p_activity_type text,
  p_description text,
  p_transaction_id uuid,
  p_payment_method text,
  p_amount numeric,
  p_previous_status text,
  p_current_status text,
  p_ip text,
  p_device jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  new_id uuid;
  payload jsonb;
BEGIN
  INSERT INTO activity_logs(
    user_id, username, full_name, email, activity_type,
    description, transaction_id, payment_method, amount,
    previous_status, current_status, ip_address, device_info, created_at
  )
  VALUES (
    p_user_id, p_username, p_full_name, p_email, p_activity_type,
    p_description, p_transaction_id, p_payment_method, p_amount,
    p_previous_status, p_current_status, p_ip, p_device, now()
  ) RETURNING id INTO new_id;

  payload := jsonb_build_object(
    'type','activity',
    'activity_id', new_id,
    'user_id', p_user_id,
    'activity_type', p_activity_type,
    'description', p_description,
    'transaction_id', p_transaction_id,
    'created_at', now()
  );

  PERFORM pg_notify('admin_activity_channel', payload::text);
END;
$$;

-- transactions triggers
CREATE OR REPLACE FUNCTION trg_transactions_log_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  payload jsonb;
BEGIN
  INSERT INTO activity_logs(
    user_id, activity_type, description, transaction_id,
    payment_method, amount, previous_status, current_status, created_at
  ) VALUES (
    NEW.user_id, 'transaction_created', 'Transaction created', NEW.id,
    NEW.payment_method, NEW.amount, NULL, NEW.status, now()
  );

  payload := jsonb_build_object(
    'type','transaction',
    'action','created',
    'transaction_id', NEW.id,
    'user_id', NEW.user_id,
    'status', NEW.status,
    'amount', NEW.amount,
    'created_at', now()
  );
  PERFORM pg_notify('transaction_channel', payload::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_txn_after_insert ON transactions;
CREATE TRIGGER trg_txn_after_insert
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_transactions_log_notify();

CREATE OR REPLACE FUNCTION trg_transactions_status_update_notify()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  payload jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO activity_logs(
      user_id, activity_type, description, transaction_id,
      payment_method, amount, previous_status, current_status, created_at
    ) VALUES (
      NEW.user_id, 'transaction_status_changed',
      'Transaction status changed from ' || COALESCE(OLD.status,'<nil>') || ' to ' || COALESCE(NEW.status,'<nil>'),
      NEW.id, NEW.payment_method, NEW.amount, OLD.status, NEW.status, now()
    );

    payload := jsonb_build_object(
      'type','transaction',
      'action','status_changed',
      'transaction_id', NEW.id,
      'user_id', NEW.user_id,
      'previous_status', OLD.status,
      'new_status', NEW.status,
      'updated_at', now()
    );

    PERFORM pg_notify('transaction_channel', payload::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_txn_after_update_status ON transactions;
CREATE TRIGGER trg_txn_after_update_status
AFTER UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION trg_transactions_status_update_notify();

-- receipts trigger
CREATE OR REPLACE FUNCTION trg_receipt_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  txn_id uuid;
  payload jsonb;
BEGIN
  IF NEW.transaction_id IS NULL THEN
    INSERT INTO transactions(
      user_id, service, network, product, amount, payment_method, receipt_image, payment_reference, status, created_at, updated_at
    ) VALUES (
      NEW.uploader_id, 'wallet_funding', NULL, NULL, NEW.amount, NEW.payment_method, NEW.image_url, NULL, 'pending', now(), now()
    ) RETURNING id INTO txn_id;

    UPDATE receipts SET transaction_id = txn_id WHERE id = NEW.id;
  ELSE
    txn_id := NEW.transaction_id;
  END IF;

  INSERT INTO activity_logs(
    user_id, activity_type, description, transaction_id, payment_method, amount, current_status, created_at
  ) VALUES (
    NEW.uploader_id, 'receipt_uploaded', 'Receipt uploaded', txn_id, NEW.payment_method, NEW.amount, NEW.status, now()
  );

  payload := jsonb_build_object(
    'type','receipt',
    'action','uploaded',
    'receipt_id', NEW.id,
    'transaction_id', txn_id,
    'uploader_id', NEW.uploader_id,
    'amount', NEW.amount,
    'payment_method', NEW.payment_method,
    'created_at', now()
  );

  PERFORM pg_notify('receipt_channel', payload::text);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_after_insert ON receipts;
CREATE TRIGGER trg_receipt_after_insert
AFTER INSERT ON receipts
FOR EACH ROW EXECUTE FUNCTION trg_receipt_after_insert();

-- admin audit helper
CREATE OR REPLACE FUNCTION insert_admin_audit(
  p_admin_id uuid,
  p_action_type text,
  p_description text,
  p_target_user uuid,
  p_related_txn uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  audit_id uuid;
  payload jsonb;
BEGIN
  INSERT INTO admin_audit(
    admin_id, action_type, description, target_user_id, related_transaction, metadata, created_at
  ) VALUES (
    p_admin_id, p_action_type, p_description, p_target_user, p_related_txn, p_metadata, now()
  ) RETURNING id INTO audit_id;

  payload := jsonb_build_object(
    'type','admin_audit',
    'audit_id', audit_id,
    'admin_id', p_admin_id,
    'action_type', p_action_type,
    'description', p_description,
    'created_at', now()
  );

  PERFORM pg_notify('admin_audit_channel', payload::text);
END;
$$;

-- notification helper
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_metadata jsonb,
  p_related_transaction uuid
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  nid uuid;
  payload jsonb;
BEGIN
  INSERT INTO notifications(user_id, type, title, body, metadata, related_transaction, created_at)
  VALUES (p_user_id, p_type, p_title, p_body, p_metadata, p_related_transaction, now())
  RETURNING id INTO nid;

  payload := jsonb_build_object(
    'type','notification',
    'notification_id', nid,
    'user_id', p_user_id,
    'notification_type', p_type,
    'title', p_title,
    'body', p_body,
    'related_transaction', p_related_transaction,
    'created_at', now()
  );

  IF p_user_id IS NULL THEN
    PERFORM pg_notify('broadcast_channel', payload::text);
  ELSE
    PERFORM pg_notify('user_notification_channel_' || p_user_id::text, payload::text);
    PERFORM pg_notify('user_notification_channel', payload::text);
  END IF;
END;
$$;
