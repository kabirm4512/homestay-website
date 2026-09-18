import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CRMProvider } from '@/context/CRMContext';
import PWARegister from '@/components/pwa/PWARegister';

export const viewport: Viewport = {
  themeColor: '#1b382b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Savera Homestay - A Boutique Mountain Homestay',
  description: '7-room boutique mountain homestay in Darjeeling with private balconies, panoramic Himalayan views, in-room digital concierge, and authentic mountain hospitality.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Savera Homestay',
  },
  keywords: ['Savera Homestay', 'Darjeeling homestay', 'boutique mountain homestay', 'Hill Cart Road Darjeeling', 'in-room digital concierge'],
  openGraph: {
    title: 'Savera Homestay - A Boutique Mountain Homestay',
    description: 'An intimate mountain sanctuary in Darjeeling with handcrafted suites, private balconies, and majestic Himalayan views.',
    url: 'https://saverahomestay.com',
    siteName: 'Savera Homestay',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
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
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-[#faf8f5] text-forest-900 antialiased selection:bg-forest-100 selection:text-forest-900">
        <CRMProvider>
          <PWARegister />
          {children}
        </CRMProvider>
      </body>
    </html>
  );
}
