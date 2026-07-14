import * as StellarSdk from '@stellar/stellar-sdk';

/**
 * SaloMed Unified Configuration
 * Centralizing all environment variables to ensure parity between Localhost,
 * Vercel, and Render.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || 'CA6X5ZJ24LBJBCRHSAJK5EXB7CMEED2X2JTDLTPBOZC3SM4ABZYNIRCG';
export const EXPECTED_TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const EXPECTED_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS || 'GBSXYPN2XWTJEZPLAMRIYQQVQTCJ2MEQOVOA3G73USGCMEXJ5YXPU2G7';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || StellarSdk.Networks.TESTNET;

/** Stellar Explorer network segment: 'public' for mainnet, 'testnet' otherwise. */
export const STELLAR_NETWORK_KIND: 'testnet' | 'public' =
  NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC ? 'public' : 'testnet';

/** Canonical vault asset: native XLM (also pays Stellar network fees). */
export const ASSET_CODE = 'XLM' as const;

/** Demo/indicative USDC fallback for legacy paths. */
export const PHP_PER_USDC = 56;

/** Demo/indicative XLM fallback. Live UI should refresh from /api/gcash-rate. */
export const PHP_PER_XLM = Number(process.env.NEXT_PUBLIC_PHP_PER_XLM || '11.34');
