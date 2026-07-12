import * as StellarSdk from '@stellar/stellar-sdk';

import {
  API_URL,
  ASSET_CODE,
  CONTRACT_ID,
  EXPECTED_ADMIN_ADDRESS,
  EXPECTED_TOKEN_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
} from './config';
import { signTransaction } from './freighter';


export type RuntimeMode = 'demo' | 'stellar_testnet' | 'pdax_uat' | 'pdax_prod';

export interface RuntimeStatus {
  mode: RuntimeMode;
  asset_code: typeof ASSET_CODE;
  contract_id: string;
  network: 'testnet' | 'mainnet';
  expected_token_id: string;
  admin_address: string;
  php_per_asset: string;
  simulated: boolean;
  real_money_enabled: boolean;
  history_source: 'demo_ledger' | 'soroban_contract_events';
  stellar_tracking_enabled: boolean;
}

export interface RuntimeVault {
  address: string;
  balance_stroops: number;
  balance_asset: string;
  asset_code: typeof ASSET_CODE;
  salo_points: number;
  credit_tier: 'Bronze' | 'Silver' | 'Gold';
  source: string;
  simulated: boolean;
}

export interface RuntimeProvider {
  provider_id: string;
  name: string;
  provider_type: 'hospital' | 'pharmacy';
}

export interface RuntimeTransaction {
  transaction_id: string;
  type: 'topup' | 'payment' | 'padala';
  direction: 'sent' | 'received';
  amount_asset: string;
  asset_code: typeof ASSET_CODE;
  amount_php: string;
  status: 'success' | 'pending' | 'failed';
  counterparty?: string | null;
  provider_id?: string | null;
  points_delta: number;
  created_at: number;
  simulated: boolean;
}

let runtimePromise: Promise<RuntimeStatus> | null = null;

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message ?? body?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function getRuntimeStatus(force = false): Promise<RuntimeStatus> {
  if (force || !runtimePromise) {
    runtimePromise = apiJson<RuntimeStatus>('/api/runtime')
      .then(status => {
        if (status.mode !== 'demo' && status.contract_id !== CONTRACT_ID) {
          throw new Error('Frontend/backend contract ID mismatch; real transactions are blocked.');
        }
        const expectedNetwork = NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC ? 'mainnet' : 'testnet';
        if (status.mode !== 'demo' && status.network !== expectedNetwork) {
          throw new Error('Frontend/backend Stellar network mismatch; real transactions are blocked.');
        }
        if (status.mode !== 'demo' && (
          !EXPECTED_TOKEN_ID || !EXPECTED_ADMIN_ADDRESS ||
          status.expected_token_id !== EXPECTED_TOKEN_ID ||
          status.admin_address !== EXPECTED_ADMIN_ADDRESS
        )) {
          throw new Error('Frontend/backend expected token or administrator mismatch; real transactions are blocked.');
        }
        return status;
      })
      .catch(error => {
        runtimePromise = null;
        throw error;
      });
  }
  return runtimePromise;
}

function idempotencyKey(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

const retryableKeys = new Map<string, string>();

function retryableKey(scope: string, prefix: string): string {
  const existing = retryableKeys.get(scope);
  if (existing) return existing;
  const created = idempotencyKey(prefix);
  retryableKeys.set(scope, created);
  return created;
}

export async function getRuntimeVault(address: string): Promise<RuntimeVault> {
  const runtime = await getRuntimeStatus();
  if (runtime.mode === 'demo') {
    return apiJson<RuntimeVault>(`/api/v2/vaults/${encodeURIComponent(address)}`);
  }

  await verifyContractConfiguration(address);
  const vault = await readContractVault(address);
  return {
    address,
    balance_stroops: Number(vault.balance),
    balance_asset: (Number(vault.balance) / 10_000_000).toFixed(7),
    asset_code: ASSET_CODE,
    salo_points: vault.salo_points,
    credit_tier: vault.credit_tier,
    source: 'soroban_contract',
    simulated: false,
  };
}

/**
 * Ensure the connected wallet can pay transaction fees for payment/padala.
 * In Stellar modes the backend tops up a little XLM from the admin. No-op in
 * demo mode. Best-effort: never throws so it can't block wallet connection.
 */
export async function ensureFeeFunds(address: string): Promise<void> {
  try {
    await apiJson('/api/v2/ensure-fees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
  } catch {
    // Non-fatal: user can still connect; fees can be funded later.
  }
}

export interface HistoryRow {
  id: string;
  type: string;
  direction: string | null;
  amount_asset: number;
  amount_php: number;
  counterparty: string | null;
  tx_hash: string | null;
  status: string;
  created_at: number;
}

/** Record a transaction against a Stellar address (history follows the wallet). */
export async function recordHistory(row: {
  address: string;
  type: string;
  amountAsset: number;
  amountPhp: number;
  direction?: string;
  counterparty?: string;
  txHash?: string;
}): Promise<void> {
  try {
    await apiJson('/api/v2/history/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: row.address,
        type: row.type,
        amount_asset: row.amountAsset.toFixed(7),
        amount_php: row.amountPhp.toFixed(2),
        direction: row.direction ?? null,
        counterparty: row.counterparty ?? null,
        tx_hash: row.txHash ?? null,
        status: 'success',
      }),
    });
  } catch {
    // Non-fatal: local history still works if the index write fails.
  }
}

