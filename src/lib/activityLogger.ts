import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 
  | 'user_registration' 
  | 'user_login' 
  | 'user_logout' 
  | 'deposit' 
  | 'withdrawal' 
  | 'transaction' 
  | 'wallet_update' 
  | 'profile_update' 
  | 'password_change' 
  | 'referral' 
  | 'payment_approval' 
  | 'payment_rejection' 
  | 'account_suspension' 
  | 'account_deletion' 
  | 'image_upload' 
  | 'complaint_submitted' 
  | 'kyc_submission' 
  | 'fund_request';

export interface LogActivityInput {
  type: ActivityType;
  title: string;
  description: string;
  user_id?: string;
  username?: string;
  email?: string;
  amount?: number;
  status?: string;
  metadata?: Record<string, any>;
  icon?: string;
  color?: 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'blue';
}

const activityConfig: Record<ActivityType, { title: string; icon: string; color: any }> = {
  user_registration: { title: 'New Registration', icon: '👤', color: 'emerald' },
  user_login: { title: 'User Login', icon: '🔓', color: 'cyan' },
  user_logout: { title: 'User Logout', icon: '🔐', color: 'slate' },
  deposit: { title: 'Deposit Submitted', icon: '💰', color: 'emerald' },
  withdrawal: { title: 'Withdrawal Request', icon: '💸', color: 'amber' },
  transaction: { title: 'Transaction', icon: '📊', color: 'violet' },
  wallet_update: { title: 'Wallet Updated', icon: '💳', color: 'cyan' },
  profile_update: { title: 'Profile Updated', icon: '✏️', color: 'blue' },
  password_change: { title: 'Password Changed', icon: '🔑', color: 'rose' },
  referral: { title: 'Referral Earned', icon: '🎁', color: 'violet' },
  payment_approval: { title: 'Payment Approved', icon: '✅', color: 'emerald' },
  payment_rejection: { title: 'Payment Rejected', icon: '❌', color: 'rose' },
  account_suspension: { title: 'Account Suspended', icon: '⛔', color: 'rose' },
  account_deletion: { title: 'Account Deleted', icon: '🗑️', color: 'rose' },
  image_upload: { title: 'Image Uploaded', icon: '📸', color: 'blue' },
  complaint_submitted: { title: 'Complaint Submitted', icon: '📢', color: 'amber' },
  kyc_submission: { title: 'KYC Submitted', icon: '🪪', color: 'violet' },
  fund_request: { title: 'Funding Request', icon: '💵', color: 'amber' },
};

export async function logActivity(input: LogActivityInput) {
  try {
    const config = activityConfig[input.type] || {};
    const { data: { session } } = await supabase.auth.getSession();

    const activity = {
      activity_type: input.type,
      title: input.title || config.title,
      description: input.description,
      user_id: input.user_id,
      username: input.username,
      email: input.email,
      amount: input.amount || null,
      status: input.status || null,
      metadata: input.metadata || {},
      icon: input.icon || config.icon,
      color: input.color || config.color,
      admin_id: session?.user?.id || null,
      ip_address: await getClientIpAddress(),
      user_agent: navigator.userAgent,
    };

    const { error } = await supabase
      .from('admin_activity_log')
      .insert(activity as any);

    if (error) {
      console.error('Failed to log activity:', error);
    }

    return !error;
  } catch (err) {
    console.error('Error in logActivity:', err);
    return false;
  }
}

