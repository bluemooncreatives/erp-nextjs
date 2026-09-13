export function formatFieldNumber(value: number, field: { format: string | null; decimal: string | null; label: string | null; position: string | null }): string {
  if (!field.format || field.format === 'unformat') return String(value);
  const digits = Math.max(0, Math.min(6, Number(field.decimal) || 0));
  const number = value.toFixed(digits);
  if (field.format.toLowerCase() === 'usd') return `$${number}`;
  if (field.format === 'percent') return `${number}%`;
  if (field.format === 'custom') return field.position === 'left' ? `${field.label ?? ''}${number}` : `${number}${field.label ?? ''}`;
  return number;
}
