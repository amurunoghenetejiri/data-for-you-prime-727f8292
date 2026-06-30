import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Users as UsersIcon, Search, Shield, Ban, Trash2, Key, MoreVertical } from 'lucide-react';
import { userApi } from '@/lib/api';
import { GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira, EmptyBlock, ErrorBlock } from './_shared';
import { Link } from 'react-router-dom';

const PAGE = 20;

export default function AdminUserManagementNew() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'blocked'>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users', page, search, status],
    queryFn: async () => {
      try {
        const result = await userApi.getUsers(
          page,
          PAGE,
          search || undefined,
          status === 'all' ? undefined : status
        );
        return result;
      } catch (err) {
        console.error('Failed to load users:', err);
        throw err;
      }
    },
  });

  const handleAction = async (userId: string, action: string) => {
    setProcessing(true);
    try {
      switch (action) {
        case 'suspend':
          await userApi.suspendUser(userId);
          toast.success('User suspended');
          break;
        case 'unsuspend':
          await userApi.unsuspendUser(userId);
          toast.success('User unsuspended');
          break;
        case 'block':
          await userApi.blockUser(userId);
          toast.success('User blocked');
          break;
        case 'unblock':
          await userApi.unblockUser(userId);
          toast.success('User unblocked');
          break;
        case 'delete':
          if (confirm('This action cannot be undone. Delete this user?')) {
            await userApi.deleteUser(userId);
            toast.success('User deleted');
          }
          break;
        case 'reset-password':
          await userApi.resetUserPassword(userId);
          toast.success('Password reset email sent');
          break;
      }
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setOpenMenu(null);
    } catch (err) {
      toast.error((err as any).message || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const totalPages = data?.total ? Math.ceil(data.total / PAGE) : 1;

  return (
    <div>
      <PageHead
        title="User Management"
        subtitle="Manage user accounts, status and access"
        icon={UsersIcon}
      />

      {/* Filters */}
      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value); }}
              placeholder="Search by email, username or phone"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setPage(0); setStatus(e.target.value as any); }}
            className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </GlassCard>

      {/* Users Table */}
      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Loading users…" />
        ) : error ? (
          <ErrorBlock message={(error as any).message} onRetry={() => refetch()} />
        ) : !data?.rows?.length ? (
          <EmptyBlock icon={UsersIcon} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Username</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Phone</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Joined</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.map((user: any) => (
                  <tr key={user.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-medium">@{user.username}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-300 text-xs">{user.email}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{fmtNaira(user.balance)}</td>
                    <td className="px-4 py-3"><StatusPill status={user.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenu === user.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-white/10 rounded-lg shadow-lg z-10 overflow-hidden text-xs">
                            <Link
                              to={`/admin/users/${user.id}`}
                              className="block px-3 py-2 text-slate-300 hover:bg-white/5 text-left"
                              onClick={() => setOpenMenu(null)}
                            >
                              View Profile
                            </Link>
                            <button
                              onClick={() => handleAction(user.id, user.status === 'suspended' ? 'unsuspend' : 'suspend')}
                              disabled={processing}
                              className="w-full text-left px-3 py-2 text-slate-300 hover:bg-white/5 disabled:opacity-50"
                            >
                              {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                            </button>
                            <button
                              onClick={() => handleAction(user.id, user.status === 'blocked' ? 'unblock' : 'block')}
                              disabled={processing}
                              className="w-full text-left px-3 py-2 text-slate-300 hover:bg-white/5 disabled:opacity-50"
                            >
                              {user.status === 'blocked' ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              onClick={() => handleAction(user.id, 'reset-password')}
                              disabled={processing}
                              className="w-full text-left px-3 py-2 text-slate-300 hover:bg-white/5 disabled:opacity-50"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleAction(user.id, 'delete')}
                              disabled={processing}
                              className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Pagination */}
      {data?.rows?.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
          <p>Page {page + 1} of {totalPages} · {data?.total || 0} users</p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40 text-white text-sm"
            >
              Prev
            </button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-40 text-white text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
