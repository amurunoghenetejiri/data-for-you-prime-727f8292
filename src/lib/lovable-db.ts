/**
 * Lovable Cloud Database Connection & Utilities
 * Handles all Supabase/Lovable Cloud database operations
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Real-time Database Subscription Manager
 */
export const subscribeToPaymentUploads = (callback: (data: any) => void) => {
  return supabase
    .channel('payment_uploads_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payment_uploads',
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
};

export const subscribeToUserUpdates = (userId: string, callback: (data: any) => void) => {
  return supabase
    .channel(`user_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
};

export const subscribeToNotifications = (userId: string, callback: (data: any) => void) => {
  return supabase
    .channel(`notifications_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
};

export const subscribeToActivityLogs = (callback: (data: any) => void) => {
  return supabase
    .channel('activity_logs_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();
};

/**
 * Payment Upload Operations
 */
export const paymentUploadsDb = {
  async create(data: {
    user_id: string;
    amount: number;
    payment_method: string;
    image_url: string;
    notes?: string;
  }) {
    const { data: result, error } = await supabase
      .from('payment_uploads')
      .insert([
        {
          user_id: data.user_id,
          amount: data.amount,
          payment_method: data.payment_method,
          image_url: data.image_url,
          notes: data.notes,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('payment_uploads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getByUserId(userId: string, status?: string) {
    let query = supabase
      .from('payment_uploads')
      .select('*')
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAll(filters?: { status?: string; limit?: number; offset?: number }) {
    let query = supabase.from('payment_uploads').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: 'pending' | 'approved' | 'rejected' | 'cancelled', adminNotes?: string) {
    const { data, error } = await supabase
      .from('payment_uploads')
      .update({
        status,
        admin_notes: adminNotes,
        approved_by: (await supabase.auth.getSession()).data.session?.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addAdminNotes(id: string, notes: string) {
    const { data, error } = await supabase
      .from('payment_uploads')
      .update({ admin_notes: notes })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/**
 * User Operations
 */
export const usersDb = {
  async getById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getAll(filters?: { status?: string; limit?: number; offset?: number; search?: string }) {
    let query = supabase.from('users').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`email.ilike.%${filters.search}%,username.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async updateStatus(userId: string, status: 'active' | 'suspended' | 'blocked' | 'banned' | 'pending') {
    const { data, error } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateBalance(userId: string, amount: number) {
    const user = await this.getById(userId);
    const newBalance = (user.balance || 0) + amount;

    const { data, error } = await supabase
      .from('users')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async incrementDeposits(userId: string, amount: number) {
    const user = await this.getById(userId);
    const newTotal = (user.total_deposits || 0) + amount;

    const { data, error } = await supabase
      .from('users')
      .update({ total_deposits: newTotal, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async promoteToAdmin(userId: string, role: 'admin' | 'moderator' | 'super_admin') {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true, admin_role: role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async demoteFromAdmin(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: false, admin_role: undefined, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/**
 * Notifications
 */
export const notificationsDb = {
  async create(data: {
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    data?: Record<string, any>;
  }) {
    const { data: result, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: data.user_id,
          title: data.title,
          message: data.message,
          type: data.type,
          data: data.data,
          read: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getByUserId(userId: string, unreadOnly?: boolean) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/**
 * Activity Logs
 */
export const activityLogsDb = {
  async create(data: {
    user_id: string;
    action_type: string;
    description: string;
    entity_type?: string;
    entity_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
  }) {
    const { data: result, error } = await supabase
      .from('activity_logs')
      .insert([
        {
          user_id: data.user_id,
          action_type: data.action_type,
          description: data.description,
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          details: data.details,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getRecent(limit: number = 100) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },
};

/**
 * Audit Logs
 */
export const auditLogsDb = {
  async create(data: {
    admin_id: string;
    action: string;
    target_user_id?: string;
    target_type?: string;
    target_id?: string;
    changes?: Record<string, any>;
    ip_address?: string;
    device_info?: string;
  }) {
    const { data: result, error } = await supabase
      .from('audit_logs')
      .insert([
        {
          admin_id: data.admin_id,
          action: data.action,
          target_user_id: data.target_user_id,
          target_type: data.target_type,
          target_id: data.target_id,
          changes: data.changes,
          ip_address: data.ip_address,
          device_info: data.device_info,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async getAll(filters?: { limit?: number; offset?: number }) {
    let query = supabase.from('audit_logs').select('*');

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },
};
