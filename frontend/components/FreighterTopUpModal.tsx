'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, Wallet, AlertCircle, ArrowDownToLine, Zap } from 'lucide-react';
import { connectWallet } from '@/lib/freighter';
import { saveTx } from '@/lib/transactions';

const API_URL      = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const QUICK_AMOUNTS = [1, 5, 10, 25, 50];

interface Props {
  address: string;         // vault beneficiary (the logged-in user)
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'form' | 'connecting' | 'processing' | 'done';

export default function FreighterTopUpModal({ address, onClose, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('form');
  const [amountXlm, setAmountXlm] = useState('');
  const [phpRate, setPhpRate]     = useState(56);
  const [error, setError]         = useState<string | null>(null);
  const [txHash, setTxHash]       = useState<string | null>(null);
  const [signerAddress, setSignerAddress] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => setPhpRate(d.php_per_usdc))
      .catch(() => {});
  }, []);

  const parsedXlm = parseFloat(amountXlm) || 0;
  const parsedPhp = parsedXlm * phpRate;

  async function handleTopUp() {
    if (parsedXlm <= 0) { setError('Enter a positive amount.'); return; }
    setError(null);

    setStep('processing');
    try {
      const { depositToVault } = await import('@/lib/contract');
      const hash = await depositToVault(address, parsedXlm);
      
      setTxHash(hash);
      saveTx(address, {
        type:      'topup',
        amountXlm: parsedXlm,
        amountPhp: parsedPhp,
        txHash:    hash,
        status:    'success',
      });
      setStep('done');
      setTimeout(onSuccess, 2200);

    } catch (e: unknown) {
      console.error('Top-up failed:', e);
      setError(e instanceof Error ? e.message : 'Top-up failed — ensure you have XLM in your wallet.');
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
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="bg-blue-600 px-6 pt-5 pb-5 text-white">
          <div className="w-10 h-1 bg-white/30 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Wallet size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Vault Top-Up</p>
                <p className="font-bold text-base leading-tight">Freighter Wallet</p>
              </div>
            </div>
            {step === 'form' && (
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X size={22} />
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">

            {/* ── FORM ────────────────────────────────────────────── */}
            {step === 'form' && (
              <motion.div key="form"
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                    Amount (XLM)
                  </label>
                  <div className="relative">
                    <input
                      value={amountXlm}
                      onChange={e => { setAmountXlm(e.target.value); setError(null); }}
                      type="number" min="0" step="0.0001" placeholder="0.0000"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 pr-16 py-3 text-xl font-bold text-slate-800 placeholder-slate-300 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">XLM</span>
                  </div>
                  {parsedXlm > 0 && (
                    <p className="text-xs text-slate-400 text-right">≈ ₱{parsedPhp.toFixed(2)} PHP</p>
                  )}
                  <div className="flex gap-2">
                    {QUICK_AMOUNTS.map(n => (
                      <button
                        key={n}
                        onClick={() => { setAmountXlm(String(n)); setError(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          parsedXlm === n
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <ArrowDownToLine size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <div className="overflow-hidden">
                    <p className="text-xs text-slate-400">Credits vault of</p>
                    <p className="text-xs font-mono text-slate-600 truncate">{address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <Zap size={13} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Freighter will open to confirm your wallet identity. The top-up is then
                    executed on-chain via the SaloMed admin key. Make sure Freighter is set
                    to <strong>Testnet</strong>.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
                    >
                      <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleTopUp}
                  disabled={parsedXlm <= 0}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Wallet size={15} /> Top Up with Freighter
                </button>
              </motion.div>
            )}

            {/* ── CONNECTING ──────────────────────────────────────── */}
            {step === 'connecting' && (
              <motion.div key="connecting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center gap-5"
              >
                <Loader2 size={48} className="text-blue-600 animate-spin" />
                <div className="text-center">
                  <p className="font-bold text-slate-900">Opening Freighter…</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Approve the connection in the Freighter extension popup.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── PROCESSING ──────────────────────────────────────── */}
            {step === 'processing' && (
              <motion.div key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center gap-5"
              >
                <Loader2 size={48} className="text-blue-600 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="font-bold text-slate-900">Processing Top-Up…</p>
                  <p className="text-xs text-slate-500">Executing on-chain deposit…</p>
                  {signerAddress && (
                    <p className="text-[10px] font-mono text-slate-400 mt-2">
                      Signer: {signerAddress.slice(0, 8)}…{signerAddress.slice(-8)}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── DONE ────────────────────────────────────────────── */}
            {step === 'done' && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="py-8 flex flex-col items-center gap-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                >
                  <CheckCircle size={56} className="text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Vault Top-Up</p>
                  <p className="text-lg font-bold text-slate-900">Top-Up Confirmed!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{parsedXlm.toFixed(4)} XLM</span>
                    {' '}(≈ ₱{parsedPhp.toFixed(2)}) credited to your vault.
                  </p>
                </div>
                {signerAddress && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                    <Wallet size={12} className="text-blue-500 shrink-0" />
                    <p className="text-xs font-mono text-blue-600">
                      {signerAddress.slice(0, 8)}…{signerAddress.slice(-8)}
                    </p>
                  </div>
                )}
                {txHash && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 break-all max-w-xs">
                    {typeof txHash === 'string' ? txHash.slice(0, 40) : JSON.stringify(txHash).slice(0, 40)}…
                  </div>
                )}
                <p className="text-xs text-slate-400">Returning to dashboard…</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
