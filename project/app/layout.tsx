import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/authContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'UNO - Play with Friends',
  description: 'Play UNO card game with friends online. Create rooms or play 1v1 matches.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#667eea" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
