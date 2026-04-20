import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * SaloMed Unified Configuration
 * Centralizing all environment variables to ensure parity between Localhost,
 * Vercel, and Render.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

export const PHP_PER_XLM = 56; // Demo constant
