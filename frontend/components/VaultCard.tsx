'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Coins, CreditCard, Star, Lock, RefreshCw, Globe,
  TrendingUp, ShieldCheck, Link, ArrowLeftRight, Wallet,
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

type SaloTier = keyof typeof TIER;

function saloTierFromPoints(points: number): SaloTier {
  if (points >= 500) return 'Gold';
  if (points >= 100) return 'Silver';
  return 'Bronze';
}

function tierProgress(points: number): number {
  if (points >= 500) return 1;
  if (points >= 100) return (points - 100) / 400;
  return points / 100;
}

function tierNextLabel(points: number, t: (key: any, params?: Record<string, string | number>) => string): string {
  if (points >= 500) return t('vault_max_tier');
  if (points >= 100) return t('vault_points_to_gold', { points: 500 - points });
  return t('vault_points_to_silver', { points: 100 - points });
}

const card = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

export default function VaultCard({ address, vault, loading, connecting, onConnect, onRefresh }: Props) {
  const { t } = useTranslation();
  const [showGCash, setShowGCash]         = useState(false);
  const [showFreighter, setShowFreighter] = useState(false);
  const [showInstaPay, setShowInstaPay]   = useState(false);
  const [showPhp, setShowPhp]             = useState(true);
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
            {t('vault_connect_notice')}
          </p>

          <p className="text-[11px] text-slate-400 text-center pt-1">
            {t('vault_secured_on_stellar')} {networkBadgeLabel()}
          </p>
        </div>
      </div>
    );
  }

  const saloTier = saloTierFromPoints(vault.salo_points);
  const tier     = TIER[saloTier];
  const progress = tierProgress(vault.salo_points);

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
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">{t('pay_vault_balance')}</p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-blue-100/90 transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            {t('vault_refresh')}
          </button>
        </div>

        {loading ? (
          <div className="h-11 w-44 bg-white/20 rounded-lg animate-pulse my-1" />
        ) : (
          <button
            onClick={() => setShowPhp(v => !v)}
            className="group w-full text-left transition-transform active:scale-[0.99]"
            title={showPhp ? t('vault_show_xlm') : t('vault_show_php')}
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
                  <p className="text-4xl font-bold leading-none tabular-nums">
                    ₱{fmtPhp(phpValue)}
                    <span className="text-xl font-normal text-blue-200 ml-2">PHP</span>
                  </p>
                ) : (
                  <p className="text-4xl font-bold leading-none tabular-nums">
                    {fmtXlm(xlmValue)}
                    <span className="text-xl font-normal text-blue-200 ml-2">XLM</span>
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
            {/* Tap hint */}
            <p className="mt-2 flex max-w-xs flex-wrap items-center gap-2 text-xs text-blue-200">
              {showPhp
                ? `≈ ${fmtXlm(xlmValue)} XLM`
                : `≈ ₱${fmtPhp(phpValue)} PHP`}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white transition-colors group-hover:bg-white/25">
                <ArrowLeftRight size={11} />
                {showPhp ? t('vault_show_xlm') : t('vault_show_php')}
              </span>
            </p>
          </button>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
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
                ? t('vault_live_pdax')
                : rate.source === 'coingecko_live'
                  ? t('vault_live_market')
                  : t('vault_indicative')} · ₱{fmtPhp(rate.phpPerXlm)}/XLM
            </button>
            {runtime?.mode === 'stellar_testnet' && (
              <a
                href={explorerAccountUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] transition-colors hover:bg-white/20"
              >
                <Globe size={10} />
                {t('vault_explorer')}
              </a>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="mt-5 space-y-2.5">
          {/* Top up label */}
          <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest text-center">
            {t('vault_topup')}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(runtime?.mode === 'demo' || runtime?.mode === 'stellar_testnet') && (
              <button
                onClick={() => setShowGCash(true)}
                className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-3 text-center text-[11px] font-bold text-white shadow-sm transition-all hover:bg-white hover:text-slate-800 active:scale-[0.98]"
              >
                <span className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center text-[#007DFF] text-[12px] font-black transition-colors group-hover:bg-[#007DFF] group-hover:text-white">G</span>
                GCash
              </button>
            )}
            {(runtime?.mode === 'pdax_uat' || runtime?.mode === 'pdax_prod') && (
              <div className="rounded-xl px-3 py-3 text-xs text-center bg-amber-300/20 border border-amber-200/30 text-amber-100">
                {t('vault_pdax_disabled')}
              </div>
            )}
            {runtime?.mode === 'stellar_testnet' && (
              <>
                <button
                  onClick={() => setShowInstaPay(true)}
                  className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-3 text-center text-[11px] font-bold text-white shadow-sm transition-all hover:bg-white hover:text-slate-800 active:scale-[0.98]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-blue-600 transition-colors group-hover:bg-blue-50">
                    <CreditCard size={15} />
                  </span>
                  <span>
                    InstaPay
                    <span className="block text-[9px] font-semibold opacity-75 group-hover:text-slate-500">PDAX</span>
                  </span>
                </button>
                <button
                  onClick={() => setShowFreighter(true)}
                  className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-3 text-center text-[11px] font-bold text-white shadow-sm transition-all hover:bg-white hover:text-slate-800 active:scale-[0.98]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-indigo-600 transition-colors group-hover:bg-indigo-50">
                    <Wallet size={15} />
                  </span>
                  Freighter
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
            {saloTier}
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
          <p className="text-xs text-slate-400 text-right">{tierNextLabel(vault.salo_points, t)}</p>
        </div>
      </motion.div>

      {/* SaloPoints are non-monetary until a funded redemption mechanism exists. */}
      <motion.div variants={card} className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <TrendingUp size={12} /> {t('vault_salopoints_policy_title')}
        </p>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          {t('vault_salopoints_policy_desc')}
        </p>
      </motion.div>


      {/* Stats */}
      <motion.div variants={card} className="grid grid-cols-2 gap-3">
        {[
          { label: t('vault_asset_label'), value: 'XLM', sub: t('vault_asset_sub'), Icon: Coins },
          { label: t('vault_points_rule_label'), value: '1 / XLM', sub: t('vault_points_rule_sub'), Icon: Star },
          { label: t('vault_status'), value: vault.balance > 0n ? t('vault_active') : t('vault_empty'), sub: t('vault_escrow'), Icon: ShieldCheck },
          { label: t('vault_salo_tier_label'),  value: saloTier,   sub: tierNextLabel(vault.salo_points, t), Icon: Award       },
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
          <TrendingUp size={13} /> {t('vault_points_tiers_title')}
        </p>
        {[
          t('vault_points_tiers_tip1'),
          t('vault_points_tiers_tip2'),
          t('vault_points_tiers_tip3'),
          rate.source === 'pdax_live'
            ? t('vault_php_pdax_rate')
            : rate.source === 'coingecko_live'
              ? t('vault_php_market_rate')
            : t('vault_php_indicative_rate'),
        ].map(tip => (
          <div key={tip} className="flex gap-2 text-xs text-blue-600">
            <span className="shrink-0 mt-0.5 font-bold">-</span>
            <span>{tip}</span>
          </div>
        ))}
      </motion.div>

      {/* Purpose lock notice: always visible, reinforces the core value */}
      <motion.div variants={card} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
              {t('vault_purpose_title')}
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              {t('vault_purpose_desc', { network: networkBadgeLabel() })}
            </p>
            {runtime?.mode === 'stellar_testnet' && (
              <a
                href={explorerContractUrl(CONTRACT_ID)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-semibold mt-1"
              >
                <Globe size={10} /> {t('vault_view_contract')}
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
