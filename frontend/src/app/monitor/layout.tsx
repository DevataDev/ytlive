import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitor Management | YT Live',
  description: 'Monitor and manage system resources and performance',
  keywords: ['monitor', 'management', 'system', 'performance', 'resources'],
};

export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
