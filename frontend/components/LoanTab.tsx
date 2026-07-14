'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Percent, Star, CheckCircle, Loader2, Info,
  ArrowLeftRight, ChevronRight, ChevronLeft, Coins, Lock, Clock,
} from 'lucide-react';
import type { HealthVault } from '@/lib/contract';
import { loadTxs, Transaction, saveTx } from '@/lib/transactions';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import LiveRateButton from '@/components/LiveRateButton';
import { useXlmPhpRate } from '@/lib/use-xlm-php-rate';
import { recordSaloRequest } from '@/lib/salo-requests';

interface Props {
  address: string | null;
  vault: HealthVault;
}

const TIER_RATE: Record<HealthVault['credit_tier'], number> = {
  Bronze: 9,
  Silver: 5,
  Gold:   2,
};

const TERMS   = [3, 6, 12];
const PRESETS = [500, 1000, 2500, 5000, 10000]; // in PHP

function monthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Step = 'overview' | 'apply' | 'done';

export default function LoanTab({ address, vault }: Props) {
  const { t } = useTranslation();
  const [step, setStep]             = useState<Step>('overview');
  const [amountPhp, setAmountPhp]   = useState('');
  const [showXlm, setShowXlm]       = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const xlmRate = useXlmPhpRate();

  const rate       = TIER_RATE[vault.credit_tier];
  const parsedPhp  = parseFloat(amountPhp) || 0;
  const parsedUsdc = parsedPhp / xlmRate.phpPerXlm;
  const monthly    = parsedPhp > 0 ? monthlyPayment(parsedPhp, rate, selectedTerm) : 0;
  const totalPay   = monthly * selectedTerm;
  const totalInt   = totalPay - parsedPhp;

  const vaultXlm   = Number(vault.balance) / 10_000_000;
  
  const allTxs      = address ? loadTxs(address) : [];
  const pendingLoans = allTxs.filter(t => t.type === 'loan' && t.status === 'pending');
  const loanLimitReached = pendingLoans.length >= 2;

  async function handleApply() {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1400));
    setSubmitting(false);
    if (address) {
      saveTx(address, {
        type:         'loan',
        amountXlm:    parsedUsdc,
        amountPhp:    parsedPhp,
        termMonths:   selectedTerm,
        monthlyPhp:   monthly,
        interestRate: rate,
        status:       'pending',
      });
      void recordSaloRequest({
        patientAddress: address,
        amountAsset: parsedUsdc,
        amountPhp: parsedPhp,
        termMonths: selectedTerm,
        monthlyPhp: monthly,
        interestRate: rate,
        saloPoints: vault.salo_points,
        creditTier: vault.credit_tier,
        pendingRequests: pendingLoans.length,
      });
    }
    setStep('done');
  }

  // ── No wallet ────────────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Lock size={32} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">{t('connect_loan_title')}</h2>
        <p className="text-sm text-slate-500 max-w-[280px]">
          {t('connect_loan_desc')}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
      <AnimatePresence mode="wait">

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {step === 'overview' && (
          <motion.div key="overview"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Hero */}
            <div className="gradient-brand rounded-2xl p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1.5">
                <Coins size={11} /> Salo
              </p>
              <h2 className="text-xl font-bold mb-1">{t('loan_hero_title')}</h2>
              <p className="text-sm text-blue-100 leading-relaxed">
                {t('loan_hero_desc')}
              </p>
            </div>

            {/* Pending loan notification */}
            {pendingLoans.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock size={20} className="text-amber-500" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-amber-900">
                      {pendingLoans.length === 1 ? t('loan_pending_one') : t('loan_pending_many')}
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      {pendingLoans.length === 1
                        ? t('loan_pending_one_desc', { amount: php(pendingLoans[0].amountPhp) })
                        : t('loan_pending_many_desc', {
                            count: pendingLoans.length,
                            amount: php(pendingLoans.reduce((sum, l) => sum + l.amountPhp, 0)),
                          })}
                    </p>
                  </div>
                </div>
                
                {pendingLoans.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-amber-200">
                    {pendingLoans.map((loan, i) => (
                      <div key={loan.id} className="flex justify-between items-center text-[10px] font-bold text-amber-800">
                        <span>{t('loan_application', { number: i + 1 })}</span>
                        <span>{php(loan.amountPhp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Salo tier card */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('loan_your_tier')}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900">{vault.credit_tier}</span>
                    <Award size={18} className="text-blue-500" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">{t('loan_interest_rate')}</p>
                  <p className="text-3xl font-bold text-blue-600">{rate}%</p>
                  <p className="text-xs text-slate-400">{t('loan_per_annum')}</p>
                </div>
              </div>

              {/* Tier rates comparison */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TIER_RATE) as [HealthVault['credit_tier'], number][]).map(([tier, r]) => (
                  <div key={tier} className={`rounded-xl p-3 text-center border-2 transition-all ${
                    vault.credit_tier === tier
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-100 bg-slate-50'
                  }`}>
                    <p className={`text-xs font-bold ${vault.credit_tier === tier ? 'text-blue-700' : 'text-slate-500'}`}>{tier}</p>
                    <p className={`text-lg font-bold mt-0.5 ${vault.credit_tier === tier ? 'text-blue-600' : 'text-slate-400'}`}>{r}%</p>
                  </div>
                ))}
              </div>

              {vault.credit_tier !== 'Gold' && (
                <div className="flex gap-2 mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {vault.credit_tier === 'Bronze'
                      ? t('loan_points_to_silver', { points: 100 - vault.salo_points })
                      : t('loan_points_to_gold', { points: 500 - vault.salo_points })}
                    {' '}{t('loan_pay_hospitals_tip')}
                  </p>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('loan_vault_balance'), value: php(vaultXlm * xlmRate.phpPerXlm), sub: `≈ ${vaultXlm.toFixed(2)} XLM`, Icon: Coins },
                { label: t('loan_salopoints'),   value: vault.salo_points.toLocaleString(), sub: t('loan_earned'), Icon: Star },
                { label: t('loan_rate'),          value: `${rate}% p.a.`,  sub: vault.credit_tier, Icon: Percent },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl shadow-card border border-slate-100 p-3 text-center">
                  <s.Icon size={14} className="text-blue-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-700">{t('loan_how_title')}</h3>
              {[
                t('loan_how_1'),
                t('loan_how_2'),
                t('loan_how_3'),
                t('loan_how_4'),
              ].map((s, i) => (
                <div key={s} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-500">{s}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep('apply')}
                disabled={loanLimitReached}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {loanLimitReached ? t('loan_request_limit') : t('loan_request')} <ChevronRight size={16} />
              </button>
              
              {loanLimitReached && (
                <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t('loan_limit_desc')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── APPLY ────────────────────────────────────────────────────────── */}
        {step === 'apply' && (
          <motion.div key="apply"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('overview')}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <h2 className="font-bold text-lg text-slate-900">{t('loan_apply_title')}</h2>
                <p className="text-xs text-slate-400">{rate}% p.a. · {vault.credit_tier} tier</p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Coins size={11} /> {t('loan_support_amount')}
                </label>
                <button
                  onClick={() => setShowXlm(v => !v)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold"
                >
                  <ArrowLeftRight size={11} /> {showXlm ? 'PHP' : 'XLM'}
                </button>
              </div>

              <div className="relative">
                {!showXlm && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                )}
                <input
                  value={amountPhp}
                  onChange={e => setAmountPhp(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  type="number" min="0" step={showXlm ? '0.01' : '100'} placeholder="0.00"
                  className={`w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl ${showXlm ? 'px-4' : 'pl-8'} pr-16 py-3.5 text-xl font-bold text-slate-800 placeholder-slate-300 outline-none transition-all`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  {showXlm ? 'XLM' : 'PHP'}
                </span>
              </div>

              {parsedPhp > 0 && (
                <p className="text-xs text-slate-400 text-right">
                  {showXlm ? `= ${php(parsedPhp)}` : `≈ ${parsedUsdc.toFixed(2)} XLM`}
                </p>
              )}

              {/* Preset amounts */}
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map(n => (
                  <button
                    key={n}
                    onClick={() => setAmountPhp(String(n))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border min-w-[52px] ${
                      parsedPhp === n
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    ₱{n >= 1000 ? `${n / 1000}k` : n}
                  </button>
                ))}
              </div>
            </div>

            {/* Term selector */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('loan_repayment_term')}</p>
              <div className="grid grid-cols-3 gap-2">
                {TERMS.map(term => (
                  <button
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    className={`rounded-xl py-3.5 text-center transition-all border ${
                      selectedTerm === term
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <p className="text-sm font-bold">{t('loan_months', { months: term })}</p>
                    {parsedPhp > 0 && (
                      <p className={`text-xs mt-0.5 ${selectedTerm === term ? 'text-blue-100' : 'text-slate-400'}`}>
                        {t('loan_monthly_short', { amount: php(monthlyPayment(parsedPhp, rate, term)) })}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            <AnimatePresence>
              {parsedPhp > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-2"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('loan_summary')}</p>
                  {[
                    { label: t('loan_principal'),                         value: php(parsedPhp) },
                    { label: t('loan_monthly_payment', { months: selectedTerm }), value: php(monthly) },
                    { label: t('loan_total_repayment'),                   value: php(totalPay) },
                    { label: t('loan_total_interest'),                    value: php(totalInt) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-800">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <LiveRateButton
                      phpPerXlm={xlmRate.phpPerXlm}
                      source={xlmRate.source}
                      loading={xlmRate.loading}
                      onRefresh={xlmRate.refresh}
                      className="!border-blue-100 !bg-blue-100/70 !text-blue-700 hover:!bg-blue-100"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {parsedPhp > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('loan_review_title')}</p>
                {[
                  { label: t('loan_review_identity'), value: t('loan_review_identity_value') },
                  { label: t('loan_review_open_requests'), value: `${pendingLoans.length}/2` },
                  { label: t('loan_review_payment_history'), value: t('loan_review_payment_history_value', { points: vault.salo_points }) },
                  { label: t('loan_review_salomed'), value: t('loan_review_salomed_value') },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 text-slate-500">
                      <CheckCircle size={13} className="text-blue-500" />
                      {row.label}
                    </span>
                    <span className="font-semibold text-slate-700 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-400 text-center">{t('common_demo_simulated')}</p>

            <button
              onClick={handleApply}
              disabled={submitting || parsedPhp <= 0}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> {t('loan_submitting')}</>
                : parsedPhp > 0
                  ? t('loan_request_with_terms', { amount: php(monthly), months: selectedTerm })
                  : t('loan_enter_amount')
              }
            </button>
          </motion.div>
        )}

        {/* ── DONE (PENDING APPROVAL) ────────────────────────────────────── */}
        {step === 'done' && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-6"
          >
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <Clock size={36} className="text-amber-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">{t('loan_done_title')}</h3>
              <p className="text-sm text-slate-500">
                {t('loan_done_desc', { amount: php(parsedPhp), xlm: parsedUsdc.toFixed(2) })}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {t('loan_done_term_rate', { months: selectedTerm, rate })}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 max-w-xs leading-relaxed">
              <p className="font-bold mb-1">{t('loan_done_status_title')}</p>
              {t('loan_done_status_desc')}
            </div>
            <button
              onClick={() => { setStep('overview'); setAmountPhp(''); }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              {t('loan_back')}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
