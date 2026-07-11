'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { saveTx } from '@/lib/transactions';
import { pdaxInitiateDeposit } from '@/lib/api';
import { API_URL, PHP_PER_USDC } from '@/lib/config';

interface Props {
  beneficiaryAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'processing' | 'done';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

export default function InstaPayTopUpModal({ beneficiaryAddress, onClose, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('form');
  const [amountPhp, setAmountPhp] = useState('');
  const [rate, setRate]           = useState(PHP_PER_USDC);
  const [error, setError]         = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [ledgerReference, setLedgerReference] = useState<string | null>(null);
  const [refId, setRefId]         = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => {
        if (d.php_per_usdc > 0) setRate(d.php_per_usdc);
      })
      .catch(() => {});
  }, []);

  const parsedPhp = parseFloat(amountPhp) || 0;
  const xlmAmount = parsedPhp > 0 ? (parsedPhp / rate).toFixed(2) : '—';

  async function handleDeposit() {
    if (parsedPhp < 100) { setError('Minimum top-up is ₱100.'); return; }
    setError(null);
    setStep('processing');

    try {
      const result = await pdaxInitiateDeposit(
        beneficiaryAddress,
        parsedPhp,
        `INSTAPAY-${Date.now()}`,
      );

      if ((result.mode === 'pdax_uat' || result.mode === 'pdax_prod') && result.checkout_url) {
        setCheckoutUrl(result.checkout_url);
        setRefId(result.pdax_reference || result.reference_id);
        saveTx(beneficiaryAddress, {
          type:      'topup',
          amountXlm: parsedPhp / rate,
          amountPhp: parsedPhp,
          gcashRef:  result.reference_id,
          txHash:    result.pdax_reference,
          status:    'pending',
        });
        setStep('done');
      } else {
        // Pilot ledger path. This reference is not a Stellar transaction hash.
        const hash = result.tx_result || result.reference_id || 'ok';
        setLedgerReference(hash);
        setRefId(result.reference_id);
        saveTx(beneficiaryAddress, {
          type:      'topup',
          amountXlm: parsedPhp / rate,
          amountPhp: parsedPhp,
          gcashRef:  result.reference_id,
          status:    'success',
        });

        window.dispatchEvent(new CustomEvent('salomed_tx_update', {
          detail: { address: beneficiaryAddress.toUpperCase() },
        }));

        setStep('done');
        setTimeout(() => { onSuccess(); }, 1500);
      }
    } catch (e: unknown) {
      console.error('InstaPay deposit failed:', e);
      setError(e instanceof Error ? e.message : 'Deposit failed. Please try again.');
      setStep('form');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#007DFF] px-6 pt-5 pb-5 text-white">
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="3" stroke="white" strokeWidth="1.5"/>
                  <path d="M2 9h20" stroke="white" strokeWidth="1.5"/>
                  <path d="M6 15h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Vault Top-Up</p>
                <p className="font-bold text-base leading-tight">InstaPay</p>
              </div>
            </div>
            {step === 'form' && (
              <button onClick={onClose} className="text-white/60 hover:text-white">
                <X size={22} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* FORM */}
            {step === 'form' && (
              <motion.div key="form"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <p className="text-xs text-slate-500 leading-relaxed">
                  Initiate an approved PDAX InstaPay flow. Vault credit occurs only after verified conversion and Stellar settlement.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Amount (PHP)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                    <input
                      value={amountPhp}
                      onChange={e => { setAmountPhp(e.target.value); setError(null); }}
                      type="number" min="100" step="100" placeholder="0"
                      inputMode="numeric"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#007DFF] focus:bg-white rounded-xl pl-8 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    {QUICK_AMOUNTS.map(n => (
                      <button
                        key={n}
                        onClick={() => setAmountPhp(String(n))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          parsedPhp === n
                            ? 'bg-[#007DFF] border-[#007DFF] text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-[#007DFF] hover:text-[#007DFF]'
                        }`}
                      >
                        ₱{n >= 1000 ? `${(n/1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : n}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {parsedPhp > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-blue-700">
                          ₱{parsedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2 })} PHP
                        </p>
                        <p className="text-xs text-blue-400">via PDAX InstaPay</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#007DFF]">{xlmAmount}</p>
                        <p className="text-xs text-blue-400">estimated USDC</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400 shrink-0">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 9h20" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <div className="overflow-hidden">
                    <p className="text-xs text-slate-400">Credits vault of</p>
                    <p className="text-xs font-mono text-slate-600 truncate">{beneficiaryAddress}</p>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <button
                  onClick={handleDeposit}
                  disabled={parsedPhp < 100}
                  className="w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 active:scale-[0.98] disabled:opacity-40 text-white font-semibold text-sm transition-all"
                >
                  {parsedPhp >= 100 ? `Pay ₱${parsedPhp.toLocaleString()} via InstaPay` : 'Enter at least ₱100'}
                </button>
              </motion.div>
            )}

            {/* PROCESSING */}
            {step === 'processing' && (
              <motion.div key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-4"
              >
                <Loader2 size={40} className="text-[#007DFF] animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Processing InstaPay…</p>
                  <p className="text-xs text-slate-400 mt-1">Connecting to PDAX</p>
                </div>
              </motion.div>
            )}

            {/* DONE */}
            {step === 'done' && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center gap-4 text-center"
              >
                <CheckCircle size={48} className="text-blue-500" />
                <div>
                  <p className="font-bold text-slate-900 text-lg">
                    {checkoutUrl ? 'Payment Initiated!' : 'Top-up Successful!'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {checkoutUrl
                      ? 'Complete payment via the InstaPay link. Vault credit remains pending until verified USDC settlement.'
                      : `Pilot top-up recorded: ₱${parsedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2 })} → ${xlmAmount} test USDC`
                    }
                  </p>
                </div>

                {refId && (
                  <p className="text-xs text-slate-400 font-mono">Ref: {refId}</p>
                )}

                {/* Real PDAX: show checkout link */}
                {checkoutUrl && (
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 text-white font-semibold text-sm justify-center transition-all"
                  >
                    <ExternalLink size={15} /> Open InstaPay Checkout
                  </a>
                )}

                {ledgerReference && !checkoutUrl && (
                  <div className="max-w-full text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Pilot ledger reference</p>
                    <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
                      {ledgerReference.length > 28
                        ? `${ledgerReference.slice(0, 20)}…${ledgerReference.slice(-8)}`
                        : ledgerReference}
                    </p>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
