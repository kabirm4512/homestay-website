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
  title: 'Whispering Pines Sanctuary | Luxury Boutique Homestay CRM & Concierge',
  description: '7-room luxury boutique homestay CRM, in-room digital concierge, operations hub, and financial accounting platform in the Himalayas.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WP Concierge',
  },
  keywords: ['homestay crm', 'boutique homestay', 'digital concierge', 'tape chart', 'financial ledger'],
  openGraph: {
    title: 'Whispering Pines Sanctuary | Boutique Homestay CRM',
    description: 'An intimate mountain sanctuary with handcrafted cedar suites, organic farm dining, and serene nature.',
    url: 'https://whisperingpines.com',
    siteName: 'Whispering Pines Sanctuary',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
        width: 1200,
        height: 630,
        alt: 'Whispering Pines Sanctuary',
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
