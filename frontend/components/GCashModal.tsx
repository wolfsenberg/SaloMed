'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { X, Loader2, CheckCircle, Zap, ArrowDownToLine } from 'lucide-react';
import { saveTx } from '@/lib/transactions';
import { API_URL, PHP_PER_USDC } from '@/lib/config';

interface LocalQRResult {
  reference_id: string;
  qr_payload:   string;
  amount_php:   number;
  amount_xlm:   number;
}

interface Props {
  beneficiaryAddress: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'qr' | 'processing' | 'done';

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export default function GCashModal({ beneficiaryAddress, onClose, onSuccess }: Props) {
  const [step, setStep]               = useState<Step>('form');
  const [gcashNumber, setGcashNumber] = useState('');
  const [amountPhp, setAmountPhp]     = useState('');
  const [rate, setRate]               = useState(PHP_PER_USDC);
  const [rateSource, setRateSource]   = useState<'fixed_demo' | 'configured_indicative'>('fixed_demo');
  const [result, setResult]           = useState<LocalQRResult | null>(null);
  const [ledgerReference, setLedgerReference] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number; source?: string }) => {
        if (d.php_per_usdc > 0) setRate(d.php_per_usdc);
        setRateSource(d.source === 'configured_indicative' ? 'configured_indicative' : 'fixed_demo');
      })
      .catch(() => {
        console.warn('[GCashModal] Failed to fetch display rate, using default:', PHP_PER_USDC);
      });
  }, []);

  const parsedPhp = parseFloat(amountPhp) || 0;
  const xlmAmount = parsedPhp > 0 ? (parsedPhp / (rate || 56)).toFixed(2) : '—';

  function buildQRResult(): LocalQRResult {
    const refId  = 'SM' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const amtXlm = parseFloat((parsedPhp / rate).toFixed(2));
    const payload =
      `00020101021226570011ph.ppmi.www0116${gcashNumber}` +
      `520400005303608540${parsedPhp.toFixed(2)}5802PH` +
      `5916SALOMED VAULT6304${refId}`;
    return { reference_id: refId, qr_payload: payload, amount_php: parsedPhp, amount_xlm: amtXlm };
  }

  function handleGenerateQR() {
    if (!/^09\d{9}$/.test(gcashNumber)) {
      setError('Enter a valid GCash number (09XXXXXXXXX).'); return;
    }
    if (parsedPhp < 1) {
      setError('Minimum top-up is ₱1.'); return;
    }
    setError(null);
    setResult(buildQRResult());
    setStep('qr');
  }

  async function handleSimulatePayment() {
    if (!result) return;
    setStep('processing');

    try {
      // Fund the vault on-chain. In Stellar mode the USER signs
      // deposit_remittance in Freighter (real tx hash); vault increases only
      // after confirmed on-chain success. Demo mode credits the durable ledger.
      const { depositToVault } = await import('@/lib/contract');
      const hash = await depositToVault(beneficiaryAddress, result.amount_xlm, 'gcash');

      // Backend already records the top-up in the address-keyed history index.
      setLedgerReference(hash);
      saveTx(beneficiaryAddress, {
        type:      'topup',
        amountXlm: result.amount_xlm,
        amountPhp: result.amount_php,
        gcashRef:  result.reference_id,
        txHash:    hash,
        status:    'success',
      });

      window.dispatchEvent(new CustomEvent('salomed_tx_update', {
        detail: { address: beneficiaryAddress.toUpperCase() },
      }));

      setStep('done');
      setTimeout(() => { onSuccess(); }, 1500);

    } catch (e: unknown) {
      console.error('GCash top-up failed:', e);
      setError(e instanceof Error ? e.message : 'Top-up failed. Please retry.');
      setStep('qr');
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
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-[#007DFF] font-black text-base">G</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Vault Top-Up</p>
                <p className="font-bold text-base leading-tight">GCash</p>
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

            {/* STEP 1 — Form */}
            {step === 'form' && (
              <motion.div key="form"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                    GCash Number
                  </label>
                  <input
                    value={gcashNumber}
                    onChange={e => { setGcashNumber(e.target.value); setError(null); }}
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    inputMode="numeric"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#007DFF] focus:bg-white rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                    <input
                      value={amountPhp}
                      onChange={e => { setAmountPhp(e.target.value); setError(null); }}
                      type="number" min="1" step="1" placeholder="0"
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
                        ₱{n.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {parsedPhp > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-blue-700">
                          ₱{parsedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2 })} PHP
                        </p>
                        <p className="text-xs text-blue-400">
                          ₱{rate.toFixed(2)} = 1 XLM
                          {rateSource === 'configured_indicative' && (
                            <span className="ml-1 text-amber-600 font-semibold">· indicative</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#007DFF]">{xlmAmount}</p>
                        <p className="text-xs text-blue-400">XLM to your vault</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <ArrowDownToLine size={16} className="text-slate-400 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-xs text-slate-400">Credits vault of</p>
                    <p className="text-xs font-mono text-slate-600 truncate">{beneficiaryAddress}</p>
                  </div>
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                  onClick={handleGenerateQR}
                  className="w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold text-sm transition-all"
                >
                  Generate QR Code
                </button>
              </motion.div>
            )}

            {/* STEP 2 — QR */}
            {step === 'qr' && result && (
              <motion.div key="qr"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <p className="font-bold text-slate-900 text-base">GCash QR</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Scan with GCash to fund your vault</p>
                </div>

                <div className="flex justify-center">
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm inline-block">
                    <QRCodeSVG
                      value={result.qr_payload}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                      level="M"
                      imageSettings={{
                        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' rx='4' fill='%23007DFF'/%3E%3Ctext x='10' y='14' text-anchor='middle' font-size='12' font-weight='900' fill='white' font-family='Arial'%3EG%3C/text%3E%3C/svg%3E",
                        height: 28, width: 28, excavate: true,
                      }}
                    />
                    <p className="text-center text-xs font-mono text-slate-400 mt-2 tracking-wider">
                      {result.reference_id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'You send',   value: `₱${result.amount_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
                    { label: 'Vault gets', value: `${result.amount_xlm} XLM` },
                  ].map(pill => (
                    <div key={pill.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400">{pill.label}</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{pill.value}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSimulatePayment}
                  className="w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={15} /> Confirm Payment
                </button>
              </motion.div>
            )}

            {/* STEP 3 — Processing */}
            {step === 'processing' && (
              <motion.div key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-4"
              >
                <Loader2 size={40} className="text-[#007DFF] animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Processing payment…</p>
                  <p className="text-xs text-slate-400 mt-1">Crediting your vault</p>
                </div>
              </motion.div>
            )}

            {/* STEP 4 — Done */}
            {step === 'done' && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center gap-4 text-center"
              >
                <CheckCircle size={48} className="text-green-500" />
                <div>
                  <p className="font-bold text-slate-900 text-lg">
                    Top-up Successful!
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {`Top-up recorded: ₱${result?.amount_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })} → ${result?.amount_xlm} XLM`
                    }
                  </p>
                </div>

                {ledgerReference && (
                  <div className="max-w-full text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Reference</p>
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
