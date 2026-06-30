import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Receipt, Search, Filter, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { transactionApi } from '@/lib/api';
import { GlassCard, LoadingBlock, PageHead, StatusPill, fmtNaira, EmptyBlock, ErrorBlock } from './_shared';
import { supabase } from '@/integrations/supabase/client';

const PAGE = 20;

export default function AdminPaymentApprovals() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'completed' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-transactions', page, status, search],
    queryFn: async () => {
      try {
        const result = await transactionApi.getAdminTransactions(
          page,
          PAGE,
          status === 'all' ? undefined : status,
          search || undefined
        );
        return result;
      } catch (err) {
        console.error('Failed to load transactions:', err);
        throw err;
      }
    },
  });

  async function approveTransaction(id: string) {
    setProcessing(true);
    try {
      await transactionApi.approveTransaction(id);
      toast.success('Payment approved');
      qc.invalidateQueries({ queryKey: ['admin-transactions'] });
      setSelectedTx(null);
    } catch (err) {
      toast.error((err as any).message || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  }

  async function rejectTransaction(id: string) {
    if (!rejectRemarks.trim()) {
      return toast.error('Please provide rejection remarks');
    }
    setProcessing(true);
    try {
      await transactionApi.rejectTransaction(id, rejectRemarks);
      toast.success('Payment rejected');
      qc.invalidateQueries({ queryKey: ['admin-transactions'] });
      setSelectedTx(null);
      setRejectRemarks('');
    } catch (err) {
      toast.error((err as any).message || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  }

  async function completeTransaction(id: string) {
    setProcessing(true);
    try {
      await transactionApi.completeTransaction(id);
      toast.success('Transaction completed');
      qc.invalidateQueries({ queryKey: ['admin-transactions'] });
      setSelectedTx(null);
    } catch (err) {
      toast.error((err as any).message || 'Failed to complete');
    } finally {
      setProcessing(false);
    }
  }

  const totalPages = data?.total ? Math.ceil(data.total / PAGE) : 1;

  return (
    <div>
      <PageHead
        title="Payment Approvals"
        subtitle="Review and approve user payment submissions"
        icon={Receipt}
      />

      {/* Filters */}
      <GlassCard className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value); }}
              placeholder="Search by reference, user email or phone"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setPage(0); setStatus(e.target.value as any); }}
            className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </GlassCard>

      {/* Transactions Table */}
      <GlassCard className="overflow-hidden">
        {isLoading ? (
          <LoadingBlock label="Loading transactions…" />
        ) : error ? (
          <ErrorBlock message={(error as any).message} onRetry={() => refetch()} />
        ) : !data?.rows?.length ? (
          <EmptyBlock icon={Receipt} title="No transactions found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">User</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-mono text-xs">{tx.reference}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-300 text-xs">
                      {tx.user?.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-semibold">{fmtNaira(tx.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-300 text-xs">{tx.method}</td>
                    <td className="px-4 py-3"><StatusPill status={tx.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold flex items-center gap-1 ml-auto"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
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
          <p>Page {page + 1} of {totalPages} · {data?.total || 0} transactions</p>
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

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 grid place-items-center p-4 overflow-y-auto">
          <GlassCard className="w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Transaction Details</h2>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Reference</p>
                  <p className="text-white font-mono mt-1">{selectedTx.reference}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Amount</p>
                  <p className="text-white font-semibold mt-1">{fmtNaira(selectedTx.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">User</p>
                  <p className="text-white mt-1">{selectedTx.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Method</p>
                  <p className="text-white capitalize mt-1">{selectedTx.method}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Status</p>
                  <p className="mt-1"><StatusPill status={selectedTx.status} /></p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-white mt-1">{new Date(selectedTx.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedTx.receiptUrl && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Receipt</p>
                  <img src={selectedTx.receiptUrl} alt="Receipt" className="w-full max-w-sm rounded-lg border border-white/10" />
                </div>
              )}

              {selectedTx.adminRemarks && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Admin Remarks</p>
                  <p className="text-white bg-slate-800/40 p-3 rounded-lg text-sm">{selectedTx.adminRemarks}</p>
                </div>
              )}
            </div>

            {selectedTx.status === 'pending' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wider mb-2">Remarks</label>
                  <textarea
                    value={rejectRemarks}
                    onChange={(e) => setRejectRemarks(e.target.value)}
                    placeholder="Optional remarks for rejection"
                    className="w-full p-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => approveTransaction(selectedTx.id)}
                    disabled={processing}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle className="h-4 w-4" /> Approve
                  </button>
                  <button
                    onClick={() => rejectTransaction(selectedTx.id)}
                    disabled={processing}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            )}

            {selectedTx.status === 'approved' && (
              <button
                onClick={() => completeTransaction(selectedTx.id)}
                disabled={processing}
                className="w-full px-4 py-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle className="h-4 w-4" /> Mark as Completed
              </button>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
