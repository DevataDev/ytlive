import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Media Manager | YukLive!',
  description: 'Manage your media files and see which streams use them',
  keywords: ['media', 'files', 'manager', 'streaming', 'videos', 'audio'],
};

export default function MediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}