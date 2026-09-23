import type { Metadata, Viewport } from 'next';
import { Outfit, Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { CRMProvider } from '@/context/CRMContext';
import PWARegister from '@/components/pwa/PWARegister';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#25479E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Savera Homestay - Boutique Mountain Retreat | Darjeeling',
  description: 'Luxury 7-room boutique mountain homestay in Darjeeling with private balconies, panoramic Himalayan views, in-room digital concierge, and authentic mountain hospitality.',
  metadataBase: new URL('https://saverahomestay.in'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Savera Homestay',
  },
  keywords: ['Savera Homestay', 'Darjeeling homestay', 'boutique mountain homestay', 'Hill Cart Road Darjeeling', 'in-room digital concierge', 'Wizz Holidays partner homestay'],
  openGraph: {
    title: 'Savera Homestay - Boutique Mountain Retreat | Darjeeling',
    description: 'An intimate mountain sanctuary in Darjeeling with handcrafted suites, private balconies, and majestic Himalayan views.',
    url: 'https://saverahomestay.in',
    siteName: 'Savera Homestay',
    images: [
      {
        url: '/images/hero/hero-room-1.jpg',
        width: 1200,
        height: 630,
        alt: 'Savera Homestay Darjeeling',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`scroll-smooth ${outfit.variable} ${inter.variable}`}>
      <head>
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-18463419248"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18463419248');
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F3F7FF] text-[#101828] font-sans antialiased selection:bg-[#25479E]/15 selection:text-[#25479E]">
        <CRMProvider>
          <PWARegister />
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
