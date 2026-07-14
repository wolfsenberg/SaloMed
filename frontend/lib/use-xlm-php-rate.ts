'use client';

import { useCallback, useEffect, useState } from 'react';

import { API_URL, PHP_PER_XLM } from './config';

export type XlmPhpRateSource =
  | 'pdax_live'
  | 'coingecko_live'
  | 'configured_indicative'
  | 'fixed_demo'
  | 'fixed_fallback'
  | 'indicative';

interface RateResponse {
  php_per_xlm?: number;
  php_per_usdc?: number;
  source?: XlmPhpRateSource;
  pdax_enabled?: boolean;
}

export function rateSourceLabel(source: XlmPhpRateSource): string {
  if (source === 'pdax_live') return 'Live PDAX';
  if (source === 'coingecko_live') return 'Live market';
  if (source === 'configured_indicative') return 'Indicative';
  if (source === 'indicative') return 'Indicative';
  return 'Fallback';
}

export function useXlmPhpRate() {
  const [phpPerXlm, setPhpPerXlm] = useState(PHP_PER_XLM);
  const [source, setSource] = useState<XlmPhpRateSource>('configured_indicative');
  const [pdaxEnabled, setPdaxEnabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/gcash-rate`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Rate request failed (${response.status})`);
      const data = (await response.json()) as RateResponse;
      const nextRate = Number(data.php_per_xlm ?? data.php_per_usdc);
      if (Number.isFinite(nextRate) && nextRate > 0) {
        setPhpPerXlm(nextRate);
      }
      setSource(data.source ?? 'configured_indicative');
      setPdaxEnabled(Boolean(data.pdax_enabled));
      setUpdatedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not refresh PHP/XLM rate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    phpPerXlm,
    source,
    pdaxEnabled,
    updatedAt,
    loading,
    error,
    isLive: source === 'pdax_live' || source === 'coingecko_live',
    refresh,
  };
}
