'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeftRight, CheckCircle, Globe, Loader2, Lock, Send } from 'lucide-react';

import type { HealthVault } from '@/lib/contract';
import { calcPadala, getVault, sendPadala } from '@/lib/contract';
import { saveTx } from '@/lib/transactions';
import { recordHistory } from '@/lib/runtime';
import { blocksForInsufficientBalance } from '@/lib/balance-guard';
import { fmtAsset, fmtPhp } from '@/lib/format';
import { explorerTxUrl, networkBadgeLabel } from '@/lib/stellar-links';
import { API_URL } from '@/lib/config';


interface Props {
  ofwAddress: string | null;
  vault: HealthVault;
  onSuccess: () => void;
  onSwitchTab: (tab: any) => void;
}
function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim().toUpperCase());
}

export default function RemittanceForm({ ofwAddress, vault, onSuccess, onSwitchTab }: Props) {
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [showPhp, setShowPhp] = useState(false);
  const [phpRate, setPhpRate] = useState(56);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    // Live PHP-per-XLM rate so the padala amount and its PHP display match the
    // real on-chain XLM value shown on Freighter and the Stellar Explorer.
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => {
        if (d?.php_per_usdc > 0) setPhpRate(d.php_per_usdc);
      })
      .catch(() => {});
  }, []);

  const vaultBalance = Number(vault.balance) / 10_000_000;
  const amountAsset = showPhp
    ? (parseFloat(amount) || 0) / phpRate
    : parseFloat(amount) || 0;
  const amountPhp = amountAsset * phpRate;
  const breakdown = calcPadala(amountAsset);
  const insufficient = amountAsset > vaultBalance;

  async function handleSend() {
    if (!ofwAddress) { setError('Connect your Freighter wallet first.'); return; }
    if (!isValidStellarAddress(beneficiary)) {
      setError('Enter a checksum-valid Stellar G-address for the beneficiary vault.'); return;
    }
    if (beneficiary.trim().toUpperCase() === ofwAddress.toUpperCase()) {
      setError('Sender and beneficiary must be different wallets.'); return;
    }
    if (amountAsset <= 0) { setError('Enter a positive amount.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      // Live on-chain balance guard BEFORE signing: re-read the vault so a
      // stale prop can never let a doomed padala open Freighter, and the vault
      // is never driven negative.
      const live = await getVault(ofwAddress);
      const liveBalance = Number(live.balance) / 10_000_000;
      if (blocksForInsufficientBalance(amountAsset, liveBalance)) {
        setError('Insufficient locked vault balance.');
        setSubmitting(false);
        return;
      }
      const recipient = beneficiary.trim().toUpperCase();
      const hash = await sendPadala(ofwAddress, recipient, amountAsset);
      setTxHash(hash);
      saveTx(ofwAddress, {
        type: 'padala',
        amountXlm: amountAsset,
        amountPhp,
        recipientMethod: 'stellar',
        recipientLabel: `${recipient.slice(0, 6)}…${recipient.slice(-4)}`,
        payFrom: 'vault',
        txHash: hash,
        status: 'success',
        direction: 'sent',
      });
      // Record for both sender (sent) and beneficiary (received) so history
      // follows each wallet across devices.
      void recordHistory({
        address: ofwAddress, type: 'padala', amountAsset, amountPhp,
        direction: 'sent', counterparty: `${recipient.slice(0, 6)}…${recipient.slice(-4)}`, txHash: hash,
      });
      void recordHistory({
        address: recipient, type: 'padala', amountAsset, amountPhp,
        direction: 'received', counterparty: `${ofwAddress.slice(0, 6)}…${ofwAddress.slice(-4)}`, txHash: hash,
      });
      setTimeout(onSuccess, 2200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Padala failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ofwAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
        <Lock size={36} className="text-blue-400" />
        <h2 className="text-lg font-bold text-slate-800">Connect your wallet to send Health Padala</h2>
      </div>
    );
  }

  if (txHash) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[60vh] flex flex-col items-center justify-center px-6 gap-4 text-center">
        <CheckCircle size={52} className="text-emerald-500" />
        <h2 className="text-xl font-bold text-slate-900">Health Padala sent</h2>
        <p className="text-sm text-slate-500">
          {fmtAsset(amountAsset)} XLM was moved into the beneficiary&apos;s locked health vault.
        </p>
        <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
          Stellar {networkBadgeLabel()}
        </span>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">Transaction hash</p>
        {explorerTxUrl(txHash) ? (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 max-w-xs truncate font-mono text-xs text-blue-600 hover:text-blue-800"
          >
            <Globe size={11} className="shrink-0" /> {txHash}
          </a>
        ) : (
          <p className="max-w-xs truncate font-mono text-xs text-slate-400">{txHash}</p>
        )}
      </motion.div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="gradient-brand rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Purpose-bound remittance</p>
        <h2 className="text-xl font-bold mt-1">Health Padala</h2>
        <p className="text-sm text-blue-100 mt-1">
          Value moves from your locked vault to the beneficiary&apos;s locked vault—not to a spendable wallet balance.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Beneficiary Stellar address</label>
          <div className="relative mt-2">
            <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={beneficiary}
              onChange={event => { setBeneficiary(event.target.value); setError(null); }}
              placeholder="G…"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-mono outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</label>
            <button onClick={() => setShowPhp(value => !value)} className="text-xs font-semibold text-blue-600 flex items-center gap-1">
              <ArrowLeftRight size={11} /> {showPhp ? 'Enter XLM' : 'Enter PHP'}
            </button>
          </div>
          <div className="relative mt-2">
            <input
              value={amount}
              onChange={event => { setAmount(event.target.value); setError(null); }}
              onWheel={event => event.currentTarget.blur()}
              type="number"
              min="0"
              step={showPhp ? '0.01' : '0.0000001'}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 pr-20 py-3 text-xl font-bold outline-none focus:border-blue-500"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{showPhp ? 'PHP' : 'XLM'}</span>
          </div>
          {amountAsset > 0 && (
            <p className="text-xs text-slate-400 text-right mt-1">
              {showPhp ? `= ${fmtAsset(amountAsset)} XLM` : `≈ ₱${fmtPhp(amountPhp)}`}
            </p>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2">
          <div className="flex justify-between"><span>Locked vault balance</span><strong>{fmtAsset(vaultBalance)} XLM</strong></div>
          <div className="flex justify-between"><span>Platform fee</span><strong>0.00 XLM</strong></div>
          <div className="flex justify-between"><span>Beneficiary receives</span><strong>{fmtAsset(breakdown.recipientReceives)} XLM</strong></div>
          <p className="text-slate-400">Padala does not award or redeem SaloPoints.</p>
        </div>

        {insufficient && (
          <button onClick={() => onSwitchTab('vault')} className="w-full text-xs font-semibold text-amber-700 bg-amber-50 rounded-xl p-3">
            Insufficient balance — open Vault to top up
          </button>
        )}
        {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={13} />{error}</p>}

        <button
          onClick={handleSend}
          disabled={submitting || amountAsset <= 0 || insufficient}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 size={15} className="animate-spin" /> Processing…</> : <><Send size={15} /> Send locked XLM</>}
        </button>
      </div>
    </div>
  );
}
