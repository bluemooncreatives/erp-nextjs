"use client";

/**
 * Shared axis pieces, so every chart on a dashboard measures the same way.
 */

/** Reserved width of the y-axis band, in px. */
export const Y_AXIS_WIDTH = 44;

/** Y-axis tick anchored at x=0 (not Recharts' default right-align), so ticks
 *  line up with the card title. Pair with `margin={{ left: 0 }}` — a negative margin is what misaligns labels otherwise. */
export function YAxisTick({
  y,
  payload,
  format,
}: {
  y?: number;
  payload?: { value: number };
  format: (value: number) => string;
}) {
  return (
    <text
      x={0}
      y={y}
      // 0.32em is the usual optical centring for a text baseline against a
      // coordinate that marks the line's middle, and it scales with the font.
      dy="0.32em"
      textAnchor="start"
      fontSize={12}
      fill="var(--muted-foreground)"
    >
      {format(payload?.value ?? 0)}
    </text>
  );
}
