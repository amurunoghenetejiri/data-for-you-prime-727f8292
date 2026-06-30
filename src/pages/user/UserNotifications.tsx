import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Bell, Trash2, CheckAll } from 'lucide-react';
import { notificationApi } from '@/lib/api';
import { useApp } from '@/context/AppContext';

const PAGE = 20;

export default function UserNotifications() {
  const qc = useQueryClient();
  const { user } = useApp();
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['user-notifications', page, unreadOnly],
    queryFn: async () => {
      try {
        return await notificationApi.getUserNotifications(page, PAGE);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        return { rows: [], total: 0 };
      }
    },
    refetchInterval: 5000,
  });

  const filtered = data?.rows?.filter(n => !unreadOnly || !n.read) || [];
  const totalPages = filtered.length ? Math.ceil(filtered.length / PAGE) : 1;

  const handleMarkAsRead = async (notificationIds: string[]) => {
    try {
      await notificationApi.markNotificationsAsRead(notificationIds);
      qc.invalidateQueries({ queryKey: ['user-notifications'] });
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllNotificationsAsRead();
      qc.invalidateQueries({ queryKey: ['user-notifications'] });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getIconColor = (type: string) => {
    const colors: Record<string, string> = {
      payment: 'bg-violet-500/15 text-violet-300',
      message: 'bg-blue-500/15 text-blue-300',
      system: 'bg-slate-500/15 text-slate-300',
      broadcast: 'bg-emerald-500/15 text-emerald-300',
    };
    return colors[type] || colors.system;
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="h-6 w-6 text-violet-300" />
          Notifications
        </h2>
        <button
          onClick={handleMarkAllAsRead}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1"
        >
          <CheckAll className="h-3 w-3" /> Mark all read
        </button>
      </div>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => { setUnreadOnly(e.target.checked); setPage(0); }}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-slate-300">Unread only</span>
      </label>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading notifications…</div>
      ) : !filtered.length ? (
        <div className="text-center py-12">
          <Bell className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => (
            <div key={notif.id} className={`p-4 rounded-lg border transition-colors ${
              notif.read
                ? 'bg-slate-800/40 border-white/5 opacity-60'
                : 'bg-slate-800/60 border-white/10 hover:bg-slate-800/80'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${notif.read ? 'bg-slate-500' : 'bg-violet-500'}`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-white text-sm">{notif.title}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${getIconColor(notif.type)}`}>
                      {notif.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{notif.body}</p>
                  <p className="text-xs text-slate-500 mt-2">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
                {!notif.read && (
                  <button
                    onClick={() => handleMarkAsRead([notif.id])}
                    className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                  >
                    ✓
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
