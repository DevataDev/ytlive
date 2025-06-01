import 'next-auth';

// Extend the built-in session and user types
declare module 'next-auth' {
  /**
   * Extend the built-in user types
   */
  interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    backendToken: string;
  }

  /**
   * Extend the built-in session types
   */
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      email: string;
      accessToken: string;
    } & DefaultSession['user'];
    error?: string;
    expires: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extend the built-in JWT types
   */
  interface JWT {
    id: string;
    username: string;
    name: string;
    email: string;
    accessToken: string;
    error?: string;
  }
}

/**
 * Export the AuthUser type for use in the application
 */
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  accessToken: string;
}
