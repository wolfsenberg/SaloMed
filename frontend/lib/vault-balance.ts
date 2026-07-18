import { PHP_PER_XLM } from './config';

const STROOPS_PER_XLM = 10_000_000;

export function accountingPhpPerXlm(runtimePhpPerAsset?: string | number | null): number {
  const rate = Number(runtimePhpPerAsset);
  return Number.isFinite(rate) && rate > 0 ? rate : PHP_PER_XLM;
}

export function vaultPhpValue(balanceStroops: bigint, runtimePhpPerAsset?: string | number | null): number {
  return (Number(balanceStroops) / STROOPS_PER_XLM) * accountingPhpPerXlm(runtimePhpPerAsset);
}
