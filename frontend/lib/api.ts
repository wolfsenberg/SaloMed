const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface BillScanResult {
  total_bill: number;
  philhealth_deduction: number;
  hmo_deduction: number;
  out_of_pocket_balance: number;
  ocr_mode: string;
}

export interface TriggerResult {
  status: string;
  message: string;
  transaction_hash: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function scanBill(file: File): Promise<BillScanResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/scan-bill`, { method: 'POST', body: form });
  return handleResponse<BillScanResult>(res);
}

export async function payHospital(
  patientAddress: string,
  hospitalAddress: string,
  amountUsdc: number,
): Promise<TriggerResult> {
  const res = await fetch(`${API_URL}/api/trigger-contract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      function_name: 'pay_hospital',
      patient_address: patientAddress,
      hospital_address: hospitalAddress,
      amount_usdc: amountUsdc,
    }),
  });
  return handleResponse<TriggerResult>(res);
}

export interface GCashTopUpResult {
  reference_id: string;
  qr_payload: string;
  amount_php: number;
  amount_usdc: number;
  exchange_rate: number;
  status: string;
  message: string;
}

export async function gcashTopUp(
  gcashNumber: string,
  amountPhp: number,
  beneficiaryAddress: string,
): Promise<GCashTopUpResult> {
  const res = await fetch(`${API_URL}/api/gcash-topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gcash_number: gcashNumber,
      amount_php: amountPhp,
      beneficiary_address: beneficiaryAddress,
    }),
  });
  return handleResponse<GCashTopUpResult>(res);
}

export async function gcashConfirm(
  referenceId: string,
  beneficiaryAddress: string,
): Promise<{ status: string; message: string }> {
  const res = await fetch(
    `${API_URL}/api/gcash-confirm?reference_id=${encodeURIComponent(referenceId)}&beneficiary_address=${encodeURIComponent(beneficiaryAddress)}`,
    { method: 'POST' },
  );
  return handleResponse(res);
}

export async function getGCashRate(): Promise<{ php_per_usdc: number }> {
  const res = await fetch(`${API_URL}/api/gcash-rate`);
  return handleResponse(res);
}

export async function depositRemittance(
  ofwAddress: string,
  beneficiaryAddress: string,
  amountUsdc: number,
): Promise<TriggerResult> {
  const res = await fetch(`${API_URL}/api/trigger-contract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      function_name: 'deposit_remittance',
      patient_address: beneficiaryAddress,
      ofw_address: ofwAddress,
      amount_usdc: amountUsdc,
    }),
  });
  return handleResponse<TriggerResult>(res);
}
