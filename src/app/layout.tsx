import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import './globals.css';
import { CRMProvider } from '@/context/CRMContext';
import PWARegister from '@/components/pwa/PWARegister';

// Self-hosted variable fonts (OFL-1.1, see src/app/fonts): no build-time or runtime call to Google.
const playfair = localFont({
  src: './fonts/playfair-display-latin-wght.woff2',
  weight: '400 900',
  variable: '--font-playfair',
  display: 'swap',
});

const outfit = localFont({
  src: './fonts/outfit-latin-wght.woff2',
  weight: '100 900',
  variable: '--font-outfit',
  display: 'swap',
});

const inter = localFont({
  src: './fonts/inter-latin-wght.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#142820',
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
    <html lang="en" className={`scroll-smooth ${playfair.variable} ${outfit.variable} ${inter.variable}`}>
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
      <body className="min-h-screen bg-[#FAF8F5] text-[#1A1D1A] font-sans antialiased selection:bg-[#C85A32]/20 selection:text-[#C85A32]">
        <CRMProvider>
          <PWARegister />
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
