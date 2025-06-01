'use client';

import { createContext, useContext, useMemo } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';

// Import the AuthUser type from our types
import type { AuthUser } from '@/types/next-auth';

type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';

type AuthContextType = {
  // User state
  user: AuthUser | null;
  session: any;
  loading: boolean;
  status: AuthStatus;
  error: string | null;
  
  // Auth methods
  signIn: (credentials: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  
  // Extract user from session with proper type safety
  const user = useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;
    
    // Ensure all required fields have values
    const userData: AuthUser = {
      id: session.user.id || '',
      username: session.user.username || 'user',
      name: session.user.name || 'User',
      email: session.user.email || 'no-email@example.com',
      accessToken: (session.user as any).accessToken || '',
    };
    
    return userData;
  }, [session]);
  
  // Get the current session with proper typing
  const currentSession = useMemo(() => {
    if (!session) return null;
    return {
      ...session,
      user: session.user ? {
        ...session.user,
        id: session.user.id || '',
        username: session.user.username || 'user',
        name: session.user.name || 'User',
        email: session.user.email || 'no-email@example.com',
      } : null,
    };
  }, [session]);

  const handleSignIn = async (credentials: { username: string; password: string }) => {
    const result = await nextAuthSignIn('credentials', {
      redirect: false,
      username: credentials.username,
      password: credentials.password,
      callbackUrl: '/dashboard',
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    // Update the session to ensure we have the latest data
    await update();
    
    // Redirect to dashboard or the original destination
    const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl') || '/dashboard';
    router.push(callbackUrl);
  };

  const handleSignOut = async () => {
    try {
      // Call your logout API if needed
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (apiUrl) {
        await fetch(`${apiUrl}/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with sign out even if API call fails
    }
    
    // Sign out from NextAuth
    await nextAuthSignOut({ redirect: false });
    
    // Redirect to login page
    router.push('/login');
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      // This will trigger the session callback in [...nextauth].ts
      await update();
      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  };

  // Determine the auth status
  const isLoading = sessionStatus === 'loading';

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session: currentSession,
      loading: isLoading,
      status: sessionStatus === 'loading' 
        ? 'loading' 
        : currentSession?.user 
          ? 'authenticated' 
          : 'unauthenticated',
      error: currentSession?.error || null,
      signIn: handleSignIn,
      signOut: handleSignOut,
      refreshSession,
    }),
    [user, currentSession, isLoading, sessionStatus, handleSignIn, handleSignOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
