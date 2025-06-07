import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | YukLive!',
  description: 'Overview of your live streaming analytics and statistics',
  keywords: ['dashboard', 'analytics', 'statistics', 'streaming', 'youtube'],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
