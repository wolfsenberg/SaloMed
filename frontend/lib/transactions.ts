export type TxType = 'topup' | 'payment' | 'padala' | 'loan';

export interface Transaction {
  id:               string;
  type:             TxType;
  timestamp:        number;
  amountXlm:        number;
  amountPhp:        number;
  // topup
  gcashRef?:        string;
  // payment
  providerName?:    string;
  providerType?:    'hospital' | 'pharmacy';
  payFrom?:         'vault' | 'savings';
  // padala
  recipientMethod?: 'gcash' | 'stellar';
  recipientLabel?:  string;
  // loan
  termMonths?:      number;
  monthlyPhp?:      number;
  interestRate?:    number;
  // shared
  ptsEarned?:       number;
  txHash?:          string;
  status:           'success' | 'pending';
  direction?:       'sent' | 'received';
  senderLabel?:     string;
}

const storageKey = (address: string) => `salomed_txs_${address.toUpperCase()}`;

export function saveTx(
  address: string,
  tx: Omit<Transaction, 'id' | 'timestamp'>,
): Transaction {
  const addr = address.toUpperCase();
  const all  = loadTxs(addr);
  
  // Robust UUID fallback
  let id = '';
  try { id = crypto.randomUUID(); }
  catch { id = Math.random().toString(36).substring(2, 15) + Date.now().toString(36); }

  const full: Transaction = {
    ...tx,
    id,
    timestamp: Date.now(),
  };

  all.unshift(full);
  try {
    localStorage.setItem(storageKey(addr), JSON.stringify(all));
    // Signal a transaction update to other components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('salomed_tx_update', { detail: { address: addr } }));
    }
  } catch { /* storage full or unavailable */ }
  return full;
}

export function loadTxs(address: string): Transaction[] {
  try {
    const raw = localStorage.getItem(storageKey(address));
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch real on-chain payments from Horizon and convert to SaloMed format.
 * This ensures history persists even if localStorage is cleared or on new devices.
 */
export async function fetchHorizonTxs(address: string): Promise<Transaction[]> {
  const addr = address.toUpperCase();
  try {
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${addr}/payments?limit=25&order=desc`);
    if (!res.ok) return [];
    const data = await res.json();
    const records = data._embedded?.records || [];

    return records.map((r: any) => {
      const isSender = r.from === addr;
      const amountXlm = parseFloat(r.amount);
      
      // Attempt to identify type (Native XLM payments)
      // Note: In a real app, we'd use memo or specific logic to distinguish 
      // hospital vs padala, but for this demo falling back to 'padala' for unknown types.
      let type: TxType = 'padala';
      if (r.type === 'create_account') type = 'topup';

      return {
        id: r.id,
        type,
        timestamp: new Date(r.created_at).getTime(),
        amountXlm,
        amountPhp: amountXlm * 56, // Demo static rate
        direction: isSender ? 'sent' : 'received',
        status: 'success',
        txHash: r.transaction_hash,
        senderLabel: isSender ? undefined : (r.from.slice(0,6) + '…' + r.from.slice(-4)),
        recipientLabel: isSender ? (r.to.slice(0,6) + '…' + r.to.slice(-4)) : undefined,
      } as Transaction;
    });
  } catch (e) {
    console.warn('[Horizon Sync] failed:', e);
    return [];
  }
}
