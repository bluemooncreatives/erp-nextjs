'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect, FormCheckbox } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import type { ThemesRow } from '@/lib/db/schema';
import { saveThemeAction } from './actions';

export function ThemeForm({ theme, colors }: { theme?: ThemesRow; colors: { id: number; name: string | null; value: string }[] }) {
  const [state, action] = useActionState(saveThemeAction, {});
  const [background, setBackground] = useState(theme?.backgroundType ?? 'color');
  return <form action={action} className="space-y-6">
    {theme ? <input type="hidden" name="id" value={theme.id} /> : null}
    <FormAlert variant="error" message={state.error} />
    <Card title="Theme Details"><div className="grid gap-5 md:grid-cols-2">
      <FormInput label="Title" name="title" required maxLength={191} defaultValue={theme?.title ?? ''} />
      <FormSelect label="Color Mode" name="color_mode" defaultValue={theme?.colorMode ?? 'gradient'} options={[{ value: 'gradient', label: 'Gradient' }, { value: 'solid', label: 'Solid' }]} />
      <FormSelect label="Background" name="background_type" value={background} onChange={(event) => setBackground(event.target.value)} options={[{ value: 'color', label: 'Color' }, { value: 'image', label: 'Image' }]} />
      <FormInput label="Background Color" name="background_color" type="color" defaultValue={/^#[0-9a-f]{6}$/i.test(theme?.backgroundColor ?? '') ? theme!.backgroundColor : '#ffffff'} />
      {background === 'image' ? <FormInput label="Background Image (1920 × 1400)" name="background_image" type="file" accept="image/png,image/jpeg" required={!theme?.backgroundImage} /> : null}
      {!theme ? <FormCheckbox label="Set as default" name="is_default" /> : null}
    </div></Card>
    <Card title="Colors"><div className="grid gap-5 md:grid-cols-3">{colors.map((color) => <FormInput key={color.id} label={(color.name ?? '').replaceAll('_', ' ')} name={`color_${color.id}`} type="color" required defaultValue={color.value} />)}</div></Card>
    <div className="flex justify-end gap-4"><Link href="/style/themes">Cancel</Link><SubmitButton>{theme ? 'Update Theme' : 'Create Theme'}</SubmitButton></div>
  </form>;
}
