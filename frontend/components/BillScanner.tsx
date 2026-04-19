'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scanBill, BillScanResult } from '@/lib/api';
import PayModal from '@/components/PayModal';
import LoanModal from '@/components/LoanModal';
import type { HealthVault } from '@/lib/contract';

interface Props {
  address: string | null;
  vault: HealthVault;
  onPaySuccess: () => void;
}

const php = (n: number) =>
  '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });

export default function BillScanner({ address, vault, onPaySuccess }: Props) {
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState<BillScanResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [modal, setModal]       = useState<'pay' | 'loan' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function process(file: File) {
    setError(null);
    setResult(null);
    setScanning(true);
    try {
      setResult(await scanBill(file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed — is the backend running?');
    } finally {
      setScanning(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) process(file);
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !scanning && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all select-none ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) process(f); e.target.value = ''; }}
        />
        <div className="text-5xl mb-4">
          {scanning ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="inline-block"
            >⏳</motion.span>
          ) : '🏥'}
        </div>
        {scanning ? (
          <p className="text-sm font-semibold text-blue-600">Scanning bill with OCR…</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700">Drop hospital bill image here</p>
            <p className="text-xs text-slate-400 mt-1">or tap to upload · PNG JPG WEBP · max 10 MB</p>
          </>
        )}
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-3"
          >
            <p className="text-xs text-red-600">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Bill Breakdown</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                result.ocr_mode === 'real'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {result.ocr_mode === 'real' ? '✓ OCR Scan' : '⚡ Demo Mode'}
              </span>
            </div>

            {/* Line items */}
            <div className="px-5 py-4 space-y-3">
              {[
                { label: 'Total Hospital Bill',  value: result.total_bill,            color: 'text-slate-800', sign: '' },
                { label: 'PhilHealth Benefit',   value: result.philhealth_deduction,  color: 'text-emerald-600', sign: '−' },
                { label: 'HMO Coverage',          value: result.hmo_deduction,         color: 'text-emerald-600', sign: '−' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>
                    {row.sign}{php(row.value)}
                  </span>
                </div>
              ))}

              {/* Gap total */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900">Out-of-Pocket Gap</span>
                  <p className="text-xs text-slate-400">Amount patient must cover</p>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {php(result.out_of_pocket_balance)}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={() => setModal('pay')}
                disabled={!address}
                title={!address ? 'Connect wallet first' : undefined}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-sm transition-all"
              >
                {address ? '💸 Pay Gap to Hospital' : 'Connect wallet to pay'}
              </button>

              <button
                onClick={() => setModal('loan')}
                disabled={!address}
                title={!address ? 'Connect wallet first' : undefined}
                className="w-full py-3 rounded-xl border-2 border-blue-600 text-blue-600 hover:bg-blue-50 active:scale-[0.98] disabled:border-slate-200 disabled:text-slate-400 font-semibold text-sm transition-all"
              >
                {address ? '🏦 Apply for Micro-Loan (Salo)' : 'Connect wallet to apply'}
              </button>

              <button
                onClick={() => { setResult(null); setError(null); }}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                ↺ Scan another bill
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'pay' && result && address && (
          <PayModal
            patientAddress={address}
            amountUsdc={result.out_of_pocket_balance}
            onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); setResult(null); onPaySuccess(); }}
          />
        )}
        {modal === 'loan' && result && address && (
          <LoanModal
            gapAmount={result.out_of_pocket_balance}
            vault={vault}
            patientAddress={address}
            onClose={() => setModal(null)}
            onSuccess={() => { setModal(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
