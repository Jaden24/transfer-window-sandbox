/**
 * Display-layer currency conversion.
 *
 * This is deliberately *not* wired into `rules.ts` or the WebMCP tools. PSR is
 * denominated in pounds, the tools return pounds, and an agent should never see
 * the unit shift under it. This module exists purely so a human reading the
 * screen can flip to dollars.
 */

import { createContext, useContext } from 'react';
import { fmtMoney } from './rules';

export type Currency = 'GBP' | 'USD';

/** Illustrative rate, in keeping with the rest of the data. */
export const USD_PER_GBP = 1.27;

export function convert(gbp: number, currency: Currency): number {
  return currency === 'USD' ? gbp * USD_PER_GBP : gbp;
}

/** Format an amount held in pounds, rendered in the chosen currency. */
export function fmt(gbp: number, currency: Currency): string {
  const n = convert(gbp, currency);
  if (currency === 'GBP') return fmtMoney(n);

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m >= 100 ? Math.round(m) : m.toFixed(1)}m`;
  }
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Rewrite pound figures embedded in prose — violation messages arrive from the
 * rules engine pre-formatted, and a half-converted screen reads worse than
 * either currency on its own.
 */
export function convertText(text: string, currency: Currency): string {
  if (currency === 'GBP') return text;
  return text.replace(/£([\d.]+)(m|k)?/g, (_match, num: string, unit?: string) => {
    const mult = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
    return fmt(parseFloat(num) * mult, 'USD');
  });
}

export const CurrencyContext = createContext<Currency>('GBP');
export const useCurrency = () => useContext(CurrencyContext);

/** Convenience: a formatter already bound to the active currency. */
export function useMoney() {
  const currency = useCurrency();
  return {
    currency,
    fmt: (gbp: number) => fmt(gbp, currency),
    text: (s: string) => convertText(s, currency),
  };
}
