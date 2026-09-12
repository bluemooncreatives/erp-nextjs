export type TrendChange = { direction: 'up' | 'down' | 'flat'; value: string };

/**
 * Movement between the last two buckets of a series, so a tile's delta is
 * derived from the same numbers the chart beside it draws rather than written
 * by hand. Undefined when there is nothing to compare against, which is what
 * keeps a tile from reading "+Infinity%" on its first month of data.
 */
export function periodOverPeriod(values: number[] | undefined): TrendChange | undefined {
  if (!values || values.length < 2) return undefined;
  const latest = values[values.length - 1];
  const previous = values[values.length - 2];
  if (!previous) return undefined;
  const percent = Math.round(((latest - previous) / previous) * 1000) / 10;
  if (percent === 0) return { direction: 'flat', value: '0%' };
  return {
    direction: percent > 0 ? 'up' : 'down',
    value: `${percent > 0 ? '+' : ''}${percent}%`,
  };
}
