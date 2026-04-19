'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, ScanLine, Keyboard, Coins, ArrowLeftRight,
  CheckCircle, Loader2, AlertCircle, ChevronLeft,
  Copy, Check, Sparkles, Building2, FlaskConical, Star, Wallet,
} from 'lucide-react';
import type { HealthVault } from '@/lib/contract';
import { savingsXlm, POINTS_RATE, calcPayment } from '@/lib/contract';
import { saveTx } from '@/lib/transactions';
import QRScannerModal from '@/components/QRScannerModal';
import ProviderCombobox from '@/components/ProviderCombobox';

interface Props {
  address: string | null;
  vault: HealthVault;
  onSuccess: () => void;
}

type View         = 'home' | 'generate' | 'manual';
type ProviderType = 'hospital' | 'pharmacy';
type PayFrom      = 'vault' | 'savings';

const API_URL   = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const QUICK_AMT = [1, 5, 10, 25, 50];

export default function PaymentTab({ address, vault, onSuccess }: Props) {
  const [view, setView]                   = useState<View>('home');
  const [providerType, setProviderType]   = useState<ProviderType>('hospital');
  const [providerName, setProviderName]   = useState('');
  const [payFrom, setPayFrom]             = useState<PayFrom>('vault');
  const [showScanner, setShowScanner]     = useState(false);
  const [scannerOrigin, setScannerOrigin] = useState<View>('home');
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [amountXlm, setAmountXlm]         = useState('');
  const [showPhp, setShowPhp]             = useState(false);
  const [phpRate, setPhpRate]             = useState(56);
  const [copied, setCopied]               = useState(false);

  // Manual pay state
  const [manualAddress, setManualAddress] = useState('');
  const [manualAmount, setManualAmount]   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [txHash, setTxHash]               = useState<string | null>(null);
  const [done, setDone]                   = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => setPhpRate(d.php_per_usdc))
      .catch(() => {});
  }, []);

  const parsedXlm    = parseFloat(amountXlm) || 0;
  const parsedPhp    = parsedXlm * phpRate;
  const vaultXlm     = Number(vault.balance) / 10_000_000;
  const savingsBalance = savingsXlm(vault);
  const activeBalance  = payFrom === 'vault' ? vaultXlm : savingsBalance;
  const pointsRate     = POINTS_RATE[providerType];

  const manualParsed    = parseFloat(manualAmount) || 0;
  const manualParsedPhp = manualParsed * phpRate;

  const genBreakdown    = calcPayment(parsedXlm, providerType);
  const manualBreakdown = calcPayment(manualParsed, providerType);

  function openScanner(from: View) {
    setScannerOrigin(from);
    setShowScanner(true);
  }

  function handleQRDetected(value: string) {
    const match = value.match(/G[A-Z0-9]{55}/);
    if (match) {
      setManualAddress(match[0]);
      setView('manual');
    }
  }

  async function handleGeneratePay() {
    if (!address) { setError('Connect your wallet first.'); return; }
    if (parsedXlm <= 0) { setError('Enter a positive amount.'); return; }
    if (!manualAddress.trim()) { setError('Select a provider first.'); return; }
    setError(null);
    setGenSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/payment/pay-hospital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_address: address,
          hospital_id:     manualAddress.trim(),
          amount_usdc:     parsedXlm,
          provider_type:   providerType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.detail === 'object' ? data.detail.message : (data.detail ?? 'Payment failed');
        throw new Error(msg);
      }
      setTxHash(data.stellar_tx_hash ?? null);
      saveTx(address, {
        type: 'payment', amountXlm: parsedXlm, amountPhp: parsedPhp,
        providerName: providerName || undefined, providerType, payFrom,
        ptsEarned: genBreakdown.ptsEarned, txHash: data.stellar_tx_hash ?? undefined, status: 'success',
      });
      setDone(true);
      setTimeout(onSuccess, 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed.');
    } finally {
      setGenSubmitting(false);
    }
  }

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleManualPay() {
    if (!address) { setError('Connect your Freighter wallet first.'); return; }
    if (manualParsed <= 0) { setError('Enter a positive amount.'); return; }
    if (!manualAddress.trim()) { setError('Enter a Stellar address.'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/payment/pay-hospital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_address: address,
          hospital_id:     manualAddress.trim(),
          amount_usdc:     manualParsed,
          provider_type:   providerType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.detail === 'object'
          ? data.detail.message
          : (data.detail ?? 'Payment failed');
        throw new Error(msg);
      }
      setTxHash(data.stellar_tx_hash ?? null);
      saveTx(address, {
        type:         'payment',
        amountXlm:    manualParsed,
        amountPhp:    manualParsedPhp,
        providerName: providerName || undefined,
        providerType,
        payFrom,
        ptsEarned:    manualBreakdown.ptsEarned,
        txHash:       data.stellar_tx_hash ?? undefined,
        status:       'success',
      });
      setDone(true);
      setTimeout(onSuccess, 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed — check backend connection.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setView('home');
    setAmountXlm('');
    setManualAddress('');
    setManualAmount('');
    setError(null);
    setTxHash(null);
    setDone(false);
  }

  // ── No wallet connected ────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <QrCode size={32} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Connect Wallet to Pay</h2>
        <p className="text-sm text-slate-500 max-w-[280px]">
          Connect your Freighter wallet to generate QR codes and make payments.
        </p>
      </div>
    );
  }

  // ── Payment success screen ─────────────────────────────────────────────────
  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle size={36} className="text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900">Payment Sent!</h3>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{manualParsed.toFixed(4)} XLM</span>
            {' '}(≈ ₱{manualParsedPhp.toFixed(2)}) sent successfully.
          </p>
        </div>
        {txHash && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-500 break-all max-w-xs">
            {typeof txHash === 'string' ? txHash.slice(0, 60) : JSON.stringify(txHash).slice(0, 60)}
          </div>
        )}
        <p className="text-xs text-slate-400">Returning to vault…</p>
      </motion.div>
    );
  }

  // ── QR payload for Generate QR ─────────────────────────────────────────────
  const qrPayloadString = `SALOMED:${JSON.stringify({
    patient: address,
    hospital: manualAddress || address,
    amount_usdc: parsedXlm,
    provider_name: providerName || 'SaloMed Patient',
    provider_type: providerType,
  })}`;

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

      {/* QR Scanner overlay */}
      <AnimatePresence>
        {showScanner && (
          <QRScannerModal
            onDetected={handleQRDetected}
            onClose={() => { setShowScanner(false); setView(scannerOrigin); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════════ */}
        {/*  HOME — Main payment hub (GCash-style)               */}
        {/* ══════════════════════════════════════════════════════ */}
        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Balance header */}
            <div className="gradient-brand rounded-2xl p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1.5">
                <Sparkles size={11} /> Available Balance
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {vaultXlm.toFixed(4)}
                    <span className="text-lg font-normal text-blue-200 ml-2">XLM</span>
                  </p>
                  <p className="text-xs text-blue-300 mt-0.5">
                    ≈ ₱{(vaultXlm * phpRate).toFixed(2)} PHP
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-300 font-mono mt-2 truncate">
                {address.slice(0, 10)}…{address.slice(-10)}
              </p>
            </div>

            {/* Action buttons — GCash style */}
            <div className="grid grid-cols-3 gap-3">
              {/* Generate QR */}
              <button
                onClick={() => setView('generate')}
                className="bg-white rounded-2xl shadow-card border border-slate-100 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-blue-200 active:scale-[0.97] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                  <QrCode size={22} className="text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Generate</p>
                  <p className="text-xs font-bold text-slate-800 leading-tight">QR</p>
                </div>
              </button>

              {/* Scan QR */}
              <button
                onClick={() => openScanner('home')}
                className="bg-white rounded-2xl shadow-card border border-slate-100 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-blue-200 active:scale-[0.97] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                  <ScanLine size={22} className="text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Scan</p>
                  <p className="text-xs font-bold text-slate-800 leading-tight">QR</p>
                </div>
              </button>

              {/* Send via Address */}
              <button
                onClick={() => setView('manual')}
                className="bg-white rounded-2xl shadow-card border border-slate-100 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-blue-200 active:scale-[0.97] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                  <Keyboard size={22} className="text-violet-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 leading-tight">Send via</p>
                  <p className="text-xs font-bold text-slate-800 leading-tight">Address</p>
                </div>
              </button>
            </div>

            {/* My Receive QR — always visible */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <QrCode size={12} /> My Wallet QR
              </p>
              <div className="flex flex-col items-center gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <QRCodeSVG value={address} size={150} level="M" includeMargin />
                </div>
                <p className="text-xs text-slate-400 text-center max-w-[240px]">
                  Share this QR code to receive payments to your vault
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg px-3 py-2 transition-colors"
                >
                  {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Address</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/*  GENERATE QR — Create a payment QR for cashier       */}
        {/* ══════════════════════════════════════════════════════ */}
        {view === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="space-y-4"
          >
            {/* Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetAll}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Generate Payment QR</h2>
                <p className="text-xs text-slate-400">Enter amount, then show QR to the cashier</p>
              </div>
            </div>

            {/* Amount input */}
            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-4">

              {/* Provider type */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { t: 'hospital' as ProviderType, Icon: Building2, label: 'Hospital', pts: '2 pts/XLM' },
                  { t: 'pharmacy' as ProviderType, Icon: FlaskConical, label: 'Pharmacy', pts: '1 pt/XLM' },
                ] as const).map(({ t, Icon, label, pts }) => (
                  <button key={t} onClick={() => setProviderType(t)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                      providerType === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    <div className="text-left">
                      <p className="text-xs font-bold leading-none">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pts}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Provider search */}
              <ProviderCombobox
                providerType={providerType}
                value={providerName}
                onChange={(name, addr) => {
                  setProviderName(name);
                  setManualAddress(addr);
                }}
              />

              {/* Pay from */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { f: 'vault' as PayFrom,   Icon: Wallet,    label: 'Vault Balance', bal: `${vaultXlm.toFixed(2)} XLM` },
                  { f: 'savings' as PayFrom, Icon: Star,      label: 'Vault Savings', bal: `${savingsBalance.toFixed(2)} XLM` },
                ] as const).map(({ f, Icon, label, bal }) => (
                  <button key={f} onClick={() => setPayFrom(f)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                      payFrom === f ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={15} />
                    <div className="text-left">
                      <p className="text-[10px] text-slate-400 leading-none">{label}</p>
                      <p className="text-xs font-bold mt-0.5">{bal}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Coins size={11} /> Payment Amount
                </label>
                <button
                  onClick={() => setShowPhp(v => !v)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold"
                >
                  <ArrowLeftRight size={11} /> {showPhp ? 'XLM' : 'PHP'}
                </button>
              </div>

              {showPhp ? (
                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                    <input
                      value={amountXlm ? String(parseFloat(amountXlm) * phpRate) : ''}
                      onChange={e => {
                        const php = parseFloat(e.target.value) || 0;
                        setAmountXlm(php > 0 ? String(php / phpRate) : '');
                      }}
                      type="number" min="0" step="1" placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-8 pr-16 py-3.5 text-xl font-bold text-slate-800 placeholder-slate-300 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">PHP</span>
                  </div>
                  {parsedXlm > 0 && (
                    <p className="text-xs text-slate-400 text-right">= {parsedXlm.toFixed(4)} XLM</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      value={amountXlm}
                      onChange={e => setAmountXlm(e.target.value)}
                      type="number" min="0" step="0.0001" placeholder="0.0000"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 pr-16 py-3.5 text-xl font-bold text-slate-800 placeholder-slate-300 outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">XLM</span>
                  </div>
                  {parsedXlm > 0 && (
                    <p className="text-xs text-slate-400 text-right">≈ ₱{parsedPhp.toFixed(2)} PHP</p>
                  )}
                </div>
              )}

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMT.map(n => (
                  <button
                    key={n}
                    onClick={() => setAmountXlm(String(n))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      parsedXlm === n
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Balance / full breakdown */}
              {parsedXlm > 0 ? (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 space-y-1.5 text-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">You pay</span>
                    <span className="font-semibold text-slate-700">{parsedXlm.toFixed(4)} XLM</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform fee ({(genBreakdown.feeRate * 100).toFixed(1)}%)</span>
                    <span>−{genBreakdown.salomedFee.toFixed(4)} XLM</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Merchant receives</span>
                    <span>{genBreakdown.merchantReceives.toFixed(4)} XLM</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 space-y-1">
                    <div className="flex justify-between text-blue-600 font-semibold">
                      <span className="flex items-center gap-1"><Star size={10} /> Cashback earned</span>
                      <span>+{genBreakdown.ptsEarned} pts ≈ {genBreakdown.cashbackXlm.toFixed(4)} XLM</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Net cost to you</span>
                      <span>{genBreakdown.effectiveCost.toFixed(4)} XLM</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">{payFrom === 'vault' ? 'Vault balance' : 'Savings balance'}</span>
                  <span className="text-xs font-semibold text-slate-600">{activeBalance.toFixed(4)} XLM</span>
                </div>
              )}

              {parsedXlm > activeBalance && activeBalance > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Amount exceeds {payFrom === 'vault' ? 'vault' : 'savings'} balance ({activeBalance.toFixed(4)} XLM).
                  </p>
                </div>
              )}
            </div>

            {/* Generated QR Code — requires provider + amount */}
            <AnimatePresence mode="wait">
              {parsedXlm > 0 && manualAddress.trim() ? (
                <motion.div
                  key="qr-ready"
                  initial={{ opacity: 0, y: 16, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 16, height: 0 }}
                  className="bg-white rounded-2xl shadow-card border border-slate-100 p-5"
                >
                  <div className="flex flex-col items-center gap-4">
                    {/* QR */}
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5">
                      <QRCodeSVG value={qrPayloadString} size={200} level="M" includeMargin />
                    </div>

                    {/* Info */}
                    <div className="text-center space-y-1.5">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <p className="text-sm font-bold text-slate-800">Ready to Scan</p>
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{providerName}</p>
                      <p className="text-2xl font-bold text-blue-600">{parsedXlm.toFixed(4)} XLM</p>
                      <p className="text-xs text-slate-400">≈ ₱{parsedPhp.toFixed(2)} PHP</p>
                      <p className="text-xs text-slate-400 max-w-[240px] mx-auto mt-1">
                        Show this QR to the cashier, or tap Confirm below once the cashier has scanned it.
                      </p>
                    </div>

                    {/* From address */}
                    <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-slate-400">From</span>
                      <span className="text-xs font-mono text-slate-500">{address.slice(0, 6)}…{address.slice(-6)}</span>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="w-full flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3"
                        >
                          <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-600">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Confirm payment button */}
                    <button
                      onClick={handleGeneratePay}
                      disabled={genSubmitting}
                      className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      {genSubmitting
                        ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                        : <><CheckCircle size={15} /> Confirm Payment Sent</>
                      }
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="qr-empty" className="flex flex-col items-center gap-2 py-8 text-center">
                  <QrCode size={40} className="text-slate-200" />
                  <p className="text-sm text-slate-400">
                    {parsedXlm <= 0
                      ? 'Enter an amount to generate your payment QR'
                      : 'Select a hospital or pharmacy above to generate the QR'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/*  MANUAL — Send via Stellar Address                   */}
        {/* ══════════════════════════════════════════════════════ */}
        {view === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="space-y-4"
          >
            {/* Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetAll}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Send to Address</h2>
                <p className="text-xs text-slate-400">Pay directly using a Stellar address</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-4">

              {/* Provider type */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { t: 'hospital' as ProviderType, Icon: Building2, label: 'Hospital', pts: '2 pts/XLM' },
                  { t: 'pharmacy' as ProviderType, Icon: FlaskConical, label: 'Pharmacy', pts: '1 pt/XLM' },
                ] as const).map(({ t, Icon, label, pts }) => (
                  <button key={t} onClick={() => setProviderType(t)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                      providerType === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={16} />
                    <div className="text-left">
                      <p className="text-xs font-bold leading-none">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pts}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Provider search */}
              <ProviderCombobox
                providerType={providerType}
                value={providerName}
                onChange={(name, addr) => {
                  setProviderName(name);
                  setManualAddress(addr);
                  setError(null);
                }}
              />

              {/* Pay from */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  { f: 'vault' as PayFrom,   Icon: Wallet,    label: 'Vault Balance', bal: `${vaultXlm.toFixed(2)} XLM` },
                  { f: 'savings' as PayFrom, Icon: Star,      label: 'Vault Savings', bal: `${savingsBalance.toFixed(2)} XLM` },
                ] as const).map(({ f, Icon, label, bal }) => (
                  <button key={f} onClick={() => setPayFrom(f)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                      payFrom === f ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon size={15} />
                    <div className="text-left">
                      <p className="text-[10px] text-slate-400 leading-none">{label}</p>
                      <p className="text-xs font-bold mt-0.5">{bal}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Stellar address — auto-filled by combobox or enter manually */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
                  Recipient Stellar Address
                </label>
                <input
                  value={manualAddress}
                  onChange={e => { setManualAddress(e.target.value); setError(null); }}
                  placeholder="GABC…XYZ (auto-filled from search above)"
                  spellCheck={false}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 outline-none transition-all"
                />
                <button
                  onClick={() => openScanner('manual')}
                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-semibold"
                >
                  <ScanLine size={11} /> Scan QR instead
                </button>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Coins size={11} /> Amount
                  </label>
                </div>
                <div className="relative">
                  <input
                    value={manualAmount}
                    onChange={e => setManualAmount(e.target.value)}
                    type="number" min="0" step="0.0001" placeholder="0.0000"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 pr-16 py-3 text-lg font-bold text-slate-800 placeholder-slate-300 outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">XLM</span>
                </div>
                {manualParsed > 0 && (
                  <p className="text-xs text-slate-400 text-right">≈ ₱{manualParsedPhp.toFixed(2)} PHP</p>
                )}
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMT.map(n => (
                  <button
                    key={n}
                    onClick={() => setManualAmount(String(n))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${
                      manualParsed === n
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Balance / full breakdown */}
              {manualParsed > 0 ? (
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 space-y-1.5 text-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">You pay</span>
                    <span className="font-semibold text-slate-700">{manualParsed.toFixed(4)} XLM</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform fee ({(manualBreakdown.feeRate * 100).toFixed(1)}%)</span>
                    <span>−{manualBreakdown.salomedFee.toFixed(4)} XLM</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Merchant receives</span>
                    <span>{manualBreakdown.merchantReceives.toFixed(4)} XLM</span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 space-y-1">
                    <div className="flex justify-between text-blue-600 font-semibold">
                      <span className="flex items-center gap-1"><Star size={10} /> Cashback earned</span>
                      <span>+{manualBreakdown.ptsEarned} pts ≈ {manualBreakdown.cashbackXlm.toFixed(4)} XLM</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Net cost to you</span>
                      <span>{manualBreakdown.effectiveCost.toFixed(4)} XLM</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">{payFrom === 'vault' ? 'Vault balance' : 'Savings balance'}</span>
                  <span className="text-xs font-semibold text-slate-600">{activeBalance.toFixed(4)} XLM</span>
                </div>
              )}

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

              {/* Pay button */}
              <button
                onClick={handleManualPay}
                disabled={submitting || !address || manualParsed <= 0}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
                  : <><Coins size={15} /> Send {manualParsed > 0 ? `${manualParsed.toFixed(4)} XLM` : 'Payment'}</>
                }
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
