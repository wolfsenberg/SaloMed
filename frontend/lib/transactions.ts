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
}

const storageKey = (address: string) => `salomed_txs_${address}`;

export function saveTx(
  address: string,
  tx: Omit<Transaction, 'id' | 'timestamp'>,
): Transaction {
  const all  = loadTxs(address);
  const full: Transaction = {
    ...tx,
    id:        crypto.randomUUID(),
    timestamp: Date.now(),
  };
  all.unshift(full);
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(all));
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
