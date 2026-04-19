'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, CreditCard, Star, Lock, RefreshCw,
  TrendingUp, ShieldCheck, Link, ArrowLeftRight,
} from 'lucide-react';
import { HealthVault, savingsXlm } from '@/lib/contract';
import GCashModal from '@/components/GCashModal';
import FreighterTopUpModal from '@/components/FreighterTopUpModal';

interface Props {
  address: string | null;
  vault: HealthVault;
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}

const TIER = {
  Bronze: { gradient: 'gradient-bronze', badge: 'bg-orange-100 text-orange-800',  rate: '9%' },
  Silver: { gradient: 'gradient-silver', badge: 'bg-slate-100  text-slate-500',   rate: '5%' },
  Gold:   { gradient: 'gradient-gold',   badge: 'bg-yellow-100 text-yellow-700',  rate: '2%' },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function tierProgress(vault: HealthVault): number {
  if (vault.credit_tier === 'Gold')   return 1;
  if (vault.credit_tier === 'Silver') return (vault.salo_points - 100) / 400;
  return vault.salo_points / 100;
}

function tierNextLabel(vault: HealthVault): string {
  if (vault.credit_tier === 'Gold')   return 'Maximum tier reached';
  if (vault.credit_tier === 'Silver') return `${500 - vault.salo_points} pts to Gold`;
  return `${100 - vault.salo_points} pts to Silver`;
}

const card = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export default function VaultCard({ address, vault, loading, connecting, onConnect, onRefresh }: Props) {
  const [showGCash, setShowGCash]         = useState(false);
  const [showFreighter, setShowFreighter] = useState(false);
  const [showPhp, setShowPhp]             = useState(false);
  const [phpRate, setPhpRate]             = useState(6);   // PHP per 1 XLM

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => setPhpRate(d.php_per_usdc))
      .catch(() => {});
  }, []);

  const xlmValue  = Number(vault.balance) / 10_000_000;
  const phpValue  = xlmValue * phpRate;

  function fmtXlm(v: number) {
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  function fmtPhp(v: number) {
    return v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center shadow-sm">
          <Lock size={36} className="text-blue-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Welcome to SaloMed,<br/><span className="text-blue-600">Your Health Alkansya</span>
          </h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            Connect your Freighter wallet to unlock purpose-bound savings and seamlessly manage your health expenses.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm transition-all disabled:opacity-60 shadow-sm flex items-center justify-center gap-2"
          >
            <Link size={15} />
            {connecting ? 'Connecting…' : 'Connect Freighter'}
          </button>
          
          <p className="text-[11px] text-slate-400 text-center pt-2">
            Demo mode · Ensure Freighter is set to <strong>Testnet</strong>
          </p>
        </div>
      </div>
    );
  }

  const tier     = TIER[vault.credit_tier];
  const progress = tierProgress(vault);

  return (
    <>
    <motion.div
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      initial="hidden"
      animate="show"
      className="px-4 py-6 space-y-3 max-w-lg mx-auto"
    >
      {/* Balance hero */}
      <motion.div variants={card} className="gradient-brand rounded-2xl p-5 text-white shadow-card-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">Vault Balance</p>

        {loading ? (
          <div className="h-11 w-44 bg-white/20 rounded-lg animate-pulse my-1" />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={showPhp ? 'php' : 'xlm'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {showPhp ? (
                <p className="text-4xl font-bold tabular-nums">
                  ₱{fmtPhp(phpValue)}
                  <span className="text-xl font-normal text-blue-200 ml-2">PHP</span>
                </p>
              ) : (
                <p className="text-4xl font-bold tabular-nums">
                  {fmtXlm(xlmValue)}
                  <span className="text-xl font-normal text-blue-200 ml-2">XLM</span>
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Conversion sub-label */}
        {!loading && (
          <p className="text-xs text-blue-300 mt-1">
            {showPhp
              ? `≈ ${fmtXlm(xlmValue)} XLM`
              : `≈ ₱${fmtPhp(phpValue)} PHP`}
          </p>
        )}

        <p className="text-xs text-blue-300 font-mono mt-1 truncate">
          {address.slice(0, 8)}…{address.slice(-8)}
        </p>

        {/* Actions row */}
        <div className="mt-4 space-y-2">
          {/* Top-up label */}
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest text-center">
            Top Up Vault
          </p>
          <div className="flex gap-2">
            {/* GCash top-up */}
            <button
              onClick={() => setShowGCash(true)}
              className="flex-1 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all rounded-xl px-3 py-2.5 text-xs font-semibold justify-center"
            >
              <span className="w-4 h-4 bg-white rounded flex items-center justify-center text-[#007DFF] text-[10px] font-black leading-none shrink-0">G</span>
              GCash
            </button>

            {/* Freighter top-up */}
            <button
              onClick={() => setShowFreighter(true)}
              className="flex-1 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all rounded-xl px-3 py-2.5 text-xs font-semibold justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" className="shrink-0">
                <circle cx="16" cy="16" r="16" fill="white" fillOpacity="0.9"/>
                <path d="M16 6L26 12V20L16 26L6 20V12L16 6Z" fill="#007DFF"/>
              </svg>
              Freighter
            </button>

            {/* Currency toggle */}
            <button
              onClick={() => setShowPhp(v => !v)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all rounded-xl px-3 py-2.5 text-xs font-semibold"
              title={showPhp ? 'Show XLM' : 'Show PHP'}
            >
              <ArrowLeftRight size={13} />
              {showPhp ? 'XLM' : 'PHP'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* SaloPoints + tier */}
      <motion.div variants={card} className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Star size={12} /> SaloPoints
            </p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {vault.salo_points.toLocaleString()}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 ${tier.badge}`}>
            <Award size={14} />
            {vault.credit_tier}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${tier.gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 1) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
          <p className="text-xs text-slate-400 text-right">{tierNextLabel(vault)}</p>
        </div>
      </motion.div>

      {/* Vault Savings */}
      <motion.div variants={card} className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <TrendingUp size={12} /> Vault Savings
            </p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {savingsXlm(vault).toFixed(4)}
              <span className="text-base font-normal text-slate-400 ml-1.5">XLM</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              ≈ ₱{(savingsXlm(vault) * phpRate).toFixed(2)} PHP
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">50 pts = 1 XLM</p>
            <p className="text-xs font-semibold text-slate-500">{vault.salo_points.toLocaleString()} pts</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          Earned from payments — use as an alternative balance when paying providers.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={card} className="grid grid-cols-2 gap-3">
        {[
          { label: 'Loan Rate',    value: tier.rate,           sub: 'interest p.a.',      Icon: CreditCard  },
          { label: 'Cashback Rate', value: 'Up to 2%',           sub: '2% hospital · 1% pharmacy', Icon: Star },
          { label: 'Vault Status', value: vault.balance > 0n ? 'Active' : 'Empty', sub: 'escrow balance', Icon: ShieldCheck },
          { label: 'Credit Tier',  value: vault.credit_tier,   sub: tierNextLabel(vault), Icon: Award       },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-card border border-slate-100 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <stat.Icon size={13} className="text-blue-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{stat.label}</p>
            </div>
            <p className="text-lg font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-tight">{stat.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* How to earn */}
      <motion.div variants={card} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
          <TrendingUp size={13} /> How to Earn SaloPoints
        </p>
        {[
          'Pay at a hospital — earn 2 SaloPoints per XLM',
          'Pay at a pharmacy — earn 1 SaloPoint per XLM',
          'Send Padala to family — earn 1 SaloPoint per XLM',
          'Save up 50 points and convert to 1 XLM anytime',
          'More points = better loan rates',
        ].map(tip => (
          <div key={tip} className="flex gap-2 text-xs text-blue-600">
            <span className="shrink-0 mt-0.5 font-bold">–</span>
            <span>{tip}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={card}>
        <button
          onClick={onRefresh}
          className="w-full py-2 text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw size={12} /> Refresh vault
        </button>
      </motion.div>
    </motion.div>

    <AnimatePresence>
      {showGCash && (
        <GCashModal
          beneficiaryAddress={address}
          onClose={() => setShowGCash(false)}
          onSuccess={() => { setShowGCash(false); onRefresh(); }}
        />
      )}
      {showFreighter && (
        <FreighterTopUpModal
          address={address}
          onClose={() => setShowFreighter(false)}
          onSuccess={() => { setShowFreighter(false); onRefresh(); }}
        />
      )}
    </AnimatePresence>
    </>
  );
}
