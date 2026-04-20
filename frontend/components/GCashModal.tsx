'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { X, Loader2, CheckCircle, Zap, ArrowDownToLine } from 'lucide-react';
import { saveTx } from '@/lib/transactions';

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
import { API_URL, PHP_PER_XLM } from '@/lib/config';

export default function GCashModal({ beneficiaryAddress, onClose, onSuccess }: Props) {
  const [step, setStep]               = useState<Step>('form');
  const [gcashNumber, setGcashNumber] = useState('09171234567');
  const [amountPhp, setAmountPhp]     = useState('');
  const [rate, setRate]               = useState(PHP_PER_XLM);
  const [result, setResult]           = useState<LocalQRResult | null>(null);
  const [txHash, setTxHash]           = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => {
          if (d.php_per_usdc > 0) setRate(d.php_per_usdc);
      })
      .catch(() => {
          console.warn('[GCashModal] Failed to fetch live rate, using default:', PHP_PER_XLM);
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

    // Save transaction IMMEDIATELY as pending — this ensures it always shows
    // in history even if the backend has a transient error.
    saveTx(beneficiaryAddress, {
      type:      'topup',
      amountXlm: result.amount_xlm,
      amountPhp: result.amount_php,
      gcashRef:  result.reference_id,
      txHash:    undefined,
      status:    'pending',
    });

    try {
      const { depositToVault } = await import('@/lib/contract');
      // The backend signs and submits the top-up using the admin keypair.
      // No Freighter signing required — backend wallet (SALOMED_SIGNER_SECRET) sends XLM to the user.
      const hash = await depositToVault(beneficiaryAddress, result.amount_xlm);
      
      setTxHash(hash);

      // Update the saved transaction from 'pending' → 'success' with the real tx hash
      saveTx(beneficiaryAddress, {
        type:      'topup',
        amountXlm: result.amount_xlm,
        amountPhp: result.amount_php,
        gcashRef:  result.reference_id,
        txHash:    hash,
        status:    'success',
      });

      // Dispatch a storage event to force TransactionsTab to refresh immediately
      window.dispatchEvent(new CustomEvent('salomed_tx_update', { detail: { address: beneficiaryAddress.toUpperCase() } }));

      setStep('done');
      // Call onSuccess after 1.5 seconds to let user see the success screen, then it
      // triggers refreshVault in the parent to update the balance on the dashboard.
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (e: unknown) {
      console.error('GCash top-up failed:', e);
      // Even on backend error, the pending tx is already saved — user can see it
      // in history and try again.
      setError(
        e instanceof Error
          ? e.message
          : 'Top-up failed. Check that the backend is running and SALOMED_SIGNER_SECRET is funded on testnet.'
      );

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
        {/* GCash header */}
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
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">GCash Number</label>
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
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Amount (PHP)</label>
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
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-blue-700">
                          ₱{parsedPhp.toLocaleString('en-PH', { minimumFractionDigits: 2 })} PHP
                        </p>
                        <p className="text-xs text-blue-400">₱{rate} = 1 XLM (demo rate)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#007DFF]">{xlmAmount}</p>
                        <p className="text-xs text-blue-400">XLM to vault</p>
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
                  <p className="font-bold text-slate-900 text-base">Scan with GCash</p>
                  <p className="text-xs text-slate-500 mt-0.5">Open GCash → Pay QR → Scan below</p>
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

                <div className="space-y-2">
                  <button
                    onClick={handleSimulatePayment}
                    className="w-full py-3.5 rounded-xl bg-[#007DFF] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Zap size={15} /> Confirm GCash Payment
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    Backend sends XLM to your wallet on Testnet — no Freighter needed
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Processing */}
            {step === 'processing' && (
              <motion.div key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-10 flex flex-col items-center gap-5"
              >
                <Loader2 size={48} className="text-[#007DFF] animate-spin" />
                <div className="text-center space-y-1">
                  <p className="font-bold text-slate-900">Processing GCash Payment</p>
                  <p className="text-xs text-slate-500 mt-1">Backend is signing and submitting to Stellar Testnet…</p>
                  <p className="text-xs text-slate-400">This takes 3–5 seconds</p>
                </div>
              </motion.div>
            )}

            {/* STEP 4 — Done */}
            {step === 'done' && result && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="py-8 flex flex-col items-center gap-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                >
                  <CheckCircle size={56} className="text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-lg font-bold text-slate-900">Payment Confirmed!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{result.amount_xlm.toFixed(2)} XLM</span> credited to your SaloMed Vault.
                  </p>
                </div>
                {txHash && (
                  <div className="space-y-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-400 break-all max-w-xs">
                      TX: {txHash.slice(0, 64)}
                    </div>
                    <a
                      href={`https://stellar.expert/explorer/testnet/account/${beneficiaryAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                    >
                      <Zap size={13} className="text-blue-400" />
                      View on Explorer
                    </a>
                  </div>
                )}
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400">
                  Ref: {result.reference_id}
                </div>
                <p className="text-xs text-slate-400">Returning to dashboard…</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
