import type { ReactNode } from 'react';
import { AppProviders } from '@/theme/AppProviders';

export const metadata = {
  title: 'People HRMS',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#1a73e8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Flex:opsz,wght@8..144,400..700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,-50..200&display=swap"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body style={{ margin: 0 }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
