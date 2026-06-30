import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Loader2, Check, X, Clock, Search, Filter, Download,
  ArrowUpRight, ArrowDownLeft, Eye, EyeOff
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { GlassCard, LoadingBlock, PageHead, logAdminAction } from "./_shared";

export default function AdminTransactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "successful" | "failed" | "rejected">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "paystack" | "manual_bank_transfer">("all");
  const [sortBy, setSortBy] = useState<"recent" | "amount">("recent");

  return (
    <div>
      <PageHead
        title="Real-time Transactions"
        subtitle="Monitor all user transactions in real-time"
        icon={Activity}
      />

      <div className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by user, email, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm placeholder-slate-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
            className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          >
            <option value="all">All Methods</option>
            <option value="paystack">Paystack</option>
            <option value="manual_bank_transfer">Manual Bank Transfer</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-10 px-3 rounded-lg bg-slate-800/60 border border-white/10 text-white text-sm"
          >
            <option value="recent">Most Recent</option>
            <option value="amount">Highest Amount</option>
          </select>
        </div>

        {/* Transactions Table */}
        <TransactionsTable
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          filterMethod={filterMethod}
          sortBy={sortBy}
        />
      </div>
    </div>
  );
}

function TransactionsTable({
  searchTerm,
  filterStatus,
  filterMethod,
  sortBy,
}: {
  searchTerm: string;
  filterStatus: "all" | "pending" | "successful" | "failed" | "rejected";
  filterMethod: "all" | "paystack" | "manual_bank_transfer";
  sortBy: "recent" | "amount";
}) {
  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ["admin", "transactions", filterStatus, filterMethod],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select(
          `
          id,
          user_id,
          transaction_id,
          reference_number,
          payment_method,
          service_type,
          amount,
          status,
          paystack_ref,
          notes,
          created_at,
          updated_at,
          users:user_id (
            id,
            email,
            full_name
          ),
          manual_transfer_approvals (
            id,
            status,
            reason,
            admin_id
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterMethod !== "all") {
        query = query.eq("payment_method", filterMethod);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5000,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  // Filter and sort
  const filtered = useMemo(() => {
    let result = transactions || [];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t: any) =>
          t.transaction_id?.toLowerCase().includes(term) ||
          t.reference_number?.toLowerCase().includes(term) ||
          t.users?.email?.toLowerCase().includes(term) ||
          t.users?.full_name?.toLowerCase().includes(term)
      );
    }

    if (sortBy === "amount") {
      result = [...result].sort((a: any, b: any) => b.amount - a.amount);
    }

    return result;
  }, [transactions, searchTerm, sortBy]);

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">User</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Transaction ID</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Method</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Service</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Amount</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Time</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center py-8 text-slate-400">
                No transactions found
              </td>
            </tr>
          ) : (
            filtered.map((transaction: any) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onUpdate={() => refetch()}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TransactionRow({
  transaction,
  onUpdate,
}: {
  transaction: any;
  onUpdate: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    successful: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    rejected: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };

  return (
    <>
      <tr className="border-b border-white/10 hover:bg-white/5 transition">
        <td className="py-3 px-4">
          <div>
            <p className="text-sm font-medium text-white">{transaction.users?.full_name || "Unknown"}</p>
            <p className="text-xs text-slate-400">{transaction.users?.email}</p>
          </div>
        </td>
        <td className="py-3 px-4">
          <p className="text-sm font-mono text-slate-300">{transaction.transaction_id.slice(0, 12)}</p>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs font-medium text-slate-300">
            {transaction.payment_method === "paystack" ? "Paystack" : "Bank Transfer"}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs font-medium text-slate-300 capitalize">
            {transaction.service_type.replace(/_/g, " ")}
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <p className="text-sm font-semibold text-white">₦{Number(transaction.amount).toLocaleString()}</p>
        </td>
        <td className="py-3 px-4">
          <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-semibold border ${statusColors[transaction.status] || statusColors.pending}`}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </span>
        </td>
        <td className="py-3 px-4">
          <p className="text-xs text-slate-400">{new Date(transaction.created_at).toLocaleString()}</p>
        </td>
        <td className="py-3 px-4 text-right">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </td>
      </tr>

      {showDetails && (
        <tr className="bg-slate-900/40">
          <td colSpan={8} className="py-4 px-4">
            <TransactionDetails
              transaction={transaction}
              onUpdate={onUpdate}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function TransactionDetails({
  transaction,
  onUpdate,
}: {
  transaction: any;
  onUpdate: () => void;
}) {
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const approval = transaction.manual_transfer_approvals?.[0];

  async function handleApprove() {
    setApproveLoading(true);
    try {
      // Update transaction status
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "successful", updated_at: new Date().toISOString() })
        .eq("id", transaction.id);

      if (txError) throw txError;

      // Create/update approval
      if (approval) {
        await supabase
          .from("manual_transfer_approvals")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("id", approval.id);
      } else {
        await supabase.from("manual_transfer_approvals").insert({
          transaction_id: transaction.id,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          status: "approved",
          approved_at: new Date().toISOString(),
        });
      }

      await logAdminAction(supabase, "approve_manual_transfer", "transaction", transaction.id, {
        amount: transaction.amount,
        user_id: transaction.user_id,
      });

      toast.success("Transaction approved - wallet will be credited");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleReject() {
    setRejectLoading(true);
    try {
      const { error: txError } = await supabase
        .from("transactions")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", transaction.id);

      if (txError) throw txError;

      if (approval) {
        await supabase
          .from("manual_transfer_approvals")
          .update({ status: "rejected" })
          .eq("id", approval.id);
      } else {
        await supabase.from("manual_transfer_approvals").insert({
          transaction_id: transaction.id,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          status: "rejected",
        });
      }

      await logAdminAction(supabase, "reject_manual_transfer", "transaction", transaction.id, {
        amount: transaction.amount,
        user_id: transaction.user_id,
      });

      toast.success("Transaction rejected");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setRejectLoading(false);
    }
  }

  const isPending = transaction.status === "pending" && transaction.payment_method === "manual_bank_transfer";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Transaction ID</p>
          <p className="text-sm font-mono text-white break-all">{transaction.transaction_id}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Reference</p>
          <p className="text-sm font-mono text-white">{transaction.reference_number || "-"}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">User ID</p>
          <p className="text-sm font-mono text-white">{transaction.user_id.slice(0, 8)}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-slate-400 mb-1">Paystack Ref</p>
          <p className="text-sm font-mono text-white">{transaction.paystack_ref || "-"}</p>
        </div>
      </div>

      {transaction.notes && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <p className="text-xs text-blue-400 font-medium mb-1">Notes</p>
          <p className="text-sm text-blue-300">{transaction.notes}</p>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleApprove}
            disabled={approveLoading}
            className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition"
          >
            {approveLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Check className="h-4 w-4" />
            Approve & Credit Wallet
          </button>
          <button
            onClick={handleReject}
            disabled={rejectLoading}
            className="flex-1 h-10 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition"
          >
            {rejectLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <X className="h-4 w-4" />
            Reject
          </button>
        </div>
      )}

      {!isPending && approval && (
        <div className={`p-3 rounded-lg border ${
          approval.status === "approved"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-rose-500/10 border-rose-500/30"
        }`}>
          <p className={`text-sm font-medium ${
            approval.status === "approved" ? "text-emerald-300" : "text-rose-300"
          }`}>
            {approval.status === "approved" ? "✓ Approved" : "✗ Rejected"}
            {approval.reason && ` - ${approval.reason}`}
          </p>
        </div>
      )}
    </div>
  );
}
