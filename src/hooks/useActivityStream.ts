import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Activity {
  id: string;
  type: 'user_registration' | 'user_login' | 'user_logout' | 'deposit' | 'withdrawal' | 'transaction' | 'wallet_update' | 'profile_update' | 'password_change' | 'referral' | 'payment_approval' | 'payment_rejection' | 'account_suspension' | 'account_deletion' | 'image_upload' | 'complaint_submitted' | 'kyc_submission' | 'fund_request';
  title: string;
  description: string;
  user_id?: string;
  username?: string;
  email?: string;
  amount?: number;
  status?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  icon?: string;
  color?: 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'blue';
}

export function useActivityStream(maxItems: number = 100) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<any>(null);

  // Fetch initial activities
  const fetchInitialActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        type: item.activity_type,
        title: item.title,
        description: item.description,
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        amount: item.amount,
        status: item.status,
        metadata: item.metadata,
        timestamp: item.created_at,
        icon: item.icon,
        color: item.color,
      }));

      setActivities(formatted);
    } catch (err) {
      console.error('Error fetching initial activities:', err);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  // Subscribe to real-time updates
  useEffect(() => {
    fetchInitialActivities();

    // Subscribe to new activities via Supabase realtime
    const channel = supabase
      .channel('admin_activity_log_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_activity_log',
        },
        (payload) => {
          const newActivity: Activity = {
            id: payload.new.id,
            type: payload.new.activity_type,
            title: payload.new.title,
            description: payload.new.description,
            user_id: payload.new.user_id,
            username: payload.new.username,
            email: payload.new.email,
            amount: payload.new.amount,
            status: payload.new.status,
            metadata: payload.new.metadata,
            timestamp: payload.new.created_at,
            icon: payload.new.icon,
            color: payload.new.color,
          };

          setActivities((prev) => {
            const updated = [newActivity, ...prev];
            return updated.slice(0, maxItems);
          });

          setIsConnected(true);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialActivities, maxItems]);

  return {
    activities,
    isConnected,
    loading,
    refresh: fetchInitialActivities,
  };
}
