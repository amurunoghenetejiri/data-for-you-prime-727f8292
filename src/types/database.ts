// Database schema types for Lovable Cloud
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          full_name?: string;
          avatar_id?: string;
          avatar_url?: string;
          phone?: string;
          bio?: string;
          country?: string;
          status: 'active' | 'suspended' | 'blocked' | 'banned' | 'pending';
          is_verified: boolean;
          is_admin: boolean;
          admin_role?: 'super_admin' | 'admin' | 'moderator';
          balance: number;
          total_deposits: number;
          total_withdrawals: number;
          referral_code?: string;
          referred_by?: string;
          created_at: string;
          updated_at: string;
          last_login?: string;
          deleted_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };
      payment_methods: {
        Row: {
          id: string;
          provider: 'paystack' | 'monnify' | 'manual_bank_transfer';
          name: string;
          display_name: string;
          description?: string;
          enabled: boolean;
          order: number;
          details: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_methods']['Row']>;
      };
      payment_configurations: {
        Row: {
          id: string;
          provider: 'paystack' | 'monnify' | 'manual_bank_transfer';
          config: Record<string, any>;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_configurations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_configurations']['Row']>;
      };
      payment_uploads: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          payment_method: string;
          image_url: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          notes?: string;
          admin_notes?: string;
          approved_by?: string;
          approved_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_uploads']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_uploads']['Row']>;
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          description: string;
          entity_type?: string;
          entity_id?: string;
          details?: Record<string, any>;
          ip_address?: string;
          user_agent?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_logs']['Row']>;
      };
      audit_logs: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_user_id?: string;
          target_type?: string;
          target_id?: string;
          changes?: Record<string, any>;
          ip_address?: string;
          device_info?: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error';
          read: boolean;
          data?: Record<string, any>;
          created_at: string;
          read_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      avatars: {
        Row: {
          id: string;
          name: string;
          image_url: string;
          description?: string;
          is_admin_only: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['avatars']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['avatars']['Row']>;
      };
    };
  };
}
