'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, ArrowDownToLine, QrCode, Globe, HandCoins,
  Star, Building2, FlaskConical, Clock, Loader2
} from 'lucide-react';
import { fetchHorizonTxs, loadTxs, Transaction, TxType } from '@/lib/transactions';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface Props {
  address: string | null;
  phpRate: number;
}

type Filter = 'all' | TxType;

const TYPE_CFG: Record<TxType, {
  label:   string;
  Icon:    React.ElementType;
  iconBg:  string;
  iconTxt: string;
  accent:  string;
}> = {
  topup:   { label: 'Top-up',  Icon: ArrowDownToLine, iconBg: 'bg-emerald-100', iconTxt: 'text-emerald-600', accent: 'bg-emerald-400' },
  payment: { label: 'Payment', Icon: QrCode,          iconBg: 'bg-blue-100',    iconTxt: 'text-blue-600',    accent: 'bg-blue-400'    },
  padala:  { label: 'Padala',  Icon: Globe,           iconBg: 'bg-violet-100',  iconTxt: 'text-violet-600',  accent: 'bg-violet-400'  },
  loan:    { label: 'Loan',    Icon: HandCoins,       iconBg: 'bg-amber-100',   iconTxt: 'text-amber-600',   accent: 'bg-amber-400'   },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',     label: 'All'     },
  { id: 'topup',   label: 'Top-up'  },
  { id: 'payment', label: 'Payment' },
  { id: 'padala',  label: 'Padala'  },
  { id: 'loan',    label: 'Loan'    },
];

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  );
}

