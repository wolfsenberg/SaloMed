'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, Receipt, RefreshCw } from 'lucide-react';

import { getRuntimeHistory, getRuntimeStatus, RuntimeTransaction } from '@/lib/runtime';


interface Props {
  address: string | null;
  phpRate: number;
}

type HistoryItem = {
  id: string;
  type: string;
  direction: 'sent' | 'received';
  amountAsset: number;
  amountPhp: number;
  status: string;
  counterparty?: string | null;
  createdAt: number;
  simulated: boolean;
};

function fromRuntime(transaction: RuntimeTransaction): HistoryItem {
  return {
    id: transaction.transaction_id,
    type: transaction.type,
    direction: transaction.direction,
    amountAsset: Number(transaction.amount_asset),
    amountPhp: Number(transaction.amount_php),
    status: transaction.status,
    counterparty: transaction.counterparty,
    createdAt: transaction.created_at * 1000,
    simulated: transaction.simulated,
  };
}

export default function TransactionsTab({ address, phpRate: _phpRate }: Props) {
  const [transactions, setTransactions] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refreshVersion = useRef(0);

  async function refresh() {
    if (!address) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    setError(null);
    try {
      const runtime = await getRuntimeStatus();
      const nextTransactions = (await getRuntimeHistory(address)).map(fromRuntime);
      if (version !== refreshVersion.current) return;
      setTransactions(nextTransactions);
      setSourceLabel(runtime.history_source === 'demo_ledger'
        ? 'Off-chain pilot ledger · Test funds · Not submitted to Stellar'
        : 'Recent confirmed Soroban events available from RPC');
    } catch (cause) {
      if (version !== refreshVersion.current) return;
      setError(cause instanceof Error ? cause.message : 'Unable to load transaction history.');
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    refreshVersion.current += 1;
    setTransactions([]);
    setSourceLabel('');
    void refresh();
    const listener = () => void refresh();
    window.addEventListener('salomed_tx_update', listener);
    return () => {
      refreshVersion.current += 1;
      window.removeEventListener('salomed_tx_update', listener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!address) {
    return <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">Connect your wallet to view history.</div>;
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vault Activity</h2>
          <p className="text-xs text-slate-400 mt-0.5">{sourceLabel}</p>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      {!loading && transactions.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <Receipt size={30} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No vault transactions yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.map(transaction => {
          const received = transaction.direction === 'received';
          const Icon = received ? ArrowDownLeft : ArrowUpRight;
          return (
            <div key={transaction.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-3 items-center shadow-card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${received ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800 capitalize">{transaction.type}</p>
                  <p className={`text-sm font-bold ${received ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {received ? '+' : '−'}{transaction.amountAsset.toFixed(7)} USDC
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="truncate">{transaction.counterparty || transaction.status}</span>
                  <span className="flex items-center gap-1 shrink-0"><Clock size={10} />{new Date(transaction.createdAt).toLocaleString()}</span>
                </div>
                {transaction.simulated && (
                  <span className="inline-block mt-1 text-[10px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                    Off-chain pilot ledger · Test funds
                  </span>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">≈ ₱{transaction.amountPhp.toFixed(2)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
