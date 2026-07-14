'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Lock,
  LogOut,
  Pill,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { fmtAsset, fmtPhp } from '@/lib/format';
import { explorerTxUrl } from '@/lib/stellar-links';
import { HOSPITALS, PHARMACIES, Provider } from '@/lib/whitelist';
import type { Transaction } from '@/lib/transactions';

type ProviderLogin = Provider & { kindLabel: string };

const PROVIDERS: ProviderLogin[] = [
  ...HOSPITALS.map(provider => ({ ...provider, kindLabel: 'Hospital' })),
  ...PHARMACIES.map(provider => ({ ...provider, kindLabel: 'Pharmacy' })),
].sort((a, b) => a.kindLabel.localeCompare(b.kindLabel) || a.name.localeCompare(b.name));

function passwordFor(provider: Provider): string {
  return `${provider.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_123`;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function php(value: number): string {
  return `₱${fmtPhp(value)}`;
}

function loadAllLocalTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  const rows: Transaction[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith('salomed_txs_')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as Transaction[];
      rows.push(...parsed);
    } catch {
      // Ignore malformed local demo rows.
    }
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}

function matchesProvider(transaction: Transaction, provider: Provider): boolean {
  if (transaction.type !== 'payment') return false;
  const target = provider.paymentTarget.toUpperCase();
  const providerAddress = transaction.providerAddress?.toUpperCase();
  return providerAddress === target || transaction.providerName === provider.name;
}

export default function PartnerPortal() {
  const [selectedTarget, setSelectedTarget] = useState(PROVIDERS[0]?.paymentTarget ?? '');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<ProviderLogin | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedProvider = PROVIDERS.find(item => item.paymentTarget === selectedTarget) ?? PROVIDERS[0];
  const payments = useMemo(() => {
    if (!provider) return [];
    refreshKey;
    return loadAllLocalTransactions().filter(transaction => matchesProvider(transaction, provider));
  }, [provider, refreshKey]);

  const totalPhp = payments.reduce((sum, row) => sum + row.amountPhp, 0);
  const totalXlm = payments.reduce((sum, row) => sum + row.amountXlm, 0);
  const latestPayment = payments[0];

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider) return;
    if (password.trim() !== passwordFor(selectedProvider)) {
      setError('Password must be the lowercase provider name with underscores, followed by _123.');
      return;
    }
    setProvider(selectedProvider);
    setError('');
    setPassword('');
    setRefreshKey(key => key + 1);
  }

  if (!provider) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_420px]">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck size={14} />
              Whitelisted provider portal
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">SaloMed Partner Portal</h1>
              <p className="max-w-xl text-base leading-7 text-slate-500">
                A separate workspace for whitelisted hospitals and pharmacies to review incoming SaloMed payments, bill checks, and settlement status.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { label: 'Hospitals', value: HOSPITALS.length, Icon: Building2 },
                { label: 'Pharmacies', value: PHARMACIES.length, Icon: Pill },
                { label: 'Access', value: 'Provider', Icon: Lock },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                  <item.Icon size={18} className="mb-3 text-blue-600" />
                  <p className="text-xl font-bold text-slate-950">{item.value}</p>
                  <p className="text-xs font-medium text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleLogin} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card-md">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Building2 size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Provider sign in</h2>
                <p className="text-xs text-slate-400">Whitelisted provider access</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider username</span>
                <select
                  value={selectedTarget}
                  onChange={event => {
                    setSelectedTarget(event.target.value);
                    setError('');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white"
                >
                  <optgroup label="Hospitals">
                    {HOSPITALS.map(item => (
                      <option key={item.paymentTarget} value={item.paymentTarget}>{item.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Pharmacies">
                    {PHARMACIES.map(item => (
                      <option key={item.paymentTarget} value={item.paymentTarget}>{item.name}</option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <input
                  value={password}
                  onChange={event => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  type="password"
                  placeholder={selectedProvider ? passwordFor(selectedProvider) : 'provider_name_123'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:bg-white"
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.99]">
                <Lock size={15} />
                Open partner portal
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
              {provider.type === 'hospital' ? <Building2 size={21} /> : <Pill size={21} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SaloMed Partner Portal</p>
              <h1 className="text-xl font-bold text-slate-950">{provider.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(key => key + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => setProvider(null)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'Provider type', value: provider.kindLabel, sub: provider.location },
            { label: 'Incoming payments', value: payments.length.toLocaleString(), sub: 'Matched to this provider' },
            { label: 'Settled value', value: php(totalPhp), sub: `${fmtAsset(totalXlm)} XLM` },
            { label: 'Last payment', value: latestPayment ? new Date(latestPayment.timestamp).toLocaleDateString() : 'None', sub: latestPayment ? php(latestPayment.amountPhp) : 'No matched payment yet' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs text-slate-400">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">Incoming SaloMed payments</h2>
                <p className="text-xs text-slate-400">Filtered by whitelisted provider address or provider name</p>
              </div>
              <ReceiptText size={19} className="text-blue-600" />
            </div>

            {payments.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
                  <ReceiptText size={24} />
                </div>
                <p className="text-sm font-bold text-slate-700">No matched payments yet</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                  Payments made to {provider.name} from the patient app will appear here after the transaction is recorded.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map(payment => (
                  <div key={payment.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{php(payment.amountPhp)}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {fmtAsset(payment.amountXlm)} XLM
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {payment.status === 'success' ? 'Settled' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        Patient vault payment • {new Date(payment.timestamp).toLocaleString()}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Target: {payment.providerAddress ? shortAddress(payment.providerAddress) : provider.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500">
                        Mark reviewed
                      </button>
                      {payment.txHash && (
                        <a
                          href={explorerTxUrl(payment.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Verify
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-950">Provider profile</h2>
                <ShieldCheck size={18} className="text-emerald-600" />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Whitelist status</p>
                  <p className="mt-1 font-bold text-emerald-700">Active</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Settlement wallet</p>
                  <p className="mt-1 break-all font-medium text-slate-700">{shortAddress(provider.paymentTarget)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Credential model</p>
                  <p className="mt-1 text-slate-500">Provider-name password</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardCheck size={18} className="text-blue-700" />
                <h2 className="text-base font-bold text-blue-950">Bill verification queue</h2>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-bold text-slate-800">Salo support requests</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Providers verify the bill and service details. SaloMed handles approval.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/80 p-3 text-xs font-semibold text-slate-600">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Whitelist enforced before payment
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
