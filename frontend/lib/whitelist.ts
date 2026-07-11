export type ProviderType = 'hospital' | 'pharmacy';

export interface Provider {
  name: string;
  location: string;
  type: ProviderType;
  /** Demo-ledger provider ID. Real Stellar mode requires a valid whitelisted G-address. */
  paymentTarget: string;
}
export const HOSPITALS: Provider[] = [
  {
    name: 'Philippine General Hospital (Demo)',
    location: 'Simulated provider',
    type: 'hospital',
    paymentTarget: 'demo-pgh',
  },
  {
    name: 'Philippine Heart Center (Demo)',
    location: 'Simulated provider',
    type: 'hospital',
    paymentTarget: 'demo-heart-center',
  },
];

export const PHARMACIES: Provider[] = [
  {
    name: 'Mercury Drug (Demo)',
    location: 'Simulated provider',
    type: 'pharmacy',
    paymentTarget: 'demo-mercury',
  },
];

export function getProviders(type: ProviderType): Provider[] {
  return type === 'hospital' ? HOSPITALS : PHARMACIES;
}
