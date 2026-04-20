'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, FlaskConical, Coins, X, CheckCircle,
  Loader2, AlertCircle, ShieldCheck, QrCode,
} from 'lucide-react';

import { payHospital, calcPayment } from '@/lib/contract';
import { saveTx } from '@/lib/transactions';

/** Shape encoded inside a SALOMED: QR code. */
export interface SaloMedQRPayload {
  patient: string;
  hospital: string;
  amount_usdc: number;
  provider_name: string;
  provider_type: 'hospital' | 'pharmacy';
}

/**
 * Try to decode a scanned QR string into a SaloMedQRPayload.
 * Returns null if it isn't a valid SALOMED: payload.
 */
export function parseSaloMedQR(raw: string): SaloMedQRPayload | null {
  if (!raw.startsWith('SALOMED:')) return null;
  try {
    const json = raw.slice('SALOMED:'.length);
    const obj = JSON.parse(json);
    if (
      typeof obj.patient === 'string' &&
      typeof obj.hospital === 'string' &&
      typeof obj.amount_usdc === 'number' &&
      obj.amount_usdc > 0
    ) {
      return {
        patient: obj.patient,
        hospital: obj.hospital,
        amount_usdc: obj.amount_usdc,
        provider_name: obj.provider_name ?? 'Provider',
        provider_type: obj.provider_type === 'pharmacy' ? 'pharmacy' : 'hospital',
      };
    }
  } catch { /* not valid JSON */ }
  return null;
}

interface Props {
  payload: SaloMedQRPayload;
  onClose: () => void;
  onSuccess: () => void;
}

import { API_URL } from '@/lib/config';

export default function QRPaymentConfirmModal({ payload, onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [txHash, setTxHash]         = useState<string | null>(null);
  const [done, setDone]             = useState(false);

  const phpRate = 56; // fallback; could fetch from API
  const phpValue = payload.amount_usdc * phpRate;

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const hash = await payHospital(payload.patient, payload.hospital, payload.amount_usdc);
      setTxHash(hash);
      
      const breakdown = calcPayment(payload.amount_usdc, payload.provider_type);
      saveTx(payload.patient, {
        type: 'payment',
        amountXlm: payload.amount_usdc,
        amountPhp: payload.amount_usdc * phpRate,
        providerName: payload.provider_name || undefined,
        providerType: payload.provider_type,
        payFrom: 'vault',
        ptsEarned: breakdown.ptsEarned,
        txHash: hash,
        status: 'success',
      });

      setDone(true);
      setTimeout(onSuccess, 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed — check connection.');
    } finally {
      setSubmitting(false);
    }
  }

  const ProviderIcon = payload.provider_type === 'pharmacy' ? FlaskConical : Building2;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="gradient-brand px-5 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <QrCode size={18} />
              <h3 className="font-bold text-base">QR Payment Detected</h3>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-blue-200">
            A payment request was scanned. Review and confirm to process.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <AnimatePresence mode="wait">
            {done ? (
              /* ── Success ──────────────────────────────────── */
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-bold text-slate-900">Payment Processed!</h4>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {payload.amount_usdc.toFixed(4)} XLM
                    </span>{' '}
                    deducted from vault
                  </p>
                  <p className="text-xs text-slate-400">
                    Paid to {payload.provider_name || 'Provider'}
                  </p>
                </div>
                {txHash && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 break-all max-w-full">
                    {typeof txHash === 'string' ? txHash.slice(0, 60) : JSON.stringify(txHash).slice(0, 60)}…
                  </div>
                )}
                <p className="text-xs text-slate-400">Returning to dashboard…</p>
              </motion.div>
            ) : (
              /* ── Review ───────────────────────────────────── */
              <motion.div key="review" className="space-y-4">
                {/* Provider info */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <ProviderIcon size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                      {payload.provider_type}
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {payload.provider_name || '(unnamed)'}
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-500 uppercase tracking-wide font-semibold mb-1">
                    <Coins size={11} className="inline mr-1" />
                    Amount to Deduct
                  </p>
                  <p className="text-3xl font-bold text-blue-700">
                    {payload.amount_usdc.toFixed(4)}{' '}
                    <span className="text-lg font-normal text-blue-400">XLM</span>
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    ≈ ₱{phpValue.toFixed(2)} PHP
                  </p>
                </div>

                {/* Patient address (whose vault gets deducted) */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={11} /> Deducting from vault
                  </p>
                  <p className="text-xs font-mono text-slate-600 break-all">
                    {payload.patient}
                  </p>
                </div>

                {/* Hospital address */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <ProviderIcon size={11} /> Paying to
                  </p>
                  <p className="text-xs font-mono text-slate-600 break-all">
                    {payload.hospital}
                  </p>
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

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={onClose}
                    className="flex-[0.4] py-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="flex-[0.6] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <><Loader2 size={16} className="animate-spin" /> Processing…</>
                    ) : (
                      <><CheckCircle size={15} /> Confirm & Pay</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
