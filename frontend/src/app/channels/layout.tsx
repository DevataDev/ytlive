import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Channels | YukLive!',
  description: 'Manage and monitor your YouTube channels',
  keywords: ['channels', 'youtube channels', 'youtube', 'management', 'yuklive'],
  openGraph: {
    title: 'Channels | YukLive!',
    description: 'Manage and monitor your YouTube channels',
    url: 'https://yuklive.com/channels',
    siteName: 'YukLive!',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Channels | YukLive!',
    description: 'Manage and monitor your YouTube channels',
    creator: '@yuklive',
  },
};

export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
