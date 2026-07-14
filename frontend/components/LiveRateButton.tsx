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
  const label = loading
    ? 'Updating'
    : hasRate
      ? `${rateSourceLabel(source)} rate:`
      : 'Get rate';

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-5 whitespace-nowrap transition-colors disabled:opacity-60 ${
        live
          ? 'border-blue-100 bg-blue-50/90 text-blue-600 hover:bg-blue-100'
          : 'border-amber-100 bg-amber-50/70 text-amber-700 hover:bg-amber-50'
      } ${className}`}
      title={`PHP to XLM rate: ${rateSourceLabel(source)}`}
    >
      <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
      {label}
      {hasRate && <span className="font-mono">₱{fmtPhp(phpPerXlm)}/XLM</span>}
    </button>
  );
}
