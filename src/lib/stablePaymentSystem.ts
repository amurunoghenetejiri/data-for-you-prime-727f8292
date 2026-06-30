import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stable Payment System - Configuration & Helper Functions
 * Paystack + Manual Bank Transfer Only
 */

export interface PaystackConfig {
  id: string;
  mode: "test" | "live";
  test_public_key?: string;
  test_secret_key?: string;
  live_public_key?: string;
  live_secret_key?: string;
  updated_at: string;
}

export interface ManualBankTransfer {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  instructions?: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  transaction_id: string;
  reference_number?: string;
  payment_method: "paystack" | "manual_bank_transfer";
  service_type: string;
  amount: number;
  status: "pending" | "successful" | "failed" | "rejected";
  paystack_ref?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get Paystack configuration
 */
export async function getPaystackConfig(supabase: SupabaseClient): Promise<PaystackConfig | null> {
  try {
    const { data, error } = await supabase
      .from("paystack_config")
      .select("*")
      .single();

    if (error) {
      console.error("Failed to get paystack config:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching paystack config:", err);
    return null;
  }
}

/**
 * Get Paystack public key (safe for frontend)
 */
export async function getPaystackPublicKey(supabase: SupabaseClient): Promise<string> {
  const config = await getPaystackConfig(supabase);
  if (!config) return "";

  const mode = config.mode || "test";
  const keyField = `${mode}_public_key`;
  return config[keyField as keyof PaystackConfig] as string || "";
}

/**
 * Get manual bank transfer configuration
 */
export async function getManualBankTransfer(supabase: SupabaseClient): Promise<ManualBankTransfer | null> {
  try {
    const { data, error } = await supabase
      .from("manual_bank_transfer")
      .select("*")
      .single();

    if (error) {
      console.error("Failed to get manual bank transfer config:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching manual bank transfer config:", err);
    return null;
  }
}

/**
 * Create a transaction record
 */
export async function createTransaction(
  supabase: SupabaseClient,
  transaction: Omit<Transaction, "id" | "created_at" | "updated_at">
): Promise<Transaction | null> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        ...transaction,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create transaction:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error creating transaction:", err);
    return null;
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  supabase: SupabaseClient,
  transactionId: string,
  status: "pending" | "successful" | "failed" | "rejected",
  notes?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("transactions")
      .update({
        status,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) {
      console.error("Failed to update transaction:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error updating transaction:", err);
    return false;
  }
}

/**
 * Get user transactions
 */
export async function getUserTransactions(
  supabase: SupabaseClient,
  userId: string,
  limit = 50
): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to get user transactions:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error fetching user transactions:", err);
    return [];
  }
}

/**
 * Get transaction by ID
 */
export async function getTransaction(
  supabase: SupabaseClient,
  transactionId: string
): Promise<Transaction | null> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (error) {
      console.error("Failed to get transaction:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching transaction:", err);
    return null;
  }
}

/**
 * Validate Paystack configuration
 */
export async function validatePaystackConfig(supabase: SupabaseClient): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const config = await getPaystackConfig(supabase);
  const errors: string[] = [];

  if (!config) {
    errors.push("Paystack config not found");
    return { valid: false, errors };
  }

  const mode = config.mode || "test";
  const publicKeyField = `${mode}_public_key`;
  const secretKeyField = `${mode}_secret_key`;

  const publicKey = config[publicKeyField as keyof PaystackConfig];
  const secretKey = config[secretKeyField as keyof PaystackConfig];

  if (!publicKey) {
    errors.push(`${mode} public key is not configured`);
  }

  if (!secretKey) {
    errors.push(`${mode} secret key is not configured`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate manual bank transfer configuration
 */
export async function validateManualBankTransfer(supabase: SupabaseClient): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const config = await getManualBankTransfer(supabase);
  const errors: string[] = [];

  if (!config) {
    errors.push("Manual bank transfer config not found");
    return { valid: false, errors };
  }

  if (!config.bank_name?.trim()) {
    errors.push("Bank name is not configured");
  }

  if (!config.account_name?.trim()) {
    errors.push("Account name is not configured");
  }

  if (!config.account_number?.trim()) {
    errors.push("Account number is not configured");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get available payment methods for checkout
 */
export async function getCheckoutPaymentMethods(
  supabase: SupabaseClient
): Promise<{
  paystack: boolean;
  manual_bank_transfer: boolean;
}> {
  try {
    const [paystackConfig, manualConfig] = await Promise.all([
      getPaystackConfig(supabase),
      getManualBankTransfer(supabase),
    ]);

    const paystackValid = await validatePaystackConfig(supabase);
    const manualValid = await validateManualBankTransfer(supabase);

    return {
      paystack: paystackValid.valid,
      manual_bank_transfer: manualValid.valid,
    };
  } catch (err) {
    console.error("Error getting checkout payment methods:", err);
    return {
      paystack: false,
      manual_bank_transfer: false,
    };
  }
}

/**
 * Create manual transfer approval
 */
export async function createManualApproval(
  supabase: SupabaseClient,
  transactionId: string,
  adminId: string,
  status: "approved" | "rejected",
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("manual_transfer_approvals")
      .insert({
        transaction_id: transactionId,
        admin_id: adminId,
        status,
        reason,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      });

    if (error) {
      console.error("Failed to create approval:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error creating approval:", err);
    return false;
  }
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(): string {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Generate reference number (for bank transfers)
 */
export function generateReferenceNumber(userId: string): string {
  return `REF_${userId.slice(0, 8).toUpperCase()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}
