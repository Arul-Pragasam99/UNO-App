import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/authContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'UNO - Play with Friends',
  description: 'Play UNO card game with friends online. Create rooms or play 1v1 matches.',
  // Remove viewport from here
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: true, // Better for accessibility, or set to false if needed
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