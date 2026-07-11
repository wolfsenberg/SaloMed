import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * SaloMed Unified Configuration
 * Centralizing all environment variables to ensure parity between Localhost,
 * Vercel, and Render.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'CAO3K6OYB5A3VNVV3HKCSVG3ZZ442DZCDKAXG4CTSLBTN7FOYCCBRZ34';
export const EXPECTED_TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || '';
export const EXPECTED_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS || '';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

/** Canonical vault asset. Native XLM is used only for Stellar network fees. */
export const ASSET_CODE = 'USDC' as const;

/** Demo/indicative fallback. Settlement credits must use an executed rate. */
export const PHP_PER_USDC = 56;

/** @deprecated Kept only while old components are migrated to canonical USDC naming. */
export const PHP_PER_XLM = PHP_PER_USDC;
