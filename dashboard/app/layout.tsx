import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import SupabaseProvider from '@/components/SupabaseProvider';
import { ToastProvider } from '@/components/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

const darkModeScript = `
  if (localStorage.getItem('darkMode') === 'true' ||
     (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
`;

export const metadata: Metadata = {
  title: 'WebIntel — Autonomous Market Intelligence',
  description: 'AI-powered competitive intelligence platform. Monitor competitors, map markets, and generate sales briefs automatically.',
  keywords: 'competitive intelligence, market research, AI monitoring, competitor analysis, sales intelligence',
  openGraph: {
    title: 'WebIntel — Autonomous Market Intelligence',
    description: 'AI-powered competitive intelligence platform. Monitor competitors, map markets, and generate sales briefs automatically.',
    type: 'website',
    siteName: 'WebIntel',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="deploysafe-verify" content="deploysafe-verify=0520b425e22932a2372ec07c8b8358126ca6293c1004aa374209d0cc0e00b7b1" />
      </head>
      <body>
        <SupabaseProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
