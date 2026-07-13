'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, CreditCard, Star, Lock, RefreshCw, Globe,
  TrendingUp, ShieldCheck, Link, ArrowLeftRight,
} from 'lucide-react';
import { HealthVault } from '@/lib/contract';
import GCashModal from '@/components/GCashModal';
import FreighterTopUpModal from '@/components/FreighterTopUpModal';
import InstaPayTopUpModal from '@/components/InstaPayTopUpModal';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { getRuntimeStatus, RuntimeStatus } from '@/lib/runtime';
import { fmtPhp, fmtXlm } from '@/lib/format';
import { explorerAccountUrl, explorerContractUrl, networkBadgeLabel } from '@/lib/stellar-links';
import { CONTRACT_ID } from '@/lib/config';
import { useXlmPhpRate } from '@/lib/use-xlm-php-rate';

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
  const { t } = useTranslation();
  const [showGCash, setShowGCash]         = useState(false);
  const [showFreighter, setShowFreighter] = useState(false);
  const [showInstaPay, setShowInstaPay]   = useState(false);
  const [showPhp, setShowPhp]             = useState(false);
  const [runtime, setRuntime]             = useState<RuntimeStatus | null>(null);
  const rate = useXlmPhpRate();

  useEffect(() => {
    getRuntimeStatus().then(setRuntime).catch(() => setRuntime(null));
  }, []);

  const xlmValue  = Number(vault.balance) / 10_000_000;
  const phpValue  = xlmValue * rate.phpPerXlm;

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center shadow-sm">
          <Lock size={36} className="text-blue-400" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            {t('connect_vault_title').split(', ')[0]},<br />
            <span className="text-blue-600">{t('connect_vault_title').split(', ')[1]}</span>
          </h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            {t('connect_vault_desc')}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm transition-all disabled:opacity-60 shadow-sm flex items-center justify-center gap-2"
          >
            <Link size={15} />
            {connecting ? t('common_connecting') : t('common_connect_wallet')}
          </button>
          <p className="text-[11px] text-amber-600 text-center">
            Connect the wallet that will sign transactions. Manual address-only sessions are disabled.
          </p>

          <p className="text-[11px] text-slate-400 text-center pt-1">
            Secured on Stellar {networkBadgeLabel()}
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
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1">{t('pay_vault_balance')}</p>

        {loading ? (
          <div className="h-11 w-44 bg-white/20 rounded-lg animate-pulse my-1" />
        ) : (
          <button
            onClick={() => setShowPhp(v => !v)}
            className="text-left w-full active:scale-[0.99] transition-transform"
          >
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
            {/* Tap hint */}
            <p className="text-xs text-blue-300 mt-1 flex items-center gap-1">
              {showPhp
                ? `≈ ${fmtXlm(xlmValue)} XLM`
                : `≈ ₱${fmtPhp(phpValue)} PHP`}
              <ArrowLeftRight size={10} className="text-blue-400" />
            </p>
          </button>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-mono text-blue-300">
            {address.slice(0, 8)}…{address.slice(-8)}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={rate.refresh}
              disabled={rate.loading}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-blue-100/90 transition-colors hover:bg-white/20 disabled:opacity-60"
              title={`PHP/XLM rate: ₱${fmtPhp(rate.phpPerXlm)}`}
            >
              <RefreshCw size={9} className={rate.loading ? 'animate-spin' : ''} />
              {rate.source === 'pdax_live'
                ? 'Live PDAX'
                : rate.source === 'coingecko_live'
                  ? 'Live market'
                  : 'Indicative'} · ₱{fmtPhp(rate.phpPerXlm)}/XLM
            </button>
            {runtime?.mode === 'stellar_testnet' && (
              <a
                href={explorerAccountUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] transition-colors hover:bg-white/20"
              >
                <Globe size={10} />
                Explorer
              </a>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="mt-4 space-y-2">
          {/* Top-up label */}
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest text-center">
            {t('vault_topup')}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {(runtime?.mode === 'demo' || runtime?.mode === 'stellar_testnet') && (
              <button
                onClick={() => setShowGCash(true)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all rounded-xl px-3 py-3 text-xs font-semibold justify-center"
              >
                <span className="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[#007DFF] text-[11px] font-black">G</span>
                Add funds via GCash
              </button>
            )}
            {(runtime?.mode === 'pdax_uat' || runtime?.mode === 'pdax_prod') && (
              <div className="rounded-xl px-3 py-3 text-xs text-center bg-amber-300/20 border border-amber-200/30 text-amber-100">
                PDAX top-up disabled until USDC settlement is implemented and verified.
              </div>
            )}
            {runtime?.mode === 'stellar_testnet' && (
              <>
                <button
                  onClick={() => setShowInstaPay(true)}
                  className="flex items-center gap-2 bg-white text-[#007DFF] hover:bg-blue-50 active:scale-[0.97] transition-all rounded-xl px-3 py-3 text-xs font-bold justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M2 9h20" stroke="currentColor" strokeWidth="1.6"/>
                  </svg>
                  Top up with InstaPay (PDAX)
                </button>
                <button
                  onClick={() => setShowFreighter(true)}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all rounded-xl px-3 py-3 text-xs font-semibold justify-center"
                >
                  Deposit XLM with Freighter
                </button>
              </>
            )}
          </div>
        </div>      </motion.div>

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

      {/* SaloPoints are non-monetary until a funded redemption mechanism exists. */}
      <motion.div variants={card} className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <TrendingUp size={12} /> SaloPoints policy
        </p>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          Earn 1 SaloPoint for every full 1 XLM paid through the vault. Points determine your credit tier only;
          they are not money, cashback, or a spendable savings balance.
        </p>
      </motion.div>


      {/* Stats */}
      <motion.div variants={card} className="grid grid-cols-2 gap-3">
        {[
          { label: 'Vault Asset', value: 'XLM', sub: 'Stellar Lumens', Icon: CreditCard },
          { label: 'Points Rule', value: '1 / XLM', sub: 'per full XLM paid', Icon: Star },
          { label: 'Vault Status', value: vault.balance > 0n ? t('vault_active') : t('vault_empty'), sub: t('vault_escrow'), Icon: ShieldCheck },
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

      {/* Points rules */}
      <motion.div variants={card} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
          <TrendingUp size={13} /> Points and tiers
        </p>
        {[
          'Earn 1 point for each full XLM paid to a whitelisted provider.',
          'Bronze: below 100 points; Silver: 100–499; Gold: 500 or more.',
          'Points cannot be converted, withdrawn, transferred, or spent.',
          rate.source === 'pdax_live'
            ? 'PHP conversion uses the live PDAX rate.'
            : rate.source === 'coingecko_live'
              ? 'PHP conversion uses the live market rate.'
            : 'PHP display uses an indicative rate.',
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

      {/* Purpose lock notice — always visible, reinforces the core value */}
      <motion.div variants={card} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
              Purpose-Locked Health Fund
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              Funds in this vault are enforced by the Soroban smart contract on Stellar {networkBadgeLabel()} and can only be paid to contract-whitelisted healthcare providers.
            </p>
            {runtime?.mode === 'stellar_testnet' && (
              <a
                href={explorerContractUrl(CONTRACT_ID)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-semibold mt-1"
              >
                <Globe size={10} /> View smart contract on Stellar Expert
              </a>
            )}
          </div>
        </div>
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
      {showInstaPay && (
        <InstaPayTopUpModal
          beneficiaryAddress={address}
          onClose={() => setShowInstaPay(false)}
          onSuccess={() => { setShowInstaPay(false); onRefresh(); }}
        />
      )}
    </AnimatePresence>
    </>
  );
}
