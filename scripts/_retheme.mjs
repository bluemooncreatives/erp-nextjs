// One-off codemod: rewrites the TailAdmin palette classes onto the design
// system's semantic tokens.
//
// The tokens already answer light and dark, so a `dark:` twin of a mapped class
// is dropped rather than translated.
//
// Print surfaces are skipped: those sheets are always ink on white paper, so
// their greys are deliberate and must not follow the screen theme.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const roots = ['app', 'components', 'layout'];
const skip = [
  path.normalize('app/(print)'),
  path.normalize('components/erp/print-invoice.tsx'),
  path.normalize('components/ui'), // the design system's own files
];

/** Classes whose dark twin is redundant once the light one is a token. */
const DROP_DARK = [
  /\bdark:text-gray-(?:200|300|400|500|600)\b/g,
  /\bdark:text-white\/(?:90|80|70|60|50)\b/g,
  /\bdark:text-white\b/g,
  /\bdark:bg-gray-(?:800|900|950)\b/g,
  /\bdark:bg-white\/\[?0?\.?0?\d+\]?\b/g,
  /\bdark:bg-white\/\d+\b/g,
  /\bdark:border-gray-(?:700|800|900)\b/g,
  /\bdark:border-white\/\[?[\d.]+\]?\b/g,
  /\bdark:ring-gray-(?:700|800)\b/g,
  /\bdark:divide-white\/\[?[\d.]+\]?\b/g,
  /\bdark:divide-gray-\d+\b/g,
  /\bdark:placeholder:text-white\/\d+\b/g,
  /\bdark:text-brand-\d+\b/g,
  /\bdark:bg-brand-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:border-brand-\d+\b/g,
  /\bdark:text-error-\d+\b/g,
  /\bdark:bg-error-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:border-error-\d+(?:\/\d+)?\b/g,
  /\bdark:text-success-\d+\b/g,
  /\bdark:bg-success-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:border-success-\d+(?:\/\d+)?\b/g,
  /\bdark:text-warning-\d+\b/g,
  /\bdark:text-orange-\d+\b/g,
  /\bdark:bg-warning-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:border-warning-\d+(?:\/\d+)?\b/g,
  /\bdark:text-blue-light-\d+\b/g,
  /\bdark:bg-blue-light-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:border-blue-light-\d+(?:\/\d+)?\b/g,
  /\bdark:hover:bg-white\/\d+\b/g,
  /\bdark:hover:bg-gray-\d+\b/g,
  /\bdark:hover:text-gray-\d+\b/g,
  /\bdark:hover:text-white\b/g,
  /\bdark:hover:bg-brand-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:hover:bg-error-\d+(?:\/\[?[\d.]+\]?)?\b/g,
  /\bdark:group-hover:text-gray-\d+\b/g,
  /\bdark:fill-gray-\d+\b/g,
  /\bdark:stroke-gray-\d+\b/g,
  /\bdark:divide-gray-\d+\b/g,
];

