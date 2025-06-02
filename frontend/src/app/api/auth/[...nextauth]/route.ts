// This file handles NextAuth.js authentication for the application
// It re-exports the auth handlers from our centralized auth configuration

import { authOptions } from "@/auth";
import NextAuth from "next-auth";

// Create a custom handler with additional configuration
const handler = NextAuth({
  ...authOptions,
  // Ensure cookies are set with proper domain and secure flags
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
  // Enable debug logging in development
  debug: process.env.NODE_ENV === 'development',
  // Use secure cookies in production
  useSecureCookies: process.env.NODE_ENV === 'production',
});

export { handler as GET, handler as POST };

// Ensure the route is treated as dynamic (no static generation)
export const dynamic = 'force-dynamic';
