'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock, ExternalLink, HandCoins, Receipt, RefreshCw, Send } from 'lucide-react';

import { loadTxs, Transaction } from '@/lib/transactions';
import { getAddressHistory } from '@/lib/runtime';
import { fmtAsset, fmtPhp } from '@/lib/format';
import { explorerTxUrl } from '@/lib/stellar-links';
import { topUpMethodLabel } from '@/lib/topup-label';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface Props {
  address: string | null;
}

const activityStyle = {
  topup: {
    labelKey: 'history_tx_topup',
    Icon: ArrowDownLeft,
    icon: 'bg-emerald-50 text-emerald-600',
    amount: 'text-emerald-600',
    link: 'text-emerald-700 hover:text-emerald-800',
  },
  payment: {
    labelKey: 'history_tx_payment',
    Icon: ArrowUpRight,
    icon: 'bg-blue-50 text-blue-600',
    amount: 'text-blue-600',
    link: 'text-blue-600 hover:text-blue-800',
  },
  padala: {
    labelKey: 'history_tx_padala',
    Icon: Send,
    icon: 'bg-violet-50 text-violet-600',
    amount: 'text-violet-700',
    link: 'text-violet-700 hover:text-violet-800',
  },
  padalaReceived: {
    labelKey: 'history_tx_padala',
    Icon: ArrowDownLeft,
    icon: 'bg-indigo-50 text-indigo-600',
    amount: 'text-indigo-700',
    link: 'text-indigo-700 hover:text-indigo-800',
  },
  loan: {
    labelKey: 'history_tx_salo',
    Icon: HandCoins,
    icon: 'bg-amber-50 text-amber-600',
    amount: 'text-amber-700',
    link: 'text-amber-700 hover:text-amber-800',
  },
} as const;

function getActivityStyle(transaction: Transaction) {
  if (transaction.type === 'padala' && transaction.direction === 'received') {
    return activityStyle.padalaReceived;
  }
  return activityStyle[transaction.type] ?? activityStyle.payment;
}

function statusLabel(status: Transaction['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function shortValue(value?: string | null): string {
  if (!value) return '';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

function providerTypeLabel(type?: Transaction['providerType']): string {
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function TransactionsTab({ address }: Props) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const refreshVersion = useRef(0);

  async function refresh() {
    if (!address) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    // Primary source: the backend index keyed by Stellar address, so history
    // follows the wallet across devices. Each row keeps its real tx hash for
    // Stellar Explorer verification. Falls back to the local record offline.
    let rows: Transaction[] = [];
    const localRows = loadTxs(address);
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
        topUpSource: r.source ?? null,
      }) as unknown as Transaction);
      rows = rows.map(row => {
        const local = localRows.find(tx => tx.txHash && row.txHash && tx.txHash === row.txHash);
        if (!local) return row;
        return {
          ...row,
          gcashRef: local.gcashRef,
          gcashNumber: local.gcashNumber,
          providerName: local.providerName,
          providerAddress: local.providerAddress,
          providerType: local.providerType,
          payFrom: local.payFrom,
          recipientMethod: local.recipientMethod,
          recipientLabel: local.recipientLabel,
          senderLabel: local.senderLabel,
          ptsEarned: local.ptsEarned,
          topUpSource: local.topUpSource ?? row.topUpSource,
        };
      });
    } catch {
      rows = [];
    }
    if (rows.length === 0) {
      rows = localRows;
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

  function detailRows(transaction: Transaction): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string | undefined | null }> = [];

    if (transaction.type === 'topup') {
      rows.push({ label: t('history_method'), value: topUpMethodLabel(transaction.topUpSource) });
      rows.push({ label: t('history_credits_vault'), value: shortValue(address) });
      if (transaction.gcashNumber) rows.push({ label: t('history_gcash_number'), value: transaction.gcashNumber });
      if (transaction.gcashRef) {
        rows.push({
          label: transaction.topUpSource === 'instapay' ? t('history_pdax_reference') : t('history_reference'),
          value: transaction.gcashRef,
        });
      }
    }

    if (transaction.type === 'payment') {
      rows.push({ label: t('history_paid_to'), value: transaction.providerName || transaction.counterpartyLabel || t('history_provider_fallback') });
      rows.push({ label: t('history_provider_type'), value: providerTypeLabel(transaction.providerType) });
      rows.push({ label: t('history_provider_wallet'), value: shortValue(transaction.providerAddress) });
      rows.push({ label: t('history_paid_from'), value: transaction.payFrom === 'vault' ? t('history_health_vault') : transaction.payFrom });
      if (typeof transaction.ptsEarned === 'number') rows.push({ label: t('history_salopoints'), value: t('history_points', { points: transaction.ptsEarned }) });
    }

    if (transaction.type === 'padala') {
      rows.push({
        label: transaction.direction === 'received' ? t('history_received_from') : t('history_sent_to'),
        value: transaction.direction === 'received'
          ? transaction.senderLabel || transaction.counterpartyLabel
          : transaction.recipientLabel || transaction.counterpartyLabel,
      });
      rows.push({ label: t('history_method'), value: transaction.recipientMethod === 'stellar' ? t('history_stellar_wallet') : transaction.recipientMethod });
    }

    if (transaction.type === 'loan') {
      if (transaction.termMonths) rows.push({ label: t('history_term'), value: t('history_months', { months: transaction.termMonths }) });
      if (transaction.monthlyPhp) rows.push({ label: t('history_monthly_payment'), value: `₱${fmtPhp(transaction.monthlyPhp)}` });
      if (transaction.interestRate) rows.push({ label: t('history_interest_rate'), value: t('history_per_annum', { rate: transaction.interestRate }) });
    }

    rows.push({ label: t('history_status'), value: statusLabel(transaction.status) });
    if (transaction.txHash) rows.push({ label: t('history_tx_hash'), value: shortValue(transaction.txHash) });

    return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
  }

  if (!address) {
    return <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">{t('history_connect')}</div>;
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t('history_title')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('history_subtitle')}</p>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!loading && transactions.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <Receipt size={30} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{t('history_empty_title')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('history_empty_desc')}</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.map(transaction => {
          const received = transaction.direction === 'received' || transaction.type === 'topup';
          const style = getActivityStyle(transaction);
          const Icon = style.Icon;
          const label = transaction.providerName
            || transaction.recipientLabel
            || transaction.senderLabel
            || (transaction.type === 'topup' ? topUpMethodLabel(transaction.topUpSource) : statusLabel(transaction.status));
          const explorer = transaction.txHash ? explorerTxUrl(transaction.txHash) : '';

          return (
            <div key={transaction.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-card">
              <div className="flex gap-3 items-center">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.icon}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{t(style.labelKey as any)}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-400">{label}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {explorer && (
                      <a
                        href={explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${style.link}`}
                      >
                        <ExternalLink size={10} /> {t('history_verify')}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                    >
                      {t('history_details')}
                      <ChevronDown size={11} className={`transition-transform ${expandedId === transaction.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-bold ${style.amount}`}>
                    {received ? '+' : '-'}₱{fmtPhp(transaction.amountPhp)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">~ {fmtAsset(transaction.amountXlm)} XLM</p>
                  <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                    <Clock size={10} />{new Date(transaction.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              </div>
              {expandedId === transaction.id && (
                <div className="mt-3 border-t border-slate-100 pt-3 grid grid-cols-1 gap-2">
                  {detailRows(transaction).map(row => (
                    <div key={`${transaction.id}-${row.label}`} className="flex items-start justify-between gap-4 text-[11px]">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="max-w-[220px] text-right font-medium text-slate-600 break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
