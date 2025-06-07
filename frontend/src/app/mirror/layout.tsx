import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mirror Management | YukLive!',
  description: 'Manage your stream mirrors and their settings',
  keywords: ['mirror', 'streaming', 'management', 'yuklive', 'stream mirror'],
};

export default function MirrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