/** Read address-keyed history from the backend index (cross-device). */
export async function getAddressHistory(address: string): Promise<HistoryRow[]> {
  const res = await apiJson<{ transactions: HistoryRow[] }>(
    `/api/v2/vaults/${encodeURIComponent(address)}/transactions`,
  );
  return res.transactions ?? [];
}

export async function getRuntimeProviders(): Promise<RuntimeProvider[]> {
  const response = await apiJson<{ providers: RuntimeProvider[] }>('/api/v2/providers');
  return response.providers;
}

export async function getRuntimeHistory(address: string): Promise<RuntimeTransaction[]> {
  const runtime = await getRuntimeStatus();
  if (runtime.mode !== 'demo') return readContractHistory(address, Number(runtime.php_per_asset));
  const response = await apiJson<{ transactions: RuntimeTransaction[] }>(
    `/api/v2/vaults/${encodeURIComponent(address)}/transactions`,
  );
  return response.transactions;
}

export async function demoTopUp(address: string, amountPhp: number): Promise<string> {
  const scope = `topup:${address}:${amountPhp.toFixed(2)}`;
  const result = await apiJson<{ transaction_id: string }>('/api/v2/topups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiary_address: address,
        amount_php: amountPhp.toFixed(2),
        idempotency_key: retryableKey(scope, 'topup'),
      }),
    });
  retryableKeys.delete(scope);
  return result.transaction_id;
}

export async function demoPayment(
  patientAddress: string,
  providerId: string,
  amountAsset: number,
): Promise<string> {
  const scope = `payment:${patientAddress}:${providerId}:${amountAsset.toFixed(7)}`;
  const result = await apiJson<{ transaction_id: string }>('/api/v2/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_address: patientAddress,
      provider_id: providerId,
      amount_asset: amountAsset.toFixed(7),
      idempotency_key: retryableKey(scope, 'payment'),
    }),
  });
  retryableKeys.delete(scope);
  return result.transaction_id;
}

export async function demoRemittance(
  senderAddress: string,
  beneficiaryAddress: string,
  amountAsset: number,
): Promise<string> {
  const scope = `padala:${senderAddress}:${beneficiaryAddress}:${amountAsset.toFixed(7)}`;
  const result = await apiJson<{ transaction_id: string }>('/api/v2/remittances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_address: senderAddress,
      beneficiary_address: beneficiaryAddress,
      amount_asset: amountAsset.toFixed(7),
      idempotency_key: retryableKey(scope, 'remittance'),
    }),
  });
  retryableKeys.delete(scope);
  return result.transaction_id;
}

interface ContractVaultNative {
  balance: bigint;
  salo_points: number;
  credit_tier: 'Bronze' | 'Silver' | 'Gold';
}

const rpc = new StellarSdk.rpc.Server(RPC_URL);
const contract = new StellarSdk.Contract(CONTRACT_ID);

function eventAmount(value: StellarSdk.xdr.ScVal): bigint {
  const native = StellarSdk.scValToNative(value) as bigint | number | { amount?: bigint | number };
  if (typeof native === 'bigint') return native;
  if (typeof native === 'number') return BigInt(native);
  if (native && typeof native === 'object' && native.amount !== undefined) return BigInt(native.amount);
  return 0n;
}

