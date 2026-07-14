import { API_URL } from './config';

export interface SaloRequestRow {
  id: string;
  patient_address: string;
  amount_asset: number;
  amount_php: number;
  term_months: number;
  monthly_php: number;
  interest_rate: number;
  salo_points: number;
  credit_tier: string;
  status: 'pending' | 'approved' | 'rejected' | 'terms_accepted' | 'released' | string;
  review_decision: string;
  reason_codes: string[];
  audit_trail?: Array<{ action: string; actor: string; at: number }>;
  repayment_schedule?: Array<{ number: number; due_at: number; amount_php: number; status: string }>;
  reviewer?: string | null;
  reviewed_at?: number | null;
  accepted_at?: number | null;
  released_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface AdminSession {
  token: string;
  username: string;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message ?? response.statusText;
    throw new Error(message);
  }
  return body as T;
}

export async function adminLogin(username: string, password: string): Promise<AdminSession> {
  return apiJson<AdminSession>('/api/v2/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function recordSaloRequest(row: {
  patientAddress: string;
  amountAsset: number;
  amountPhp: number;
  termMonths: number;
  monthlyPhp: number;
  interestRate: number;
  saloPoints: number;
  creditTier: string;
  pendingRequests: number;
}): Promise<SaloRequestRow | null> {
  try {
    const response = await apiJson<{ request: SaloRequestRow }>('/api/v2/salo/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_address: row.patientAddress,
        amount_asset: row.amountAsset.toFixed(7),
        amount_php: row.amountPhp.toFixed(2),
        term_months: row.termMonths,
        monthly_php: row.monthlyPhp.toFixed(2),
        interest_rate: row.interestRate.toFixed(2),
        salo_points: row.saloPoints,
        credit_tier: row.creditTier,
        pending_requests: row.pendingRequests,
      }),
    });
    return response.request;
  } catch {
    return null;
  }
}

export async function getSaloRequests(status = 'all', token?: string): Promise<SaloRequestRow[]> {
  const response = await apiJson<{ requests: SaloRequestRow[] }>(
    `/api/v2/salo/requests?status=${encodeURIComponent(status)}`,
    { headers: authHeaders(token) },
  );
  return response.requests ?? [];
}

export async function getPatientSaloRequests(patientAddress: string): Promise<SaloRequestRow[]> {
  const response = await apiJson<{ requests: SaloRequestRow[] }>(
    `/api/v2/salo/requests/patient/${encodeURIComponent(patientAddress)}`,
  );
  return response.requests ?? [];
}

export async function decideSaloRequest(
  requestId: string,
  status: 'approved' | 'rejected' | 'pending',
  token?: string,
): Promise<SaloRequestRow> {
  const response = await apiJson<{ request: SaloRequestRow }>(
    `/api/v2/salo/requests/${encodeURIComponent(requestId)}/decision`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ status, reviewer: 'SaloMed Admin' }),
    },
  );
  return response.request;
}

export async function acceptSaloTerms(
  requestId: string,
  patientAddress: string,
): Promise<SaloRequestRow> {
  const response = await apiJson<{ request: SaloRequestRow }>(
    `/api/v2/salo/requests/${encodeURIComponent(requestId)}/accept-terms`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_address: patientAddress }),
    },
  );
  return response.request;
}

export async function releaseSaloRequest(requestId: string, token?: string): Promise<SaloRequestRow> {
  const response = await apiJson<{ request: SaloRequestRow }>(
    `/api/v2/salo/requests/${encodeURIComponent(requestId)}/release`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ reviewer: 'SaloMed Admin' }),
    },
  );
  return response.request;
}
