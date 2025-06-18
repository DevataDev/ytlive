import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'YukLive - Multi-Platform Live Streaming Solution | Stream to YouTube, Facebook, TikTok & More',
  description: 'Professional multi-platform live streaming solution for content creators and businesses. Stream simultaneously to YouTube, Facebook, TikTok, Instagram, and more with advanced analytics, media management, and monitoring tools.',
  keywords: [
    'live streaming',
    'multi-platform streaming',
    'YouTube streaming',
    'Facebook Live',
    'TikTok Live',
    'Instagram Live',
    'streaming software',
    'content creator tools',
    'broadcast solution',
    'streaming platform',
    'live streaming service',
    'streaming analytics',
    'media management',
    'streaming monitoring',
    'professional streaming',
    'streaming dashboard'
  ],
  authors: [{ name: 'PT Jejaring Internet Bersama' }],
  creator: 'PT Jejaring Internet Bersama',
  publisher: 'YukLive',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'YukLive - Multi-Platform Live Streaming Solution',
    description: 'Professional multi-platform live streaming solution for content creators and businesses. Stream simultaneously to multiple platforms with advanced analytics and monitoring.',
    siteName: 'YukLive',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'YukLive - Multi-Platform Live Streaming Solution',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YukLive - Multi-Platform Live Streaming Solution',
    description: 'Professional multi-platform live streaming solution for content creators and businesses. Stream simultaneously to multiple platforms.',
    images: ['/twitter-image.jpg'],
    creator: '@yuklive',
    site: '@yuklive',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  category: 'technology',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'YukLive',
            description: 'Professional multi-platform live streaming solution for content creators and businesses',
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            },
            publisher: {
              '@type': 'Organization',
              name: 'PT Jejaring Internet Bersama',
              url: process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com',
            },
            featureList: [
              'Multi-platform streaming',
              'Real-time analytics',
              'Media management',
              'Stream monitoring',
              'YouTube integration',
              'Facebook Live integration',
              'TikTok Live integration',
              'Instagram Live integration',
            ],
            screenshot: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com'}/screenshot.jpg`,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.8',
              ratingCount: '150',
            },
          }),
        }}
      />
      
      {/* Organization Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'YukLive',
            legalName: 'PT Jejaring Internet Bersama',
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com',
            logo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com'}/logo.png`,
            description: 'Professional multi-platform live streaming solution for content creators and businesses',
            foundingDate: '2024',
            sameAs: [
              'https://facebook.com/yuklive',
              'https://twitter.com/yuklive',
              'https://instagram.com/yuklive',
              'https://youtube.com/@yuklive',
            ],
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'customer service',
              availableLanguage: ['English', 'Indonesian'],
            },
          }),
        }}
      />
      
      {/* Website Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'YukLive',
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com',
            description: 'Professional multi-platform live streaming solution',
            publisher: {
              '@type': 'Organization',
              name: 'PT Jejaring Internet Bersama',
            },
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yuklive.com'}/search?q={search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      
      {children}
    </>
  );
}