async function readContractHistory(address: string, phpRate: number): Promise<RuntimeTransaction[]> {
  const latest = await rpc.getLatestLedger();
  const addressTopic = new StellarSdk.Address(address).toScVal().toXDR('base64');
  const events: StellarSdk.rpc.Api.EventResponse[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = await rpc.getEvents({
      startLedger: cursor ? undefined : Math.max(1, latest.sequence - 120_000),
      cursor,
      filters: [{
        type: 'contract',
        contractIds: [CONTRACT_ID],
        topics: [['*', addressTopic], ['*', '*', addressTopic]],
      }],
      limit: 100,
    });
    events.push(...page.events);
    const nextCursor = page.events.at(-1)?.pagingToken;
    if (page.events.length < 100 || !nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  const normalizedAddress = address.toUpperCase();
  const rows: RuntimeTransaction[] = [];

  for (const event of events) {
    const topics = event.topic.map(topic => StellarSdk.scValToNative(topic));
    const eventName = String(topics[0] ?? '').toLowerCase();
    const addresses = topics.slice(1).map(value => String(value).toUpperCase());
    if (!addresses.includes(normalizedAddress)) continue;

    const stroops = eventAmount(event.value);
    if (stroops <= 0n) continue;
    const amount = Number(stroops) / 10_000_000;
    const createdAt = Math.floor(new Date(event.ledgerClosedAt).getTime() / 1000);

    if (eventName.includes('deposited')) {
      const sender = String(topics[1] ?? '');
      const beneficiary = String(topics[2] ?? '');
      const isBeneficiary = beneficiary.toUpperCase() === normalizedAddress;
      const isSelfTopUp = sender.toUpperCase() === beneficiary.toUpperCase();
      rows.push({
        transaction_id: event.txHash,
        type: isSelfTopUp ? 'topup' : 'padala',
        direction: isSelfTopUp || isBeneficiary ? 'received' : 'sent',
        amount_asset: amount.toFixed(7),
        asset_code: ASSET_CODE,
        amount_php: (amount * phpRate).toFixed(2),
        status: 'success',
        counterparty: isBeneficiary ? sender : beneficiary,
        points_delta: 0,
        created_at: createdAt,
        simulated: false,
      });
    } else if (eventName.includes('vaulttransferred')) {
      const sender = String(topics[1] ?? '');
      const beneficiary = String(topics[2] ?? '');
      const isBeneficiary = beneficiary.toUpperCase() === normalizedAddress;
      rows.push({
        transaction_id: event.txHash,
        type: 'padala',
        direction: isBeneficiary ? 'received' : 'sent',
        amount_asset: amount.toFixed(7),
        asset_code: ASSET_CODE,
        amount_php: (amount * phpRate).toFixed(2),
        status: 'success',
        counterparty: isBeneficiary ? sender : beneficiary,
        points_delta: 0,
        created_at: createdAt,
        simulated: false,
      });
    } else if (eventName.includes('hospitalpaid')) {
      const patient = String(topics[1] ?? '');
      const hospital = String(topics[2] ?? '');
      if (patient.toUpperCase() !== normalizedAddress) continue;
      rows.push({
        transaction_id: event.txHash,
        type: 'payment',
        direction: 'sent',
        amount_asset: amount.toFixed(7),
        asset_code: ASSET_CODE,
        amount_php: (amount * phpRate).toFixed(2),
        status: 'success',
        counterparty: hospital,
        provider_id: hospital,
        points_delta: Math.floor(amount),
        created_at: createdAt,
        simulated: false,
      });
    }
  }
  return rows.sort((a, b) => b.created_at - a.created_at);
}

function contractTransaction(source: StellarSdk.Account, method: string, args: StellarSdk.xdr.ScVal[]) {
  return new StellarSdk.TransactionBuilder(source, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
}

let contractConfigurationVerified: Promise<void> | null = null;

function verifyContractConfiguration(sourceAddress: string): Promise<void> {
  if (!contractConfigurationVerified) {
    contractConfigurationVerified = (async () => {
      const source = await rpc.getAccount(sourceAddress);
      const readAddress = async (method: 'get_token_id' | 'get_admin') => {
        const simulation = await rpc.simulateTransaction(contractTransaction(source, method, []));
        if (StellarSdk.rpc.Api.isSimulationError(simulation) || !simulation.result) {
          throw new Error(`Unable to verify contract ${method}.`);
        }
        return String(StellarSdk.scValToNative(simulation.result.retval));
      };
      const tokenId = await readAddress('get_token_id');
      const admin = await readAddress('get_admin');
      if (tokenId !== EXPECTED_TOKEN_ID || admin !== EXPECTED_ADMIN_ADDRESS) {
        throw new Error('Deployed contract token/admin do not match the verified configuration.');
      }
    })().catch(error => {
      contractConfigurationVerified = null;
      throw error;
    });
  }
  return contractConfigurationVerified;
}

async function readContractVault(address: string): Promise<ContractVaultNative> {
  const source = await rpc.getAccount(address);
  const tx = contractTransaction(source, 'get_vault', [new StellarSdk.Address(address).toScVal()]);
  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation) || !simulation.result) {
    const reason = StellarSdk.rpc.Api.isSimulationError(simulation)
      ? simulation.error
      : 'Contract returned no vault value';
    throw new Error(`Unable to read SaloMed vault: ${reason}`);
  }
  const native = StellarSdk.scValToNative(simulation.result.retval) as {
    balance: bigint;
    salo_points: bigint | number;
    credit_tier: string | { tag?: string };
  };
  const tierRaw = typeof native.credit_tier === 'string'
    ? native.credit_tier
    : native.credit_tier?.tag ?? 'Bronze';
  const creditTier = (['Bronze', 'Silver', 'Gold'].includes(tierRaw) ? tierRaw : 'Bronze') as ContractVaultNative['credit_tier'];
  return {
    balance: BigInt(native.balance),
    salo_points: Number(native.salo_points),
    credit_tier: creditTier,
  };
}

async function submitContractCall(
  signerAddress: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
): Promise<string> {
  await verifyContractConfiguration(signerAddress);
  const source = await rpc.getAccount(signerAddress);
  const tx = contractTransaction(source, method, args);
  const prepared = await rpc.prepareTransaction(tx);
  const signedXdr = await signTransaction(prepared.toXDR());
  if (!signedXdr) throw new Error('Freighter did not return a signature. Make sure it is unlocked and set to Testnet.');

  const signed = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await rpc.sendTransaction(signed);
  if (sent.status === 'ERROR') throw new Error('Soroban transaction was rejected by the network.');

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await rpc.getTransaction(sent.hash);
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Soroban contract rejected the transaction. Check vault balance and provider whitelist.');
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error(`Transaction ${sent.hash} is still pending; check Stellar Explorer before retrying.`);
}

function addressVal(address: string): StellarSdk.xdr.ScVal {
  return new StellarSdk.Address(address).toScVal();
}

function amountVal(amountAsset: number): StellarSdk.xdr.ScVal {
  if (!Number.isFinite(amountAsset) || amountAsset <= 0) throw new Error('Amount must be positive.');
  const [whole, fraction = ''] = amountAsset.toFixed(7).split('.');
  const stroops = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0'));
  return StellarSdk.nativeToScVal(stroops, { type: 'i128' });
}

export async function contractDeposit(
  senderAddress: string,
  beneficiaryAddress: string,
  amountAsset: number,
): Promise<string> {
  return submitContractCall(senderAddress, 'deposit_remittance', [
    addressVal(senderAddress),
    addressVal(beneficiaryAddress),
    amountVal(amountAsset),
  ]);
}

export async function contractPayment(
  patientAddress: string,
  providerAddress: string,
  amountAsset: number,
): Promise<string> {
  return submitContractCall(patientAddress, 'pay_hospital', [
    addressVal(patientAddress),
    addressVal(providerAddress),
    amountVal(amountAsset),
  ]);
}

export async function contractVaultTransfer(
  senderAddress: string,
  beneficiaryAddress: string,
  amountAsset: number,
): Promise<string> {
  return submitContractCall(senderAddress, 'transfer_vault', [
    addressVal(senderAddress),
    addressVal(beneficiaryAddress),
    amountVal(amountAsset),
  ]);
}
