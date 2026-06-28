import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/lib/toastContext';
import Toast from '@/components/Toast';
import './globals.css';
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: 'UNO - Play Together',
  description: 'Play UNO card game with friends online. Create rooms or play 1v1 matches.',
  icons: {
    icon: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#667eea" />
        <link rel="icon" href="/icon.png" type="image/png" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
            {children}
            <Toast />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}