'use client';

import { RefreshCw } from 'lucide-react';

import { fmtPhp } from '@/lib/format';
import { rateSourceLabel, XlmPhpRateSource } from '@/lib/use-xlm-php-rate';

interface Props {
  phpPerXlm: number;
  source: XlmPhpRateSource;
  loading: boolean;
  onRefresh: () => void;
  className?: string;
}

export default function LiveRateButton({ phpPerXlm, source, loading, onRefresh, className = '' }: Props) {
  const live = source === 'pdax_live' || source === 'coingecko_live';
  const hasRate = Number.isFinite(phpPerXlm) && phpPerXlm > 0;
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-all disabled:opacity-60 ${
        live
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
      } ${className}`}
      title={`PHP to XLM rate: ${rateSourceLabel(source)}`}
    >
      <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Updating' : hasRate ? (live ? 'Live rate' : 'Refresh rate') : 'Get rate'}
      {hasRate && <span className="font-mono">₱{fmtPhp(phpPerXlm)}/XLM</span>}
    </button>
  );
}
