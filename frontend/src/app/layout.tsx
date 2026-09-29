import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nuraiyan - Modern Real-Time Social Network',
  description: 'Nuraiyan - An everlasting sanctuary of love and connection, crafted for Raiyan & Nusrat.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nuraiyan',
  },
};

export const viewport: Viewport = {
  themeColor: '#070A12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { LudoInviteListener } from '../components/LudoInviteListener';
import { GlobalCallHandler } from '../components/GlobalCallHandler';
import { GlobalNotificationListener } from '../components/GlobalNotificationListener';
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#070A12] min-h-screen text-slate-100">
        {children}
        <LudoInviteListener />
        <GlobalCallHandler />
        <GlobalNotificationListener />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}

