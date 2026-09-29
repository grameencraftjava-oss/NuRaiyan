import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nuraiyan - Modern Real-Time Social Network',
  description: 'Nuraiyan - An everlasting sanctuary of love and connection, crafted for Raiyan & Nusrat.',
};

import { LudoInviteListener } from '../components/LudoInviteListener';
import { GlobalCallHandler } from '../components/GlobalCallHandler';
import { GlobalNotificationListener } from '../components/GlobalNotificationListener';

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
      </body>
    </html>
  );
}

