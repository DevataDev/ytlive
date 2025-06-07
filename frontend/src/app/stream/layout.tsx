import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Streams | YukLive!',
  description: 'Manage and monitor your live streams',
  keywords: ['streams', 'live streams', 'streaming', 'youtube', 'management'],
};

export default function StreamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
