import { Activity } from '@/hooks/useActivityStream';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  isConnected?: boolean;
  maxHeight?: string;
}

const activityColors: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export function ActivityFeed({ activities, loading, isConnected, maxHeight = 'max-h-[600px]' }: ActivityFeedProps) {
  return (
    <div className={cn('rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/5 shadow-xl overflow-hidden flex flex-col', maxHeight)}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-5 py-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">Live Activity</h3>
          <div className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500')} />
        </div>
        <span className="text-xs text-slate-400">{activities.length} activities</span>
      </div>

      {/* Content */}
      <div className={cn('flex-1 overflow-y-auto', maxHeight)}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm text-slate-400">No activities yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="border-t border-white/5 px-5 py-2 bg-amber-500/10 text-amber-200 text-xs">
          Reconnecting to live feed...
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const colorClass = activityColors[activity.color || 'slate'] || activityColors.slate;
  const timeAgo = getTimeAgo(new Date(activity.timestamp));

  return (
    <div className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon/Avatar */}
        <div className={cn('h-10 w-10 rounded-lg border flex items-center justify-center text-lg flex-shrink-0', colorClass)}>
          {activity.icon || '•'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-medium text-white">{activity.title}</p>
            {activity.username && (
              <p className="text-xs text-slate-400">@{activity.username}</p>
            )}
            {activity.amount && (
              <p className="text-xs font-mono text-emerald-300">₦{Number(activity.amount).toLocaleString()}</p>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1">{activity.description}</p>

          {activity.email && (
            <p className="text-xs text-slate-500 mt-1">{activity.email}</p>
          )}

          {activity.status && (
            <div className="mt-2">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border', colorClass)}>
                {activity.status}
              </span>
            </div>
          )}

          <p className="text-[10px] text-slate-500 mt-2">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return format(date, 'MMM dd, HH:mm');
}
