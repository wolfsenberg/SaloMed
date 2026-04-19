'use client';

import { createContext, useContext } from 'react';
import type { HealthVault } from '@/lib/contract';
import { EMPTY_VAULT } from '@/lib/contract';

export interface WalletCtx {
  address:      string | null;
  vault:        HealthVault;
  phpRate:      number;
  connecting:   boolean;
  loadingVault: boolean;
  connectError: string | null;
  handleConnect:    () => void;
  handleDisconnect: () => void;
  refreshVault:     () => void;
  clearError:       () => void;
  switchRoute:      (path: string) => void;
}

export const WalletContext = createContext<WalletCtx>({
  address: null, vault: EMPTY_VAULT, phpRate: 56,
  connecting: false, loadingVault: false, connectError: null,
  handleConnect: () => {}, handleDisconnect: () => {},
  refreshVault: () => {}, clearError: () => {}, switchRoute: () => {},
});

export const useWallet = () => useContext(WalletContext);
