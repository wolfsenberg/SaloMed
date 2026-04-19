'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Coins, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  patientAddress: string;
  amountXlm: number;
  vault?: any; // HealthVault structure
  onClose: () => void;
  onSuccess: () => void;
  onSwitchTab?: (tab: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function isValidStellarAddress(addr: string) {
  return addr.startsWith('G') && addr.length === 56;
}

export default function PayModal({ patientAddress, amountXlm, onClose, onSuccess }: Props) {
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [txHash, setTxHash]                   = useState<string | null>(null);
  const [done, setDone]                       = useState(false);

  const vaultBalance = vault ? Number(vault.balance) / 10_000_000 : Infinity;
  const isInsufficient = amountXlm > vaultBalance;

  async function handlePay() {
    if (!isValidStellarAddress(hospitalAddress.trim())) {
      setError('Enter a valid Stellar public key (starts with G, 56 characters).'); return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/qrph/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_address: patientAddress,
          hospital_id:     hospitalAddress.trim(),
          amount_usdc:     amountXlm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Payment failed');
      setTxHash(data.tx_result ?? null);
      setDone(true);
      setTimeout(onSuccess, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed — try again.');
    } finally {
      setSubmitting(false);
    }
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
            <h2 className="text-lg font-bold text-slate-900">Pay to Hospital</h2>
            <p className="text-xs text-slate-500">Vault escrow → hospital wallet</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={22} />
          </button>
        </div>

        {/* Amount display */}
        <div className="gradient-brand rounded-xl p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2 text-blue-200">
            <Coins size={15} />
            <span className="text-sm">Transfer Amount</span>
          </div>
          <span className="text-2xl font-bold">
            {amountXlm.toLocaleString('en-US', { minimumFractionDigits: 4 })} XLM
          </span>
        </div>

        {/* Hospital address */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={11} /> Whitelisted Hospital Wallet
          </label>
          <input
            value={hospitalAddress}
            onChange={e => { setHospitalAddress(e.target.value); setError(null); }}
            placeholder="GABC…XYZ"
            spellCheck={false}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 outline-none transition-all"
          />
          <p className="text-xs text-slate-400">Must be pre-approved by the SaloMed admin.</p>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
            >
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Balance check */}
        {isInsufficient && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-amber-900">Not enough balance</p>
                <p className="text-xs text-amber-700">
                  Your vault has {vaultBalance.toFixed(4)} XLM, which is not enough for this payment.
                </p>
              </div>
            </div>
            {onSwitchTab && (
              <button
                onClick={() => { onClose(); onSwitchTab('vault'); }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Top Up in Vault
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="text-emerald-900 font-bold text-base">Payment Sent!</p>
                <p className="text-emerald-700 text-sm font-semibold">
                  {amountXlm.toFixed(4)} XLM
                </p>
                <p className="text-emerald-600/70 text-[10px] tabular-nums break-all">
                  TX: {txHash?.slice(0, 32)}...
                </p>
              </div>
              <p className="text-slate-400 text-xs pt-2">Returning to dashboard…</p>
            </motion.div>
          ) : (
            <button
              onClick={handlePay}
              disabled={submitting || isInsufficient}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:grayscale text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                : isInsufficient ? 'Insufficient Balance' : 'Confirm Payment'}
            </button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
