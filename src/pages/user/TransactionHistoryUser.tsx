import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Receipt, Search } from 'lucide-react';
import { transactionApi } from '@/lib/api';
import { useApp } from '@/context/AppContext';

const PAGE = 20;

export default function TransactionHistoryUser() {
  const { user } = useApp();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-transactions', page, search],
    queryFn: async () => {
      if (!user?.id) return { rows: [], total: 0 };
      try {
        return await transactionApi.getUserTransactions(user.id, page, PAGE);
      } catch (err) {
        console.error('Failed to load transactions:', err);
        return { rows: [], total: 0 };
      }
    },
    enabled: !!user?.id,
  });

  const totalPages = data?.total ? Math.ceil(data.total / PAGE) : 1;

  const fmtNaira = (n: number) => '₦' + (n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    };
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/5 p-6">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Receipt className="h-6 w-6 text-violet-300" />
        Transaction History
      </h2>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
            placeholder="Search transactions…"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading transactions…</div>
      ) : !data?.rows?.length ? (
        <div className="text-center py-8 text-slate-400">No transactions yet</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.rows.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white font-mono text-xs">{tx.reference}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{fmtNaira(tx.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-300 text-xs">{tx.method}</td>
                    <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.rows.length > 0 && (
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
        </>
      )}
    </div>
  );
}