function TxCard({ tx, address }: { tx: Transaction, address: string }) {
  let cfg = { ...TYPE_CFG[tx.type] };
  
  // Differentiate Padala direction
  if (tx.type === 'padala' && tx.direction === 'received') {
    cfg.label = 'Received Padala';
    cfg.Icon = ArrowDownToLine; // Use same icon as Top-up for incoming
    cfg.iconBg = 'bg-emerald-100';
    cfg.iconTxt = 'text-emerald-600';
    cfg.accent = 'bg-emerald-400';
  } else if (tx.type === 'padala') {
    cfg.label = 'Sent Padala';
  }

  const Icon = cfg.Icon;

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden flex">
      {/* left accent bar */}
      <div className={`w-1 shrink-0 ${cfg.accent}`} />

      <div className="flex-1 px-4 py-3.5 space-y-2 min-w-0">
        {/* top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
              <Icon size={15} className={cfg.iconTxt} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{cfg.label}</p>
              <p className="text-[10px] text-slate-400 truncate">{fmtDate(tx.timestamp)}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold ${ (tx.type === 'topup' || (tx.type === 'padala' && tx.direction === 'received')) ? 'text-emerald-600' : 'text-slate-800'}`}>
              {(tx.type === 'topup' || (tx.type === 'padala' && tx.direction === 'received')) ? '+' : ''}{tx.amountXlm.toFixed(2)} XLM
            </p>
            <p className="text-[10px] text-slate-400">≈ ₱{tx.amountPhp.toFixed(2)}</p>
          </div>
        </div>

        {/* detail row */}
        <div className="text-xs text-slate-500">
          {tx.type === 'payment' && tx.providerName && (
            <p className="flex items-center gap-1 truncate">
              {tx.providerType === 'hospital'
                ? <Building2 size={10} className="text-blue-400 shrink-0" />
                : <FlaskConical size={10} className="text-blue-400 shrink-0" />}
              {tx.providerName}
              {tx.payFrom === 'savings' && <span className="ml-1 text-slate-400">(from Savings)</span>}
            </p>
          )}
          {tx.type === 'padala' && (
            <p className="flex items-center gap-1 truncate">
              {tx.direction === 'received' ? (
                <>
                  <ArrowDownToLine size={10} className="text-emerald-400 shrink-0" />
                  From {tx.senderLabel || 'Unknown Sender'}
                </>
              ) : (
                <>
                  <Globe size={10} className="text-violet-400 shrink-0" />
                  To {tx.recipientMethod === 'gcash' ? 'GCash' : 'Stellar'} — {tx.recipientLabel}
                </>
              )}
            </p>
          )}
          {tx.type === 'topup' && tx.gcashRef && (
            <p className="font-mono text-slate-400">Ref: {tx.gcashRef}</p>
          )}
          {tx.type === 'loan' && tx.termMonths && (
            <p>
              {tx.interestRate}% p.a. · {tx.termMonths} months
              {tx.monthlyPhp ? ` · ₱${tx.monthlyPhp.toFixed(2)}/mo` : ''}
            </p>
          )}
        </div>

        {/* pts earned */}
        <div className="flex items-center justify-between gap-2">
          {(tx.ptsEarned ?? 0) > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 rounded-lg px-2 py-1 w-fit">
              <Star size={9} className="text-blue-500" />
              <span className="text-[10px] font-bold text-blue-600">+{tx.ptsEarned} SaloPoints</span>
            </div>
          )}

          {tx.txHash && tx.txHash.length > 20 && (
            <a
              href={`https://stellar.expert/explorer/testnet/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors ml-auto"
            >
              <Globe size={10} />
              View on Explorer
            </a>
          )}
        </div>

        {/* pending badge for loan */}

        {/* pending badge for loan */}
        {tx.status === 'pending' && (
          <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-600 rounded-full px-2 py-0.5">
            Pending review
          </span>
        )}
      </div>
    </div>
  );
}

export default function TransactionsTab({ address, phpRate: _phpRate }: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [txs, setTxs]       = useState<Transaction[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (address) {
      const addr = address.toUpperCase();
      
      const sync = async () => {
        setSyncing(true);
        // 1. Initial load from LocalStorage (Instant UI)
        const local = loadTxs(addr);
        setTxs(local);

        // 2. Fetch from Blockchain (Horizon) to ensure persistence across devices/reloads
        const remote = await fetchHorizonTxs(addr);

        // 3. Merge & De-duplicate
        setTxs(current => {
          const combined = [...current];
          remote.forEach(rtx => {
            // Check if this blockchain record already exists in our local storage
            // We prioritize local records because they contain extra metadata (like provider name)
            const exists = combined.some(ctx => 
              (ctx.txHash === rtx.txHash && rtx.txHash !== undefined) || 
              (ctx.id === rtx.id)
            );
            if (!exists) combined.push(rtx);
          });
          return combined.sort((a,b) => b.timestamp - a.timestamp);
        });
        setSyncing(false);
      };

      sync();

      // Listen for local transaction updates (Instant)
      const onUpdate = (e: any) => {
        if (e.detail?.address === addr || e.type === 'storage') {
          sync();
        }
      };
      window.addEventListener('salomed_tx_update', onUpdate);
      window.addEventListener('storage', onUpdate);
      return () => {
        window.removeEventListener('salomed_tx_update', onUpdate);
        window.removeEventListener('storage', onUpdate);
      };
    }
  }, [address]);

  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter);

  const countOf = (type: TxType) => txs.filter(t => t.type === type).length;

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Receipt size={32} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{t('connect_history_title')}</h2>
        <p className="text-sm text-slate-500 max-w-[280px]">
          {t('connect_history_desc')}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>
          {syncing && (
            <div className="flex items-center gap-1.5 text-blue-500 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Syncing...</span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {address.slice(0, 6)}…{address.slice(-6)}
          {' · '}{txs.length} transaction{txs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(f => {
          const count = f.id !== 'all' ? countOf(f.id as TxType) : txs.length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === f.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold ${filter === f.id ? 'text-blue-200' : 'text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-3 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Clock size={26} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No transactions yet</p>
          <p className="text-xs text-slate-300 max-w-[200px]">
            {filter !== 'all'
              ? `No ${filter} transactions found.`
              : 'Top up your vault, make a payment, or send Padala to get started.'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
              >
                <TxCard tx={tx} address={address} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
