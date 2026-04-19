'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Percent, Star, CheckCircle, Loader2, Info } from 'lucide-react';
import type { HealthVault } from '@/lib/contract';

interface Props {
  gapAmount: number;
  vault: HealthVault;
  patientAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

const TIER_RATE: Record<HealthVault['credit_tier'], number> = {
  Bronze: 9,
  Silver: 5,
  Gold:   2,
};

function monthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TERMS = [3, 6, 12];

export default function LoanModal({ gapAmount, vault, onClose, onSuccess }: Props) {
  const [selectedTerm, setSelectedTerm] = useState(6);
  const [submitting, setSubmitting]     = useState(false);
  const [done, setDone]                 = useState(false);

  const rate    = TIER_RATE[vault.credit_tier];
  const monthly = monthlyPayment(gapAmount, rate, selectedTerm);

  async function handleApply() {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1400));
    setDone(true);
    setTimeout(onSuccess, 2000);
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-t-3xl p-6 space-y-5 shadow-2xl"
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Micro-Loan Request</h2>
            <p className="text-xs text-slate-500">Gap Funding — Salo Feature</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        {/* Loan summary */}
        <div className="gradient-brand rounded-2xl p-4 text-white space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-200">Loan Amount</span>
            <span className="text-2xl font-bold">{php(gapAmount)}</span>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-blue-200 flex items-center gap-1"><Award size={10} /> Tier</p>
              <p className="text-sm font-semibold">{vault.credit_tier}</p>
            </div>
            <div>
              <p className="text-xs text-blue-200 flex items-center gap-1"><Percent size={10} /> Rate</p>
              <p className="text-sm font-semibold">{rate}% p.a.</p>
            </div>
            <div>
              <p className="text-xs text-blue-200 flex items-center gap-1"><Star size={10} /> Points</p>
              <p className="text-sm font-semibold">{vault.salo_points.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Term selector */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Repayment Term</p>
          <div className="grid grid-cols-3 gap-2">
            {TERMS.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTerm(t)}
                className={`rounded-xl py-3 text-center transition-all border ${
                  selectedTerm === t
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                }`}
              >
                <p className="text-sm font-bold">{t} mo</p>
                <p className={`text-xs mt-0.5 ${selectedTerm === t ? 'text-blue-100' : 'text-slate-400'}`}>
                  {php(monthlyPayment(gapAmount, rate, t))}/mo
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
          {[
            { label: 'Principal',                          value: php(gapAmount) },
            { label: 'Monthly Payment',                    value: php(monthly) },
            { label: `Total over ${selectedTerm} months`,  value: php(monthly * selectedTerm) },
            { label: 'Total Interest',                     value: php(monthly * selectedTerm - gapAmount) },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-semibold text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Tier nudge */}
        {vault.credit_tier !== 'Gold' && (
          <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Earn more SaloPoints to unlock a lower rate.{' '}
              {vault.credit_tier === 'Bronze'
                ? `${100 - vault.salo_points} more pts for Silver (5%).`
                : `${500 - vault.salo_points} more pts for Gold (2%).`}
            </p>
          </div>
        )}

        <p className="text-xs text-slate-400 text-center">
          Demo mode — applications are simulated.
        </p>

        {/* CTA */}
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle size={16} /> Application submitted!
              </div>
              <p className="text-slate-500 text-xs mt-1">A representative will contact you shortly.</p>
            </motion.div>
          ) : (
            <button
              onClick={handleApply}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                : `Apply — ${php(monthly)}/mo for ${selectedTerm} months`}
            </button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
