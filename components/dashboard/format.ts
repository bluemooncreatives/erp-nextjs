/**
 * How a card should print its figures.
 *
 * The source project handed each card a `formatValue` callback. These cards are
 * rendered from server components, and a function cannot cross that boundary -
 * so the caller describes the format and the card does the formatting itself.
 */
export type ValueFormat = {
  /** Prefixed to the number, followed by a non-breaking space. */
  symbol?: string;
  /** Rounds to thousands ("$ 12k"), for axis ticks where space is tight. */
  compact?: boolean;
  /** Decimal places for the non-compact form. Defaults to none. */
  decimals?: number;
};

export function formatValue(value: number, format?: ValueFormat): string {
  if (!format) return String(value);

  const prefix = format.symbol ? `${format.symbol} ` : '';

  if (format.compact && Math.abs(value) >= 1000) {
    return `${prefix}${Math.round(value / 1000).toLocaleString('en-US')}k`;
  }

  return `${prefix}${value.toLocaleString('en-US', {
    minimumFractionDigits: format.decimals ?? 0,
    maximumFractionDigits: format.decimals ?? 0,
  })}`;
}
