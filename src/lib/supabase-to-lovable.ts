// Migration layer: Wraps Lovable API in Supabase-like interface
// This allows existing code to work with minimal changes

import { paymentApi, transactionApi, userApi, messagingApi, notificationApi, activityApi } from './api';
import { supabase } from '@/integrations/supabase/client';

// Keep existing Supabase for auth & realtime, use new API for data operations
export { supabase };

// Export API modules for use in new pages
export { paymentApi, transactionApi, userApi, messagingApi, notificationApi, activityApi };
