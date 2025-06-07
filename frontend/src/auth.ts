import NextAuth, { type NextAuthOptions, type DefaultSession, type User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';
import { configService } from '@/lib/config';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      username: string;
      email: string;
      name: string;
      backendToken: string;
      isAdmin: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    username: string;
    email: string;
    name: string;
    backendToken: string;
    isAdmin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    email: string;
    name: string;
    backendToken: string;
    isAdmin: boolean;
  }
}

interface Credentials {
  email: string;
  password: string;
}

interface TokenPayload {
  user_id?: string;
  sub?: string;
  username?: string;
  email?: string;
  name?: string;
  is_admin?: boolean;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
          const res = await fetch(`${apiUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Authentication failed');
          }

          const data = await res.json();

          if (!data.token) {
            throw new Error('No token received');
          }

          // Decode the JWT token to get user info
          const payload: TokenPayload = JSON.parse(
            Buffer.from(data.token.split('.')[1], 'base64').toString()
          );

          // Ensure required fields have default values
          const user: User = {
            id: payload.user_id || payload.sub || '',
            username: payload.username || payload.email?.split('@')[0] || 'user',
            email: payload.email || 'no-email@example.com',
            name: payload.name || 'User',
            backendToken: data.token,
            isAdmin: payload.is_admin || false,
          };
          return user;
        } catch (error) {
          console.error('Auth error:', error);
          throw new Error(error instanceof Error ? error.message : 'Authentication failed');
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.email = user.email || '';
        token.name = user.name || '';
        token.backendToken = user.backendToken;
        token.isAdmin = (user as any).isAdmin || false;
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.sub || token.id || '',
        username: token.username || 'user',
        email: token.email || 'no-email@example.com',
        name: token.name || 'User',
        backendToken: token.backendToken,
        isAdmin: token.isAdmin || false,
      };
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (!url) return baseUrl;
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch (e) {
        return baseUrl;
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
      ? `__Secure-next-auth.session-token` 
      : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
      },
    },
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key', // Fallback for development
  useSecureCookies: process.env.NODE_ENV === 'production',
  // Enable debug logging for auth in development
  logger: process.env.NODE_ENV === 'development' ? {
    error(code, metadata) {
      console.error('Auth error:', { code, metadata });
    },
    warn(code) {
      console.warn('Auth warning:', code);
    },
    debug(code, metadata) {
      console.debug('Auth debug:', { code, metadata });
    },
  } : undefined,
};

// Create the NextAuth handler
const handler = NextAuth({
  ...authOptions,
  // Override the default error page
  pages: {
    ...authOptions.pages,
    error: '/login',
  },
});

export { handler as GET, handler as POST };

// Export the signIn and signOut functions
export { signIn, signOut } from 'next-auth/react';

// This ensures the route is treated as dynamic (no static generation)
export const dynamic = 'force-dynamic';
