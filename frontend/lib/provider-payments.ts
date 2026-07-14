import { API_URL } from './config';

export interface ProviderPaymentRow {
  id: string;
  patient_address: string;
  provider_address: string;
  provider_name: string;
  provider_type: 'hospital' | 'pharmacy' | string;
  amount_asset: number;
  amount_php: number;
  tx_hash: string | null;
  status: 'success' | 'pending' | 'failed' | string;
  created_at: number;
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

export async function getProviderPayments(providerAddress: string): Promise<ProviderPaymentRow[]> {
  const res = await apiJson<{ transactions: ProviderPaymentRow[] }>(
    `/api/v2/providers/${encodeURIComponent(providerAddress)}/transactions`,
  );
  return res.transactions ?? [];
}
