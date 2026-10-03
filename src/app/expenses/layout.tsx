import type { Metadata } from 'next';

// A separate installable app (its own manifest and scope) for logging expenses quickly
export const metadata: Metadata = {
  title: 'Savera Expense Logger',
  description: 'Log Savera Homestay property expenses in seconds (staff only).',
  manifest: '/expenses.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Expenses' },
  robots: { index: false, follow: false },
};

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