export async function getClientIpAddress(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

export async function logUserRegistration(userId: string, email: string, username: string) {
  return logActivity({
    type: 'user_registration',
    description: `New user registered: ${email}`,
    user_id: userId,
    email,
    username,
  });
}

export async function logUserLogin(userId: string, email: string, username: string) {
  return logActivity({
    type: 'user_login',
    description: `User logged in: ${email}`,
    user_id: userId,
    email,
    username,
  });
}

export async function logUserLogout(userId: string, email: string, username: string) {
  return logActivity({
    type: 'user_logout',
    description: `User logged out: ${email}`,
    user_id: userId,
    email,
    username,
  });
}

export async function logDeposit(userId: string, email: string, username: string, amount: number, method: string) {
  return logActivity({
    type: 'deposit',
    description: `Deposit submitted: ${amount} via ${method}`,
    user_id: userId,
    email,
    username,
    amount,
    status: 'pending',
    metadata: { method },
  });
}

export async function logWithdrawal(userId: string, email: string, username: string, amount: number, account: string) {
  return logActivity({
    type: 'withdrawal',
    description: `Withdrawal request: ${amount} to ${account}`,
    user_id: userId,
    email,
    username,
    amount,
    status: 'pending',
    metadata: { account },
  });
}

export async function logTransaction(userId: string, email: string, username: string, amount: number, type: string, reference: string) {
  return logActivity({
    type: 'transaction',
    description: `${type} transaction: ${amount}`,
    user_id: userId,
    email,
    username,
    amount,
    metadata: { type, reference },
  });
}

export async function logWalletUpdate(userId: string, email: string, username: string, amount: number, action: string) {
  return logActivity({
    type: 'wallet_update',
    description: `Wallet ${action}: ${amount}`,
    user_id: userId,
    email,
    username,
    amount,
    metadata: { action },
  });
}

export async function logProfileUpdate(userId: string, email: string, username: string, fields: string[]) {
  return logActivity({
    type: 'profile_update',
    description: `Profile updated: ${fields.join(', ')}`,
    user_id: userId,
    email,
    username,
    metadata: { fields },
  });
}

export async function logPasswordChange(userId: string, email: string, username: string) {
  return logActivity({
    type: 'password_change',
    description: `Password changed for ${email}`,
    user_id: userId,
    email,
    username,
  });
}

export async function logReferral(userId: string, email: string, username: string, referredCount: number) {
  return logActivity({
    type: 'referral',
    description: `Referral completed. Total referrals: ${referredCount}`,
    user_id: userId,
    email,
    username,
    metadata: { referredCount },
  });
}

export async function logPaymentApproval(userId: string, email: string, username: string, amount: number, reference: string) {
  return logActivity({
    type: 'payment_approval',
    description: `Payment approved: ${amount}`,
    user_id: userId,
    email,
    username,
    amount,
    status: 'approved',
    metadata: { reference },
  });
}

export async function logPaymentRejection(userId: string, email: string, username: string, amount: number, reason: string) {
  return logActivity({
    type: 'payment_rejection',
    description: `Payment rejected: ${amount}. Reason: ${reason}`,
    user_id: userId,
    email,
    username,
    amount,
    status: 'rejected',
    metadata: { reason },
  });
}

export async function logAccountSuspension(userId: string, email: string, username: string, reason: string) {
  return logActivity({
    type: 'account_suspension',
    description: `Account suspended: ${reason}`,
    user_id: userId,
    email,
    username,
    status: 'suspended',
    metadata: { reason },
  });
}

export async function logAccountDeletion(userId: string, email: string, username: string) {
  return logActivity({
    type: 'account_deletion',
    description: `Account deleted: ${email}`,
    user_id: userId,
    email,
    username,
    status: 'deleted',
  });
}

export async function logImageUpload(userId: string, email: string, username: string, filename: string, size: number) {
  return logActivity({
    type: 'image_upload',
    description: `Image uploaded: ${filename}`,
    user_id: userId,
    email,
    username,
    metadata: { filename, size },
  });
}

export async function logComplaint(userId: string, email: string, username: string, subject: string) {
  return logActivity({
    type: 'complaint_submitted',
    description: `Complaint submitted: ${subject}`,
    user_id: userId,
    email,
    username,
    metadata: { subject },
  });
}

export async function logKycSubmission(userId: string, email: string, username: string, status: string) {
  return logActivity({
    type: 'kyc_submission',
    description: `KYC submission: ${status}`,
    user_id: userId,
    email,
    username,
    status,
  });
}

export async function logFundRequest(userId: string, email: string, username: string, amount: number, bank: string) {
  return logActivity({
    type: 'fund_request',
    description: `Funding request: ${amount} via ${bank}`,
    user_id: userId,
    email,
    username,
    amount,
    status: 'pending',
    metadata: { bank },
  });
}
