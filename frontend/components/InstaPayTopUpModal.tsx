'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, ExternalLink, AlertCircle, Zap } from 'lucide-react';
import { saveTx } from '@/lib/transactions';
import { pdaxInitiateDeposit, pdaxConfirm, pdaxQuote, PdaxQuoteResult } from '@/lib/api';
import { fmtAsset, fmtPhp } from '@/lib/format';
import { explorerTxUrl, networkBadgeLabel } from '@/lib/stellar-links';

interface Props {
  beneficiaryAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'creating' | 'awaiting_payment' | 'crediting' | 'done';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

export default function InstaPayTopUpModal({ beneficiaryAddress, onClose, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('form');
  const [amountPhp, setAmountPhp] = useState('');
  const [quote, setQuote]         = useState<PdaxQuoteResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [identifier, setIdentifier]   = useState<string | null>(null);
  const [txHash, setTxHash]           = useState<string | null>(null);
  const [creditedUsdc, setCreditedUsdc] = useState<number | null>(null);
  const [polling, setPolling]         = useState(false);

  const parsedPhp = parseFloat(amountPhp) || 0;

  // Live PDAX conversion quote, debounced on amount changes.
  useEffect(() => {
    if (parsedPhp < 100) { setQuote(null); return; }
    let active = true;
    const id = setTimeout(() => {
      pdaxQuote(parsedPhp, 'USDC')
        .then(q => { if (active) setQuote(q); })
        .catch(() => { if (active) setQuote(null); });
    }, 350);
    return () => { active = false; clearTimeout(id); };
  }, [parsedPhp]);

  const usdcOut = quote ? quote.asset_amount : 0;
  const rateSource = quote?.source ?? 'indicative';

  async function handleCreateDeposit() {
    if (parsedPhp < 100) { setError('Minimum top-up is PHP 100.'); return; }
    setError(null);
    setStep('creating');
    try {
      const result = await pdaxInitiateDeposit(beneficiaryAddress, parsedPhp);
      setCheckoutUrl(result.checkout_url);
      setIdentifier(result.identifier);
      setStep('awaiting_payment');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create the InstaPay deposit.');
      setStep('form');
    }
  }

  async function handleConfirm() {
    if (!identifier) return;
    setError(null);
    setPolling(true);
    setStep('crediting');
    try {
      // 1) Try the real settlement path: if the PDAX InstaPay payment actually
      //    completed, credit with the confirmed amount.
      let result = await pdaxConfirm(identifier, beneficiaryAddress);
      let tx: string | null = null;
      let credited = usdcOut;

      if (result.credited) {
        tx = result.tx_hash ?? null;
        credited = result.usdc_amount ?? usdcOut;
      } else {
        // 2) Demo fallback: no real fiat settlement (no real money yet), so
        //    credit the vault on-chain via the admin on-ramp float. The USDC
        //    credited is real and verifiable; only the fiat leg is simulated.
        const { depositToVault } = await import('@/lib/contract');
        tx = await depositToVault(beneficiaryAddress, usdcOut);
      }

      setTxHash(tx);
      setCreditedUsdc(credited);
      saveTx(beneficiaryAddress, {
        type:      'topup',
        amountXlm: credited,
        amountPhp: parsedPhp,
        gcashRef:  identifier,
        txHash:    tx ?? undefined,
        status:    'success',
      });
      window.dispatchEvent(new CustomEvent('salomed_tx_update', {
        detail: { address: beneficiaryAddress.toUpperCase() },
      }));
      setStep('done');
      setTimeout(() => onSuccess(), 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'On-chain credit failed. It can be retried safely.');
      setStep('awaiting_payment');
    } finally {
      setPolling(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50"
      onClick={step === 'form' || step === 'awaiting_payment' ? onClose : undefined}
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
                <p className="font-bold text-base leading-tight">InstaPay via PDAX</p>
              </div>
            </div>
            {(step === 'form' || step === 'awaiting_payment') && (
              <button onClick={onClose} className="text-white/60 hover:text-white">
                <X size={22} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* STEP 1 — FORM */}
            {step === 'form' && (
              <motion.div key="form"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fund your vault with pesos through PDAX InstaPay. Your payment is converted to XLM at the live PDAX rate and credited to your locked health vault on Stellar.
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
                  {parsedPhp >= 100 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-blue-50 border border-blue-100 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-blue-700">
                            ₱{fmtPhp(parsedPhp)} PHP
                          </p>
                          <p className="text-xs text-blue-400">you receive</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#007DFF]">{fmtAsset(usdcOut)} XLM</p>
                          <span className={`inline-block text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                            rateSource === 'pdax_live'
                              ? 'text-blue-700 bg-blue-100'
                              : 'text-amber-700 bg-amber-100'
                          }`}>
                            {rateSource === 'pdax_live'
                              ? `Live PDAX rate · ₱${fmtPhp(quote?.rate ?? 0)}/XLM`
                              : 'Indicative rate'}
                          </span>
                        </div>
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
                  onClick={handleCreateDeposit}
                  disabled={parsedPhp < 100}
                  className="w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 active:scale-[0.98] disabled:opacity-40 text-white font-semibold text-sm transition-all"
                >
                  {parsedPhp >= 100 ? `Pay ₱${fmtPhp(parsedPhp)} via InstaPay` : 'Enter at least ₱100'}
                </button>
              </motion.div>
            )}

            {/* STEP 1.5 — CREATING */}
            {step === 'creating' && (
              <motion.div key="creating"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-4"
              >
                <Loader2 size={40} className="text-[#007DFF] animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Creating InstaPay checkout…</p>
                  <p className="text-xs text-slate-400 mt-1">Connecting to PDAX</p>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — AWAITING PAYMENT */}
            {step === 'awaiting_payment' && (
              <motion.div key="awaiting"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-500 uppercase tracking-wide font-semibold mb-1">Complete your payment</p>
                  <p className="text-2xl font-bold text-blue-700">₱{fmtPhp(parsedPhp)}</p>
                  <p className="text-xs text-blue-400 mt-1">= {fmtAsset(usdcOut)} XLM to your vault</p>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Open the secure PDAX InstaPay checkout to pay. After paying, tap "I have paid" and we will credit your vault with XLM on Stellar.
                </p>

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

                {error && (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={polling}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={15} /> I have paid, credit my vault
                </button>
              </motion.div>
            )}

            {/* STEP 3 — CREDITING */}
            {step === 'crediting' && (
              <motion.div key="crediting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-4"
              >
                <Loader2 size={40} className="text-[#007DFF] animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Confirming payment and crediting vault…</p>
                  <p className="text-xs text-slate-400 mt-1">Verifying with PDAX, then settling XLM on Stellar</p>
                </div>
              </motion.div>
            )}

            {/* STEP 4 — DONE */}
            {step === 'done' && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center gap-4 text-center"
              >
                <CheckCircle size={48} className="text-emerald-500" />
                <div>
                  <p className="font-bold text-slate-900 text-lg">Vault credited!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {fmtAsset(creditedUsdc ?? usdcOut)} XLM added to your locked health vault.
                  </p>
                </div>

                <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                  Stellar {networkBadgeLabel()}
                </span>

                {txHash && explorerTxUrl(txHash) && (
                  <a
                    href={explorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 font-mono break-all max-w-full"
                  >
                    <ExternalLink size={12} className="shrink-0" /> Verify on Stellar: {txHash.slice(0, 16)}…
                  </a>
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
