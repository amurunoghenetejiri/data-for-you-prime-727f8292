import { SupabaseClient } from '@supabase/supabase-js';

export interface PaymentConfig {
  paystackMode: 'test' | 'live';
  paystackPublicKey: string;
  paystackSecretKey: string;
  monnifyEnabled: boolean;
  monnifyEnvironment: 'sandbox' | 'production';
  monnifyApiKey: string;
  monnifySecretKey: string;
  monnifyContractCode: string;
  manualPaymentEnabled: boolean;
}

export interface PaymentProvider {
  id: string;
  provider_name: string;
  is_enabled: boolean;
  config: Record<string, any>;
}

export interface PaystackConfig {
  id: string;
  mode: 'test' | 'live';
  test_public_key?: string;
  test_secret_key?: string;
  test_webhook_secret?: string;
  live_public_key?: string;
  live_secret_key?: string;
  live_webhook_secret?: string;
  updated_at: string;
}

export interface MonnifyConfig {
  id: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  api_key?: string;
  secret_key?: string;
  contract_code?: string;
  base_url?: string;
  updated_at: string;
}

export interface ManualPaymentMethod {
  id: string;
  display_name: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  is_enabled: boolean;
  sort_order: number;
  logo_url?: string;
  description?: string;
  payment_instructions?: string;
}

// Get active payment configuration
export async function getPaymentConfig(supabase: SupabaseClient): Promise<PaymentConfig | null> {
  try {
    const [paystackRes, monnifyRes, manualRes] = await Promise.all([
      supabase.from('paystack_config').select('*').maybeSingle(),
      supabase.from('monnify_config').select('*').maybeSingle(),
      supabase.from('payment_providers').select('*').eq('provider_name', 'manual_bank_transfer').maybeSingle(),
    ]);

    if (paystackRes.error) throw paystackRes.error;
    if (monnifyRes.error) throw monnifyRes.error;

    const paystack = paystackRes.data;
    const monnify = monnifyRes.data;
    const manual = manualRes.data;

    const mode = paystack?.mode || 'test';
    const publicKeyField = `${mode}_public_key`;
    const secretKeyField = `${mode}_secret_key`;

    return {
      paystackMode: mode,
      paystackPublicKey: paystack?.[publicKeyField] || '',
      paystackSecretKey: paystack?.[secretKeyField] || '',
      monnifyEnabled: monnify?.is_enabled || false,
      monnifyEnvironment: monnify?.environment || 'sandbox',
      monnifyApiKey: monnify?.api_key || '',
      monnifySecretKey: monnify?.secret_key || '',
      monnifyContractCode: monnify?.contract_code || '',
      manualPaymentEnabled: manual?.is_enabled || false,
    };
  } catch (error) {
    console.error('Failed to get payment config:', error);
    return null;
  }
}

// Get Paystack configuration
export async function getPaystackConfig(supabase: SupabaseClient): Promise<PaystackConfig | null> {
  try {
    const { data, error } = await supabase.from('paystack_config').select('*').maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get Paystack config:', error);
    return null;
  }
}

// Get Monnify configuration
export async function getMonnifyConfig(supabase: SupabaseClient): Promise<MonnifyConfig | null> {
  try {
    const { data, error } = await supabase.from('monnify_config').select('*').maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get Monnify config:', error);
    return null;
  }
}

// Get all enabled manual payment methods
export async function getEnabledManualPaymentMethods(
  supabase: SupabaseClient
): Promise<ManualPaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('manual_payment_methods')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get manual payment methods:', error);
    return [];
  }
}

// Get all manual payment methods (including disabled)
export async function getAllManualPaymentMethods(
  supabase: SupabaseClient
): Promise<ManualPaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('manual_payment_methods')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get all manual payment methods:', error);
    return [];
  }
}

// Get available payment providers
export async function getAvailablePaymentProviders(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('payment_providers')
      .select('provider_name')
      .eq('is_enabled', true);

    if (error) throw error;
    return data?.map((p) => p.provider_name) || [];
  } catch (error) {
    console.error('Failed to get payment providers:', error);
    return [];
  }
}

// Check if payment provider is enabled
export async function isPaymentProviderEnabled(
  supabase: SupabaseClient,
  providerName: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('payment_providers')
      .select('is_enabled')
      .eq('provider_name', providerName)
      .maybeSingle();

    if (error) throw error;
    return data?.is_enabled || false;
  } catch (error) {
    console.error(`Failed to check if ${providerName} is enabled:`, error);
    return false;
  }
}

// Get Paystack public key for frontend
export async function getPaystackPublicKey(supabase: SupabaseClient): Promise<string> {
  try {
    const config = await getPaystackConfig(supabase);
    if (!config) return '';

    const mode = config.mode || 'test';
    const keyField = `${mode}_public_key`;
    return config[keyField as keyof PaystackConfig] as string || '';
  } catch (error) {
    console.error('Failed to get Paystack public key:', error);
    return '';
  }
}

// Validate payment configuration before enabling provider
export async function validatePaymentConfig(
  supabase: SupabaseClient,
  provider: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    if (provider === 'paystack') {
      const config = await getPaystackConfig(supabase);
      if (!config) {
        errors.push('Paystack configuration not found');
        return { valid: false, errors };
      }

      const mode = config.mode || 'test';
      const publicKeyField = `${mode}_public_key`;
      const secretKeyField = `${mode}_secret_key`;

      if (!config[publicKeyField as keyof PaystackConfig]) {
        errors.push(`Paystack ${mode} public key is missing`);
      }
      if (!config[secretKeyField as keyof PaystackConfig]) {
        errors.push(`Paystack ${mode} secret key is missing`);
      }
    } else if (provider === 'monnify') {
      const config = await getMonnifyConfig(supabase);
      if (!config) {
        errors.push('Monnify configuration not found');
        return { valid: false, errors };
      }

      if (!config.api_key) {
        errors.push('Monnify API key is missing');
      }
      if (!config.secret_key) {
        errors.push('Monnify secret key is missing');
      }
      if (!config.contract_code) {
        errors.push('Monnify contract code is missing');
      }
    } else if (provider === 'manual_bank_transfer') {
      const methods = await getEnabledManualPaymentMethods(supabase);
      if (methods.length === 0) {
        errors.push('No manual payment methods enabled');
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    console.error(`Failed to validate ${provider} config:`, error);
    return { valid: false, errors: ['Validation failed: ' + (error as any).message] };
  }
}

// Get checkout payment methods (only enabled ones)
export async function getCheckoutPaymentMethods(supabase: SupabaseClient) {
  const methods: any = {
    paystack: false,
    monnify: false,
    manualMethods: [],
  };

  try {
    const [paystackEnabled, monnifyEnabled, manualMethods] = await Promise.all([
      isPaymentProviderEnabled(supabase, 'paystack'),
      isPaymentProviderEnabled(supabase, 'monnify'),
      getEnabledManualPaymentMethods(supabase),
    ]);

    methods.paystack = paystackEnabled;
    methods.monnify = monnifyEnabled;
    methods.manualMethods = manualMethods;

    return methods;
  } catch (error) {
    console.error('Failed to get checkout payment methods:', error);
    return methods;
  }
}
