import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TikTok Live | YukLive!',
  description: 'Monitor and manage TikTok live streams',
  keywords: ['tiktok', 'live', 'streaming', 'tiktok live', 'monitoring'],
};

export default function TikTokLiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
