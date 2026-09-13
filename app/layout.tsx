import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'flatpickr/dist/flatpickr.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { config } from '@/lib/config';
import { documentLocale } from '@/lib/i18n';

// The design system asks for DM Sans and JetBrains Mono. `next/font` self-hosts
// and preloads both, and exposes them as the variables `--font-sans` and
// `--font-mono` are built from in globals.css.
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: config.app.name,
    template: `%s | ${config.app.name}`,
  },
  description: 'Business ERP - sales, purchasing, inventory, accounting and HR.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `ltr_rtl` on the language row - the Blade put `dir="rtl"` and an `rtl`
  // class on <html> for a right-to-left language, which is what flips the
  // layout. Without this the Arabic pack translated the words and left the
  // page the wrong way round.
  const { lang, dir } = await documentLocale();

  return (
    <html
      lang={lang}
      dir={dir}
      className={`${dmSans.variable} ${jetBrainsMono.variable}`}
      suppressHydrationWarning
    >
      {/* The background comes from `--background`, so it follows the theme
          rather than being pinned to a grey. */}
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
