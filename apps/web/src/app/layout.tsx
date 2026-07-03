import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { BuildInfoOverlay } from '@/components/build-info-overlay';
import { InlineScript } from '@/components/inline-script';
import { ThemeProvider } from '@/components/theme';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Authprint',
  description: 'Auth-native flow design tool.',
};

// Applied before first paint to avoid a flash of the wrong theme. Mirrors the
// logic in theme.tsx; the ThemeProvider takes over after hydration. (Needs a
// CSP nonce once strict headers land.)
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('authprint-theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
            {children}
            <BuildInfoOverlay />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
