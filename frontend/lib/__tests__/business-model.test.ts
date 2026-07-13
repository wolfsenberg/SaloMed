import { describe, expect, it } from 'vitest';

import {
  PROVIDER_SERVICE_FEE_RATE,
  PROVIDER_SERVICE_FEE_WAIVED,
  calcPadala,
  calcPayment,
} from '../contract';

describe('SaloMed business policy', () => {
  it('keeps patients fee-free while exposing the provider-side pilot fee policy', () => {
    const payment = calcPayment(25, 'hospital');

    expect(payment.feeRate).toBe(PROVIDER_SERVICE_FEE_RATE);
    expect(PROVIDER_SERVICE_FEE_WAIVED).toBe(true);
    expect(payment.salomedFee).toBe(0);
    expect(payment.effectiveCost).toBe(25);
    expect(payment.merchantReceives).toBe(25);
  });

  it('keeps padala free and non-points earning', () => {
    const padala = calcPadala(10);

    expect(padala.feeRate).toBe(0);
    expect(padala.salomedFee).toBe(0);
    expect(padala.recipientReceives).toBe(10);
    expect(padala.ptsEarned).toBe(0);
  });
});
