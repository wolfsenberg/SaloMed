'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, ExternalLink, Receipt, RefreshCw } from 'lucide-react';

import { loadTxs, Transaction } from '@/lib/transactions';
import { getAddressHistory } from '@/lib/runtime';
import { fmtAsset, fmtPhp } from '@/lib/format';
import { explorerTxUrl, networkBadgeLabel } from '@/lib/stellar-links';


interface Props {
  address: string | null;
  phpRate: number;
}

export default function TransactionsTab({ address, phpRate: _phpRate }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshVersion = useRef(0);

  async function refresh() {
    if (!address) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    // Primary source: the backend index keyed by Stellar address, so history
    // follows the WALLET across devices. Each row keeps its real tx hash for
    // Stellar Explorer verification. Falls back to the local record offline.
    let rows: Transaction[] = [];
    try {
      const remote = await getAddressHistory(address);
      rows = remote.map(r => ({
        id: r.id,
        type: (r.type as Transaction['type']) ?? 'topup',
        timestamp: r.created_at * 1000,
        amountXlm: Number(r.amount_asset),
        amountPhp: Number(r.amount_php),
        direction: (r.direction as Transaction['direction']) ?? undefined,
        counterpartyLabel: r.counterparty ?? undefined,
        txHash: r.tx_hash ?? undefined,
        status: (r.status as Transaction['status']) ?? 'success',
      }) as unknown as Transaction);
    } catch {
      rows = [];
    }
    if (rows.length === 0) {
      rows = loadTxs(address); // offline fallback
    }
    if (version === refreshVersion.current) {
      setTransactions(rows);
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshVersion.current += 1;
    setTransactions([]);
    refresh();
    const listener = () => refresh();
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
          <p className="text-xs text-slate-400 mt-0.5">On-chain activity · Stellar {networkBadgeLabel()}</p>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!loading && transactions.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <Receipt size={30} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No vault transactions yet.</p>
          <p className="text-xs text-slate-400 mt-1">Top up your vault to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.map(transaction => {
          const received = transaction.direction === 'received' || transaction.type === 'topup';
          const Icon = received ? ArrowDownLeft : ArrowUpRight;
          const label = transaction.providerName
            || transaction.recipientLabel
            || transaction.senderLabel
            || (transaction.type === 'topup' ? 'Vault top-up' : transaction.status);
          const explorer = transaction.txHash ? explorerTxUrl(transaction.txHash) : '';
          return (
            <div key={transaction.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-3 items-center shadow-card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${received ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800 capitalize">{transaction.type}</p>
                  <p className={`text-sm font-bold ${received ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {received ? '+' : '−'}₱{fmtPhp(transaction.amountPhp)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="truncate">{label}</span>
                  <span className="flex items-center gap-1 shrink-0"><Clock size={10} />{new Date(transaction.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                    Stellar {networkBadgeLabel()}
                  </span>
                  {explorer && (
                    <a
                      href={explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink size={10} /> Verify on Stellar
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">≈ {fmtAsset(transaction.amountXlm)} XLM</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
