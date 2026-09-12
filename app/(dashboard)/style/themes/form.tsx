'use client';
import { useActionState, useState, type CSSProperties } from 'react';
import { LayoutDashboard, Package, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/erp/page';
import { FormAlert, FormInput, FormSelect, FormCheckbox } from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import type { ThemesRow } from '@/lib/db/schema';
import { saveThemeAction } from './actions';

export function ThemeForm({ theme, colors }: { theme?: ThemesRow; colors: { id: number; name: string | null; value: string }[] }) {
  const [state, action] = useActionState(saveThemeAction, {});
  const [palette, setPalette] = useState(() => Object.fromEntries(colors.map((color) => [color.id, color.value])));
  const brand = palette[colors.find((color) => color.name === 'base_color')?.id ?? -1] ?? '#415094';
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
    <Card title="Sidebar preview" desc="The base color controls the sidebar tint, selected items, hover states, borders and focus rings. Save and activate this theme to apply it across the app.">
      <div className="erp-theme w-full overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-3" style={{ '--erp-base-color': brand } as CSSProperties}>
        <div className="grid gap-3 sm:grid-cols-[210px_minmax(0,1fr)]">
          <div className="space-y-1 text-sidebar-foreground">
            <p className="px-3 py-3 text-base font-semibold">ERP</p>
            <div className="flex items-center gap-3 rounded-md bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground"><LayoutDashboard className="size-4" />Dashboard</div>
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><Users className="size-4" />Contacts</div>
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><Package className="size-4" />Products</div>
            <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><Settings className="size-4" />Settings</div>
          </div>
          <div className="rounded-xl bg-card p-5 text-card-foreground shadow-xs">
            <p className="font-semibold">Your workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">A branded sidebar with a clear content surface.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground">Selected item</span>
              <span className="rounded-md border border-sidebar-border px-3 py-2 text-sm">Border</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
    <Card title="Colors"><div className="grid gap-5 md:grid-cols-3">{colors.map((color) => <FormInput key={color.id} label={(color.name ?? '').replaceAll('_', ' ')} name={`color_${color.id}`} type="color" required value={palette[color.id]} onInput={(event) => { const value = event.currentTarget.value; setPalette((current) => ({ ...current, [color.id]: value })); }} />)}</div></Card>
    <div className="flex justify-end gap-4"><Link href="/style/themes">Cancel</Link><SubmitButton>{theme ? 'Update Theme' : 'Create Theme'}</SubmitButton></div>
  </form>;
}
