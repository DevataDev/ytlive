/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Build-time variables (client-safe only)
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    // Runtime variables (client-safe only)
    API_URL: process.env.API_URL,
    API_BASE_URL: process.env.API_BASE_URL,
    // NOTE: NEXTAUTH_SECRET and JWT_SECRET removed — they are server-only
    // and are automatically available via process.env in server-side code.
    // Exposing them here risks leaking to client bundles.
  },
  reactStrictMode: true,
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  async redirects() {
    return [
      {
        source: '/auth/signin',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/auth/error',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: '__Secure-next-auth.session-token',
          },
        ],
      },
    ];
  },
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  // Remove the rewrites() function entirely
};

module.exports = nextConfig;
