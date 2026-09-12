import type { CSSProperties } from 'react';

export function themeStyle(theme: { colorMode: string; backgroundType: string; backgroundColor: string; backgroundImage: string }, colors: { name: string | null; value: string }[]): CSSProperties {
  const style: Record<string, string> = {};
  const palette = new Map(colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color.value)).map((color) => [color.name, color.value]));
  for (const [name, value] of palette) if (name && /^[a-z_-]+$/.test(name)) style[`--erp-${name.replaceAll('_', '-')}`] = value;
  const base = palette.get('base_color');
  if (base) {
    style['--color-brand-500'] = base;
    style['--color-brand-600'] = base;
    style['--erp-primary-background'] = base;
  }
  const gradient = ['gradient_1', 'gradient_2', 'gradient_3'].map((name) => palette.get(name));
  if (theme.colorMode === 'gradient' && gradient.every(Boolean)) style['--erp-primary-background'] = `linear-gradient(90deg, ${gradient.join(', ')})`;
  if (/^#[0-9a-f]{6}$/i.test(theme.backgroundColor)) style.backgroundColor = theme.backgroundColor;
  if (theme.backgroundType === 'image' && theme.backgroundImage) {
    const image = '/' + theme.backgroundImage.replace(/^\/?public\//, '').replace(/^\/+/, '');
    style.backgroundImage = `url(${JSON.stringify(image)})`;
    style.backgroundSize = 'cover';
    style.backgroundAttachment = 'fixed';
  }
  return style as CSSProperties;
}
