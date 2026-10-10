import type { Metadata, Viewport } from 'next';

// A separate installable app (its own manifest and scope) for logging expenses quickly.
// Install link: https://<your-site>/expenses  (open on the phone, then "Install" / "Add to Home Screen").
export const metadata: Metadata = {
  title: 'Savera Expense Logger',
  description: 'Log signed Savera Homestay expenses in seconds, even offline (staff only).',
  manifest: '/expenses.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Expenses' },
  icons: { icon: '/icons/expenses-192.png', apple: '/icons/expenses-180.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#142820',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
