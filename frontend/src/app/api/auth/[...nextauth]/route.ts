// This file is the entry point for NextAuth.js API routes
// It re-exports the auth handlers from our centralized auth configuration

import { authOptions } from "@/auth";
import NextAuth from "next-auth";

// Create a custom handler with additional configuration
const handler = NextAuth({
  ...authOptions,
  // Ensure cookies are set with proper domain and secure flags
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60, // 1 hour
      },
    },
  },
  // Enable debug logging in development
  debug: process.env.NODE_ENV === 'development',
  // Use secure cookies in production
  useSecureCookies: process.env.NODE_ENV === 'production',
});

export { handler as GET, handler as POST };

// Re-export auth options for server components
export { authOptions } from '@/auth';

// Ensure the route is treated as dynamic (no static generation)
export const dynamic = 'force-dynamic';
export { signIn, signOut } from 'next-auth/react';
