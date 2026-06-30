// Payment API Service Layer
import type {
  PaymentMethod,
  PaymentConfiguration,
  PaystackConfig,
  MonnifyConfig,
  ManualBankTransferConfig,
  PaymentSettingsResponse,
  PaymentProvider,
} from '@/types/payment';

const API_BASE = '/api/payment';

/**
 * Fetch all payment methods
 */
export const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const response = await fetch(`${API_BASE}/methods`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch payment methods: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return (data.data as PaymentMethod[]) || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
};

/**
 * Fetch active payment methods for users (checkout/payment page)
 */
export const fetchActivePaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const response = await fetch(`${API_BASE}/methods/active`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch active payment methods: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return (data.data as PaymentMethod[]) || [];
  } catch (error) {
    console.error('Error fetching active payment methods:', error);
    throw error;
  }
};

/**
 * Fetch payment configurations (admin)
 */
export const fetchPaymentConfigurations = async (): Promise<PaymentConfiguration[]> => {
  try {
    const response = await fetch(`${API_BASE}/configurations`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch configurations: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return (data.data as PaymentConfiguration[]) || [];
  } catch (error) {
    console.error('Error fetching configurations:', error);
    throw error;
  }
};

/**
 * Create a new payment method
 */
export const createPaymentMethod = async (
  method: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PaymentMethod> => {
  try {
    const response = await fetch(`${API_BASE}/methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(method),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create payment method: ${error}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaymentMethod;
  } catch (error) {
    console.error('Error creating payment method:', error);
    throw error;
  }
};

/**
 * Update a payment method
 */
export const updatePaymentMethod = async (
  id: string,
  updates: Partial<Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<PaymentMethod> => {
  try {
    const response = await fetch(`${API_BASE}/methods/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update payment method: ${error}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaymentMethod;
  } catch (error) {
    console.error('Error updating payment method:', error);
    throw error;
  }
};

/**
 * Delete a payment method
 */
export const deletePaymentMethod = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/methods/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete payment method: ${error}`);
    }
  } catch (error) {
    console.error('Error deleting payment method:', error);
    throw error;
  }
};

/**
 * Reorder payment methods
 */
export const reorderPaymentMethods = async (
  ids: string[]
): Promise<PaymentMethod[]> => {
  try {
    const response = await fetch(`${API_BASE}/methods/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error(`Failed to reorder payment methods: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return (data.data as PaymentMethod[]) || [];
  } catch (error) {
    console.error('Error reordering payment methods:', error);
    throw error;
  }
};

/**
 * Save Paystack configuration
 */
export const savePaystackConfig = async (config: PaystackConfig): Promise<PaymentConfiguration> => {
  try {
    const response = await fetch(`${API_BASE}/configurations/paystack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save Paystack config: ${error}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaymentConfiguration;
  } catch (error) {
    console.error('Error saving Paystack config:', error);
    throw error;
  }
};

/**
 * Fetch Paystack configuration
 */
export const fetchPaystackConfig = async (): Promise<PaystackConfig | null> => {
  try {
    const response = await fetch(`${API_BASE}/configurations/paystack`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch Paystack config: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaystackConfig;
  } catch (error) {
    console.error('Error fetching Paystack config:', error);
    throw error;
  }
};

/**
 * Save Monnify configuration
 */
export const saveMonnifyConfig = async (config: MonnifyConfig): Promise<PaymentConfiguration> => {
  try {
    const response = await fetch(`${API_BASE}/configurations/monnify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to save Monnify config: ${error}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaymentConfiguration;
  } catch (error) {
    console.error('Error saving Monnify config:', error);
    throw error;
  }
};

/**
 * Fetch Monnify configuration
 */
export const fetchMonnifyConfig = async (): Promise<MonnifyConfig | null> => {
  try {
    const response = await fetch(`${API_BASE}/configurations/monnify`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch Monnify config: ${response.status}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as MonnifyConfig;
  } catch (error) {
    console.error('Error fetching Monnify config:', error);
    throw error;
  }
};

/**
 * Enable/Disable a payment provider
 */
export const togglePaymentProvider = async (
  provider: PaymentProvider,
  enabled: boolean
): Promise<PaymentConfiguration> => {
  try {
    const response = await fetch(`${API_BASE}/configurations/${provider}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to toggle provider: ${error}`);
    }

    const data = (await response.json()) as PaymentSettingsResponse;
    return data.data as PaymentConfiguration;
  } catch (error) {
    console.error('Error toggling payment provider:', error);
    throw error;
  }
};
