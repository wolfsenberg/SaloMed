'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';

import { fmtAsset, fmtPhp } from '@/lib/format';
import { adminLogin, decideSaloRequest, getSaloRequests, releaseSaloRequest, type SaloRequestRow } from '@/lib/salo-requests';

type Filter = 'all' | 'pending' | 'approved' | 'terms_accepted' | 'released' | 'rejected';

function php(value: number): string {
  return `\u20b1${fmtPhp(value)}`;
}

function shortAddress(value: string): string {
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function statusStyle(status: string): string {
  if (status === 'released') return 'bg-emerald-50 text-emerald-700';
  if (status === 'terms_accepted') return 'bg-blue-50 text-blue-700';
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status: string): string {
  if (status === 'terms_accepted') return 'Terms accepted';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function reasonLabel(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function AdminConsole() {
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [loginError, setLoginError] = useState('');
  const [requests, setRequests] = useState<SaloRequestRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const visibleRequests = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(request => request.status === filter);
  }, [requests, filter]);

  const totals = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(request => request.status === 'pending').length,
    approved: requests.filter(request => request.status === 'approved').length,
    accepted: requests.filter(request => request.status === 'terms_accepted').length,
    released: requests.filter(request => request.status === 'released').length,
    rejected: requests.filter(request => request.status === 'rejected').length,
    value: requests.reduce((sum, request) => sum + Number(request.amount_php), 0),
  }), [requests]);

  async function refresh(token = adminToken) {
    if (!token) return;
    setLoading(true);
    try {
      setRequests(await getSaloRequests('all', token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (signedIn && adminToken) void refresh(adminToken);
  }, [signedIn, adminToken]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginSubmitting(true);
    try {
      const session = await adminLogin(username, password);
      setLoginError('');
      setPassword('');
      setAdminToken(session.token);
      setSignedIn(true);
    } catch {
      setLoginError('Invalid admin credentials.');
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function decide(requestId: string, status: 'approved' | 'rejected') {
    if (!adminToken) return;
    setActingId(requestId);
    try {
      const updated = await decideSaloRequest(requestId, status, adminToken);
      setRequests(current => current.map(row => row.id === requestId ? updated : row));
    } finally {
      setActingId(null);
    }
  }

  async function release(requestId: string) {
    if (!adminToken) return;
    setActingId(requestId);
    try {
      const updated = await releaseSaloRequest(requestId, adminToken);
      setRequests(current => current.map(row => row.id === requestId ? updated : row));
    } finally {
      setActingId(null);
    }
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_420px]">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck size={14} />
              SaloMed operations console
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">SaloMed Admin</h1>
              <p className="max-w-xl text-base leading-7 text-slate-500">
                Review Salo support requests, inspect request checks, and approve or reject release decisions from one workspace.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                { label: 'Queue', value: 'Salo', Icon: FileCheck2 },
                { label: 'Review', value: 'Admin', Icon: UserRoundCheck },
                { label: 'Release', value: 'Controlled', Icon: Lock },
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
                <ShieldCheck size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Admin sign in</h2>
                <p className="text-xs text-slate-400">SaloMed reviewer access</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
                <input
                  value={username}
                  onChange={event => {
                    setUsername(event.target.value);
                    setLoginError('');
                  }}
                  placeholder="Enter username"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:bg-white"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <input
                  value={password}
                  onChange={event => {
                    setPassword(event.target.value);
                    setLoginError('');
                  }}
                  type="password"
                  placeholder="Enter password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:bg-white"
                />
              </label>

              {loginError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {loginError}
                </div>
              )}

              <button
                disabled={loginSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
              >
                <Lock size={15} />
                {loginSubmitting ? 'Signing in...' : 'Open admin console'}
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
              <ShieldCheck size={21} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">SaloMed Admin Console</p>
              <h1 className="text-xl font-bold text-slate-950">Salo Review Queue</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                setSignedIn(false);
                setAdminToken('');
                setRequests([]);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: 'Pending', value: totals.pending, sub: 'Needs SaloMed review' },
            { label: 'Approved', value: totals.approved, sub: 'Waiting for patient terms' },
            { label: 'Accepted', value: totals.accepted, sub: 'Ready to release' },
            { label: 'Released', value: totals.released, sub: `${totals.rejected} declined` },
            { label: 'Requested value', value: php(totals.value), sub: `${totals.all} total requests` },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs text-slate-400">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Salo support requests</h2>
              <p className="text-xs text-slate-400">Cross-user requests recorded from the patient Salo flow</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'terms_accepted', 'released', 'rejected'] as Filter[]).map(item => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    filter === item
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {item === 'all' ? 'All' : statusLabel(item)}
                </button>
              ))}
            </div>
          </div>

          {visibleRequests.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
                <FileCheck2 size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">No Salo requests found</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                New Salo support requests submitted from the patient app will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleRequests.map(request => (
                <div key={request.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_220px]">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{request.id}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle(request.status)}`}>
                        {statusLabel(request.status)}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {request.credit_tier}
                      </span>
                    </div>

                    <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">Patient</p>
                        <p className="mt-1 font-bold text-slate-700">{shortAddress(request.patient_address)}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">Amount</p>
                        <p className="mt-1 font-bold text-slate-700">{php(Number(request.amount_php))}</p>
                        <p className="text-slate-400">{fmtAsset(Number(request.amount_asset))} XLM</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">Term</p>
                        <p className="mt-1 font-bold text-slate-700">{request.term_months} months</p>
                        <p className="text-slate-400">{php(Number(request.monthly_php))}/mo</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">Review basis</p>
                        <p className="mt-1 font-bold text-slate-700">{request.salo_points} SaloPoints</p>
                        <p className="text-slate-400">{request.interest_rate}% p.a.</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(request.reason_codes.length ? request.reason_codes : ['STANDARD_REVIEW']).map(code => (
                        <span key={code} className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                          {reasonLabel(code)}
                        </span>
                      ))}
                    </div>

                    <p className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock size={11} />
                      Submitted {new Date(request.created_at * 1000).toLocaleString()}
                      {request.reviewer ? ` | Reviewed by ${request.reviewer}` : ''}
                    </p>

                    {request.status === 'released' && request.repayment_schedule?.length ? (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Repayment schedule</p>
                        <div className="grid gap-1 sm:grid-cols-3">
                          {request.repayment_schedule.slice(0, 3).map(item => (
                            <div key={item.number} className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-[11px]">
                              <span className="text-slate-400">Month {item.number}</span>
                              <span className="font-bold text-slate-700">{php(Number(item.amount_php))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 lg:justify-end">
                    {request.status === 'terms_accepted' ? (
                      <button
                        onClick={() => release(request.id)}
                        disabled={actingId === request.id}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
                      >
                        <CheckCircle2 size={14} />
                        Mark released
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => decide(request.id, 'approved')}
                          disabled={actingId === request.id || request.status !== 'pending'}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => decide(request.id, 'rejected')}
                          disabled={actingId === request.id || request.status !== 'pending'}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
