import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TikTok Search | YukLive!',
  description: 'Search and discover TikTok live streams',
  keywords: ['tiktok', 'search', 'discover', 'tiktok search', 'live streams'],
};

export default function TikTokSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