/** Ordered: longer, more specific patterns first. */
const MAP = [
  // Text
  [/\btext-gray-(?:800|900)\b/g, 'text-foreground'],
  [/\btext-gray-700\b/g, 'text-foreground'],
  [/\btext-gray-(?:300|400|500|600)\b/g, 'text-muted-foreground'],
  [/\btext-white\/\d+\b/g, 'text-foreground'],
  [/\btext-brand-\d+\b/g, 'text-primary'],
  [/\btext-error-\d+\b/g, 'text-destructive'],
  [/\btext-success-\d+\b/g, 'text-success'],
  [/\btext-warning-\d+\b/g, 'text-warning'],
  [/\btext-orange-\d+\b/g, 'text-warning'],
  [/\btext-blue-light-\d+\b/g, 'text-info'],
  [/\bhover:text-gray-(?:700|800|900)\b/g, 'hover:text-foreground'],
  [/\bhover:text-gray-(?:300|400|500|600)\b/g, 'hover:text-muted-foreground'],
  [/\bhover:text-brand-\d+\b/g, 'hover:text-primary'],
  [/\bgroup-hover:text-gray-\d+\b/g, 'group-hover:text-foreground'],

  // Backgrounds
  [/\bbg-brand-\d+\/\[?([\d.]+)\]?\b/g, 'bg-primary/10'],
  [/\bbg-brand-(?:25|50|100|200)\b/g, 'bg-primary/10'],
  [/\bbg-brand-\d+\b/g, 'bg-primary'],
  [/\bhover:bg-brand-(?:25|50|100|200)\b/g, 'hover:bg-primary/10'],
  [/\bhover:bg-brand-\d+\/\[?[\d.]+\]?\b/g, 'hover:bg-primary/20'],
  [/\bhover:bg-brand-\d+\b/g, 'hover:bg-primary/90'],
  [/\bbg-error-\d+\/\[?[\d.]+\]?\b/g, 'bg-destructive/10'],
  [/\bbg-error-(?:25|50|100)\b/g, 'bg-destructive/10'],
  [/\bbg-error-\d+\b/g, 'bg-destructive'],
  [/\bhover:bg-error-(?:25|50|100)\b/g, 'hover:bg-destructive/10'],
  [/\bhover:bg-error-\d+\b/g, 'hover:bg-destructive/90'],
  [/\bbg-success-(?:25|50|100)\b/g, 'bg-success/10'],
  [/\bbg-success-\d+\/\[?[\d.]+\]?\b/g, 'bg-success/10'],
  [/\bbg-success-\d+\b/g, 'bg-success'],
  [/\bbg-warning-(?:25|50|100)\b/g, 'bg-warning/10'],
  [/\bbg-warning-\d+\/\[?[\d.]+\]?\b/g, 'bg-warning/10'],
  [/\bbg-warning-\d+\b/g, 'bg-warning'],
  [/\bbg-blue-light-(?:25|50|100)\b/g, 'bg-info/10'],
  [/\bbg-blue-light-\d+\b/g, 'bg-info'],
  [/\bbg-gray-(?:25|50|100|200)\b/g, 'bg-muted'],
  [/\bbg-gray-(?:800|900|950)\b/g, 'bg-card'],
  [/\bhover:bg-gray-(?:25|50|100|200)\b/g, 'hover:bg-muted'],
  [/\bbg-white\b(?!\/)/g, 'bg-card'],
  [/\bbg-white\/\[?[\d.]+\]?\b/g, 'bg-card'],

  // Borders, rings and rules
  [/\bborder-gray-\d+\b/g, 'border-border'],
  [/\bborder-white\/\[?[\d.]+\]?\b/g, 'border-border'],
  [/\bborder-brand-\d+\b/g, 'border-ring'],
  [/\bborder-error-\d+\b/g, 'border-destructive'],
  [/\bborder-success-\d+\b/g, 'border-success'],
  [/\bborder-warning-\d+\b/g, 'border-warning'],
  [/\bborder-blue-light-\d+\b/g, 'border-info'],
  [/\bfocus:border-brand-\d+\b/g, 'focus:border-ring'],
  [/\bring-gray-\d+\b/g, 'ring-border'],
  [/\bring-brand-\d+(?:\/\[?[\d.]+\]?)?\b/g, 'ring-ring/50'],
  [/\bring-error-\d+(?:\/\[?[\d.]+\]?)?\b/g, 'ring-destructive/20'],
  [/\bdivide-gray-\d+\b/g, 'divide-border'],
  [/\bdivide-white\/\[?[\d.]+\]?\b/g, 'divide-border'],
  [/\bplaceholder:text-gray-\d+\b/g, 'placeholder:text-muted-foreground'],

  // SVG paint
  [/\bfill-gray-\d+\b/g, 'fill-muted-foreground'],
  [/\bfill-brand-\d+\b/g, 'fill-primary'],
  [/\bstroke-gray-\d+\b/g, 'stroke-muted-foreground'],

  // Type scale and shadows the template defined
  [/\btext-theme-xs\b/g, 'text-xs'],
  [/\btext-theme-sm\b/g, 'text-sm'],
  [/\btext-theme-xl\b/g, 'text-xl'],
  [/\btext-title-sm\b/g, 'text-2xl'],
  [/\btext-title-md\b/g, 'text-3xl'],
  [/\bshadow-theme-xs\b/g, 'shadow-xs'],
  [/\bshadow-theme-sm\b/g, 'shadow-sm'],
  [/\bshadow-theme-md\b/g, 'shadow-md'],
  [/\bshadow-theme-lg\b/g, 'shadow-lg'],
  [/\bshadow-theme-xl\b/g, 'shadow-xl'],
  [/\bfocus:outline-hidden\b/g, 'focus:outline-none'],
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (skip.some((s) => path.normalize(full).startsWith(s))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = roots.flatMap((root) => walk(root));
let changed = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  for (const pattern of DROP_DARK) after = after.replace(pattern, '');
  for (const [pattern, replacement] of MAP) after = after.replace(pattern, replacement);

  // Tidy the whitespace the dropped classes left behind, inside class strings.
  after = after.replace(/className="([^"]*)"/g, (match, value) => {
    const cleaned = value.replace(/[ \t]{2,}/g, ' ').replace(/^ | $/g, '');
    return `className="${cleaned}"`;
  });
  after = after.replace(/`([^`]*?)`/gs, (match, value) =>
    value.includes('\n') ? match : '`' + value.replace(/[ \t]{2,}/g, ' ') + '`',
  );

  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}

console.log(`rewrote ${changed} of ${files.length} files`);
