import { useState, useMemo } from 'react';
import { useActivityStream, Activity } from '@/hooks/useActivityStream';
import { ActivityFeed } from './ActivityFeed';
import { GlassCard, PageHead } from '@/pages/admin/_shared';
import { Activity as ActivityIcon, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActivityFilter = 'all' | 'users' | 'payments' | 'transactions' | 'wallet' | 'profile' | 'security';

interface ActivityStats {
  total: number;
  registrations: number;
  logins: number;
  deposits: number;
  withdrawals: number;
  approvals: number;
  rejections: number;
  suspensions: number;
}

export function AdminActivityMonitor() {
  const { activities, isConnected, loading, refresh } = useActivityStream(200);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const stats = useMemo<ActivityStats>(() => {
    return {
      total: activities.length,
      registrations: activities.filter(a => a.type === 'user_registration').length,
      logins: activities.filter(a => a.type === 'user_login').length,
      deposits: activities.filter(a => a.type === 'deposit').length,
      withdrawals: activities.filter(a => a.type === 'withdrawal').length,
      approvals: activities.filter(a => a.type === 'payment_approval').length,
      rejections: activities.filter(a => a.type === 'payment_rejection').length,
      suspensions: activities.filter(a => a.type === 'account_suspension').length,
    };
  }, [activities]);

  const filteredActivities = useMemo(() => {
    switch (filter) {
      case 'users':
        return activities.filter(a => ['user_registration', 'user_login', 'user_logout'].includes(a.type));
      case 'payments':
        return activities.filter(a => ['deposit', 'withdrawal', 'payment_approval', 'payment_rejection'].includes(a.type));
      case 'transactions':
        return activities.filter(a => ['transaction', 'wallet_update'].includes(a.type));
      case 'wallet':
        return activities.filter(a => a.type === 'wallet_update');
      case 'profile':
        return activities.filter(a => ['profile_update', 'password_change', 'image_upload'].includes(a.type));
      case 'security':
        return activities.filter(a => ['account_suspension', 'account_deletion', 'password_change'].includes(a.type));
      default:
        return activities;
    }
  }, [activities, filter]);

  return (
    <div className="space-y-6">
      <PageHead
        title="Live Activity Monitor"
        subtitle="Real-time platform activity stream"
        icon={ActivityIcon}
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Activities" value={stats.total} highlight />
        <StatCard label="New Users" value={stats.registrations} />
        <StatCard label="Active Logins" value={stats.logins} />
        <StatCard label="Deposits" value={stats.deposits} />
        <StatCard label="Withdrawals" value={stats.withdrawals} />
        <StatCard label="Approved" value={stats.approvals} accent="emerald" />
        <StatCard label="Rejected" value={stats.rejections} accent="rose" />
        <StatCard label="Suspensions" value={stats.suspensions} accent="rose" />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'users', 'payments', 'transactions', 'wallet', 'profile', 'security'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              filter === f
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border border-violet-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
            )}
          >
            <Filter className="h-3 w-3 inline mr-1" />
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      <ActivityFeed
        activities={filteredActivities}
        loading={loading}
        isConnected={isConnected}
        maxHeight="max-h-[700px]"
      />

      {/* Connection Status */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-900/40 border border-white/5">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-slate-500')} />
          <span className="text-sm text-slate-300">
            {isConnected ? (
              <>
                <span className="text-emerald-300 font-medium">Live</span> - Connected to activity stream
              </>
            ) : (
              <>
                <span className="text-amber-300 font-medium">Reconnecting</span> - Please wait...
              </>
            )}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          Showing {filteredActivities.length} of {activities.length} activities
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'violet', highlight }: { label: string; value: number; accent?: string; highlight?: boolean }) {
  const bgClass = {
    violet: 'from-violet-500/20 to-indigo-500/5 border-violet-500/30',
    emerald: 'from-emerald-500/20 to-teal-500/5 border-emerald-500/30',
    rose: 'from-rose-500/20 to-pink-500/5 border-rose-500/30',
  }[accent];

  const textClass = {
    violet: 'text-violet-300',
    emerald: 'text-emerald-300',
    rose: 'text-rose-300',
  }[accent];

  return (
    <div className={cn('rounded-xl bg-gradient-to-br p-4 border', bgClass, highlight && 'ring-2 ring-violet-500/40')}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', textClass)}>{value}</p>
    </div>
  );
}
