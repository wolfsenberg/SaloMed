'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, ArrowDown, Coins, Lock, CheckCircle,
  Loader2, AlertCircle, Send, ArrowLeftRight, Star,
} from 'lucide-react';

interface Props {
  ofwAddress: string | null;
  vault: any; // HealthVault
  onSuccess: () => void;
  onSwitchTab: (tab: any) => void;
}

import { calcPadala, sendPadala } from '@/lib/contract';
import { saveTx } from '@/lib/transactions';
import { useTranslation } from '@/lib/i18n/LanguageContext';

import { API_URL } from '@/lib/config';

type RecipientMethod = 'gcash' | 'stellar';
type PayFrom = 'vault' | 'savings';

function isValidStellarAddress(addr: string) {
  return addr.startsWith('G') && addr.length === 56;
}

export default function RemittanceForm({ ofwAddress, vault, onSuccess, onSwitchTab }: Props) {
  const { t } = useTranslation();
  const [payFrom, setPayFrom] = useState<PayFrom>('vault');
  const [recipientMethod, setRecipientMethod] = useState<RecipientMethod>('gcash');
  const [beneficiary, setBeneficiary] = useState('');
  const [gcashNumber, setGcashNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [showPhp, setShowPhp] = useState(false);
  const [phpRate, setPhpRate] = useState(56);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => setPhpRate(d.php_per_usdc))
      .catch(() => { });
  }, []);

  function switchRecipient(m: RecipientMethod) {
    setRecipientMethod(m);
    setBeneficiary('');
    setGcashNumber('');
    setAmount('');
    setShowPhp(m === 'gcash'); // GCash recipient → input in PHP naturally
    setError(null);
  }

  // Balance calculation
  const vaultXlm = ofwAddress && vault ? Number(vault.balance) / 10_000_000 : 0;
  const savingsBalance = ofwAddress && vault ? Number(vault.salo_points) / 50 : 0;
  const activeBalance = payFrom === 'vault' ? vaultXlm : savingsBalance;
  
  // User can toggle between XLM and PHP input modes
  const isPhpMode = showPhp;

  const parsedXlm = isPhpMode
    ? (parseFloat(amount) || 0) / phpRate
    : (parseFloat(amount) || 0);
  const parsedPhp = parsedXlm * phpRate;
  const breakdown = calcPadala(parsedXlm);
  const pointsEarned = breakdown.ptsEarned;
  const isInsufficient = parsedXlm > activeBalance;

  async function handleSend() {
    if (recipientMethod === 'stellar' && !ofwAddress) {
      setError('Connect your Freighter wallet first.'); return;
    }
    if (recipientMethod === 'stellar' && !isValidStellarAddress(beneficiary)) {
      setError('Enter a valid Stellar address (G…, 56 chars).'); return;
    }
    if (recipientMethod === 'gcash' && !gcashNumber.trim()) {
      setError("Enter the recipient's GCash number."); return;
    }
    if (parsedXlm <= 0) { setError('Enter a positive amount.'); return; }

    const resolvedAddress = recipientMethod === 'stellar'
      ? beneficiary.trim()
      : 'GABC1DEMOPADALARECIPIENT1DEMOPADALARECIPIENT1DEMOPADALA1';

    setError(null);
    setSubmitting(true);
    try {
      let hash = '';

      // REAL ON-CHAIN SIGNING via Freighter for both GCash and Stellar methods
      hash = await sendPadala(ofwAddress, resolvedAddress, parsedXlm);

      setTxHash(hash);
      if (ofwAddress) {
        const sender = ofwAddress.toUpperCase();
        const recipient = (recipientMethod === 'stellar' ? beneficiary.trim() : resolvedAddress).toUpperCase();

        const senderLabel = sender.slice(0, 6) + '…' + sender.slice(-4);
        const recipientLabel = recipientMethod === 'gcash'
          ? gcashNumber
          : recipient.slice(0, 6) + '…' + recipient.slice(-4);

        // 1. Log for Sender (The current user)
        saveTx(sender, {
          type: 'padala',
          amountXlm: parsedXlm,
          amountPhp: parsedPhp,
          recipientMethod,
          recipientLabel,
          payFrom,
          ptsEarned: pointsEarned,
          txHash: hash || undefined,
          status: 'success',
          direction: 'sent',
        });

        // 2. Log for Recipient (If Stellar)
        if (recipientMethod === 'stellar') {
          const receivedAmountXlm = breakdown.recipientReceives;
          const receivedAmountPhp = receivedAmountXlm * phpRate;

          saveTx(recipient, {
            type: 'padala',
            amountXlm: receivedAmountXlm,
            amountPhp: receivedAmountPhp,
            recipientMethod: 'stellar',
            recipientLabel, // Recipient's own address
            senderLabel,    // The OFW who sent it
            txHash: hash || undefined,
            status: 'success',
            direction: 'received',
          });
        }
      }
      setDone(true);
      setTimeout(onSuccess, 3000);
    } catch (e: unknown) {
      console.error('Padala error:', e);
      setError(e instanceof Error ? e.message : 'Padala failed — check your wallet.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-5 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle size={36} className="text-emerald-500" />
        </div>
         <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-900">Padala Sent!</h3>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{parsedXlm.toFixed(2)} XLM</span>
            {' '}(≈ ₱{parsedPhp.toFixed(2)}) credited on-chain.
          </p>
        </div>
        {pointsEarned > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
            <Star size={14} className="text-blue-500" />
            <p className="text-xs font-semibold text-blue-700">+{pointsEarned} SaloPoints earned!</p>
          </div>
        )}
        {txHash && (
          <div className="space-y-2 w-full max-w-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-500 break-all">
              TX: {typeof txHash === 'string' ? txHash.slice(0, 64) : JSON.stringify(txHash).slice(0, 64)}
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/account/${ofwAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              <Globe size={13} />
              View on Explorer
            </a>
          </div>
        )}
        <p className="text-xs text-slate-400">Returning to vault…</p>
      </motion.div>
    );
  }

  if (!ofwAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 gap-6 w-full text-center">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center shadow-sm">
          <Lock size={36} className="text-blue-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">{t('connect_remit_title')}</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed mx-auto">
            {t('connect_remit_desc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="gradient-brand rounded-2xl p-5 text-white"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1.5">
          <Globe size={11} /> {t('nav_remittance')}
        </p>
        <h2 className="text-xl font-bold mb-1">{t('remit_title')}</h2>
        <p className="text-sm text-blue-100 leading-relaxed">
          {t('remit_desc')}
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-4"
      >
        {/* From — driven by recipient method */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">From</label>
          {recipientMethod === 'gcash' ? (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 border bg-blue-50 border-blue-200">
              <span className="w-5 h-5 rounded-md bg-[#007DFF] flex items-center justify-center text-white text-[10px] font-black shrink-0">G</span>
              <span className="text-sm text-blue-700 font-medium">Pay via GCash</span>
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${ofwAddress ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
              }`}>
              <Globe size={15} className={ofwAddress ? 'text-blue-500' : 'text-slate-400'} />
              <span className={`text-sm font-mono truncate ${ofwAddress ? 'text-blue-700' : 'text-slate-400'}`}>
                {ofwAddress ?? 'Connect wallet to autofill'}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-center text-slate-300">
          <ArrowDown size={20} />
        </div>

        {/* Recipient method */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
            To (Recipient)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchRecipient('gcash')}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all ${recipientMethod === 'gcash' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${recipientMethod === 'gcash' ? 'bg-[#007DFF] text-white' : 'bg-slate-100 text-slate-500'
                }`}>G</span>
              <p className={`text-xs font-bold ${recipientMethod === 'gcash' ? 'text-blue-700' : 'text-slate-700'}`}>GCash Number</p>
              <p className="text-[10px] text-slate-400">No Stellar needed</p>
            </button>
            <button
              type="button"
              onClick={() => switchRecipient('stellar')}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 px-2 transition-all ${recipientMethod === 'stellar' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${recipientMethod === 'stellar' ? 'bg-blue-500' : 'bg-slate-100'
                }`}>
                <Globe size={16} className={recipientMethod === 'stellar' ? 'text-white' : 'text-slate-500'} />
              </span>
              <p className={`text-xs font-bold ${recipientMethod === 'stellar' ? 'text-blue-700' : 'text-slate-700'}`}>Stellar Address</p>
              <p className="text-[10px] text-slate-400">Has a vault already</p>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {recipientMethod === 'gcash' ? (
              <motion.div key="gcash-recv"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="space-y-1"
              >
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">+63</span>
                  <input
                    value={gcashNumber}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setGcashNumber(val);
                      setError(null);
                    }}
                    type="tel"
                    maxLength={10}
                    placeholder="9XX XXX XXXX"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-12 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400">SaloMed maps this number to their vault.</p>
              </motion.div>
            ) : (
              <motion.div key="stellar-recv"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="space-y-1"
              >
                <input
                  value={beneficiary}
                  onChange={e => { setBeneficiary(e.target.value); setError(null); }}
                  placeholder="GABC…XYZ"
                  spellCheck={false}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 outline-none transition-all"
                />
                <p className="text-xs text-slate-400">Works for local family or overseas recipients.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Pay from selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">
              {t('pay_pay_from')}
            </label>
            <button
              type="button"
              onClick={() => { setShowPhp(v => !v); setError(null); }}
              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-bold uppercase tracking-wider"
            >
              <ArrowLeftRight size={10} />
              {showPhp ? 'Show XLM Bal' : 'Show PHP Bal'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              {
                f: 'vault' as PayFrom,
                Icon: Lock,
                label: 'Vault Balance',
                bal: showPhp
                  ? `₱${(vaultXlm * phpRate).toFixed(2)}`
                  : `${vaultXlm.toFixed(2)} XLM`
              },
              {
                f: 'savings' as PayFrom,
                Icon: Star,
                label: 'Vault Savings',
                bal: showPhp
                  ? `₱${(savingsBalance * phpRate).toFixed(2)}`
                  : `${savingsBalance.toFixed(2)} XLM`
              },
            ] as const).map(({ f, Icon, label, bal }) => (
              <button key={f} type="button" onClick={() => { setPayFrom(f); setError(null); }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${payFrom === f ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
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
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Coins size={11} /> {t('remit_amount')}
            </label>
            {/* Toggle for both GCash and Stellar methods */}
            <button
              type="button"
              onClick={() => { setShowPhp(v => !v); setError(null); }}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold"
            >
              <ArrowLeftRight size={11} />
              {showPhp ? 'Switch to XLM' : 'Switch to PHP'}
            </button>
          </div>
          <div className="relative">
            {isPhpMode && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₱</span>
            )}
              <input
                value={amount}
                onChange={e => { setAmount(e.target.value); setError(null); }}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className={`w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl ${isPhpMode ? 'pl-8' : 'px-4'} pr-16 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all`}
              />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              {isPhpMode ? 'PHP' : 'XLM'}
            </span>
          </div>
          {parsedXlm > 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 space-y-1.5 text-xs mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Breakdown</p>
              <div className="flex justify-between">
                <span className="text-slate-500">You send</span>
                <div className="text-right">
                  <p className="font-semibold text-slate-700">{showPhp ? `₱${parsedPhp.toFixed(2)}` : `${parsedXlm.toFixed(2)} XLM`}</p>
                  <p className="text-[10px] text-slate-400">≈ {showPhp ? `${parsedXlm.toFixed(2)} XLM` : `₱${parsedPhp.toFixed(2)}`}</p>
                </div>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform fee ({(breakdown.feeRate * 100).toFixed(1)}%)</span>
                <span>{showPhp ? `₱${(breakdown.salomedFee * phpRate).toFixed(2)}` : `${breakdown.salomedFee.toFixed(2)} XLM`}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Recipient receives</span>
                <div className="text-right">
                  <p className="font-semibold text-slate-700">
                    {showPhp ? `₱${(breakdown.recipientReceives * phpRate).toFixed(2)}` : `${breakdown.recipientReceives.toFixed(2)} XLM`}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    ≈ {showPhp ? `${breakdown.recipientReceives.toFixed(2)} XLM` : `₱${(breakdown.recipientReceives * phpRate).toFixed(2)}`}
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-1.5 space-y-1">
                <div className="flex justify-between text-blue-600 font-semibold">
                  <span className="flex items-center gap-1"><Star size={10} /> Cashback earned</span>
                  <span>
                    +{breakdown.ptsEarned} pts ≈ {showPhp ? `₱${(breakdown.cashbackXlm * phpRate).toFixed(2)}` : `${breakdown.cashbackXlm.toFixed(2)} XLM`}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Net cost to you</span>
                  <div className="text-right">
                    <p>{showPhp ? `₱${(breakdown.effectiveCost * phpRate).toFixed(2)}` : `${breakdown.effectiveCost.toFixed(2)} XLM`}</p>
                    <p className="text-[10px] font-medium opacity-80">
                      ≈ {showPhp ? `${breakdown.effectiveCost.toFixed(2)} XLM` : `₱${(breakdown.effectiveCost * phpRate).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : txHash ? (
            <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 space-y-1 mt-1">
              <p className="text-emerald-600/70 text-[10px] tabular-nums break-all">
                TX: {txHash?.slice(0, 32)}...
              </p>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold underline decoration-emerald-200 underline-offset-2 hover:text-emerald-700 transition-colors"
              >
                View on Explorer
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {isPhpMode ? '' : ''}
            </p>
          )}
        </div>

        {/* Escrow notice */}
        <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Lock size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Funds are locked on-chain. Can only be spent at whitelisted healthcare providers.
          </p>
        </div>

        {/* Balance check */}
        {isInsufficient && parsedXlm > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">Not enough balance</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Your {payFrom === 'vault' ? 'vault' : 'savings'} balance ({activeBalance.toFixed(2)} XLM) is not enough to cover this padala.
                </p>
              </div>
            </div>
            <button
              onClick={() => onSwitchTab('vault')}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock size={13} /> Top Up in Vault
            </button>
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

        {/* CTA */}
        {!isInsufficient && (
          <button
            onClick={handleSend}
            disabled={submitting || (recipientMethod === 'stellar' && !ofwAddress)}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Sending on-chain…</>
            ) : recipientMethod === 'gcash' ? (
              <><span className="w-4 h-4 bg-white rounded flex items-center justify-center text-[#007DFF] text-[10px] font-black leading-none">G</span> {t('remit_send_btn')} (GCash)</>
            ) : (
              <><Send size={15} /> {t('remit_send_btn')} (Stellar)</>
            )}
          </button>
        )}
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-3"
      >
        <h3 className="text-sm font-bold text-slate-700">How it works</h3>
        {(recipientMethod === 'gcash' ? [
          "Enter the recipient's GCash number",
          'Pay in PHP — auto-converted to XLM on-chain',
          'Funds are locked in their vault, spendable only at healthcare providers',
          'Earn SaloPoints with every padala sent',
        ] : [
          "Enter the recipient's Stellar vault address",
          'Send XLM directly — no conversion needed',
          'Funds are locked in their vault, spendable only at healthcare providers',
          'Earn SaloPoints with every padala sent',
        ]).map((s, i) => (
          <div key={s} className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-sm text-slate-500">{s}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
