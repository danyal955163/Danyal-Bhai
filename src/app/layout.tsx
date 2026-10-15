import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://danyal-bhai.vercel.app'),
  title: 'Me AI - Aap ka apna AI dost',
  description: 'Chat with Me AI in Urdu, English, Pashto. Voice assistant by Danyal Bhai.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Me AI - Aap ka apna AI dost',
    description: 'Chat with Me AI in Urdu, English, Pashto.',
    url: 'https://danyal-bhai.vercel.app',
    siteName: 'Me AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Me AI',
    description: 'Chat with Me AI in Urdu, English, Pashto.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
