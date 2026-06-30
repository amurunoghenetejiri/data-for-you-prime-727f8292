import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Initialize Lovable Cloud backend client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const paymentMethodsDb = {
  /**
   * Fetch all payment methods
   */
  async getAll() {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch only active payment methods (for user checkout)
   */
  async getActive() {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('enabled', true)
      .order('order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch a single payment method by ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new payment method
   */
  async create(method: any) {
    // Check for duplicates
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('provider', method.provider)
      .eq('name', method.name)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('Payment method already exists');
    }

    // Get the next order number
    const { data: lastMethod } = await supabase
      .from('payment_methods')
      .select('order')
      .order('order', { ascending: false })
      .limit(1);

    const nextOrder = (lastMethod?.[0]?.order ?? 0) + 1;

    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{ ...method, order: nextOrder }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a payment method
   */
  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a payment method
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Reorder payment methods
   */
  async reorder(ids: string[]) {
    const updates = ids.map((id, index) => ({
      id,
      order: index + 1,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('payment_methods')
        .update({ order: update.order })
        .eq('id', update.id);

      if (error) throw error;
    }

    return this.getAll();
  },
};

export const paymentConfigDb = {
  /**
   * Fetch all payment configurations
   */
  async getAll() {
    const { data, error } = await supabase
      .from('payment_configurations')
      .select('*');

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch configuration by provider
   */
  async getByProvider(provider: string) {
    const { data, error } = await supabase
      .from('payment_configurations')
      .select('*')
      .eq('provider', provider)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return data || null;
  },

  /**
   * Create or update payment configuration
   */
  async upsert(provider: string, config: any) {
    const { data, error } = await supabase
      .from('payment_configurations')
      .upsert([{ provider, config, updated_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Toggle provider enabled status
   */
  async toggleProvider(provider: string, enabled: boolean) {
    const { data, error } = await supabase
      .from('payment_configurations')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('provider', provider)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete payment configuration
   */
  async delete(provider: string) {
    const { error } = await supabase
      .from('payment_configurations')
      .delete()
      .eq('provider', provider);

    if (error) throw error;
  },
};
