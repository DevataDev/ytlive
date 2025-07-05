'use client';

import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type UserProfile = {
  id: string;
  username: string;
  email?: string | null;
  name?: string | null;
  accessToken: string;
};

interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

interface ResetPasswordData {
  token: string;
  email: string;
  password: string;
}

interface UseAuthReturn {
  // Auth state
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Auth methods
  login: (credentials: LoginCredentials, redirectTo?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: (redirectTo?: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (data: Omit<ResetPasswordData, 'email'> & { email?: string }) => Promise<{ success: boolean; message?: string }>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; user?: UserProfile; message?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  refreshSession: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '';
  const searchParams = useSearchParams() || '';
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Update user state when session changes
  useEffect(() => {
    if (session?.user) {
      const userData = {
        id: session.user.id || '',
        username: session.user.username || 'user',
        email: session.user.email || 'no-email@example.com',
        name: session.user.name || 'User',
        accessToken: (session.user as any).accessToken || '',
      };
      setUser(userData);
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [session]);

  const login = useCallback(
    async (credentials: LoginCredentials, redirectTo = '/') => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await nextAuthSignIn('credentials', {
          redirect: false,
          username: credentials.username,
          password: credentials.password,
          callbackUrl: redirectTo,
        });

        if (result?.error) {
          setError(result.error);
          return;
        }


        // Update the session to ensure we have the latest data
        await update();
        
        // Redirect to the specified URL or dashboard by default
        router.push(redirectTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during login');
      } finally {
        setIsLoading(false);
      }
    },
    [router, update]
  );

  const register = useCallback(
    async (data: RegisterData): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API base URL is not configured');
        }

        const response = await fetch(`${apiUrl}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: data.username,
            email: data.email,
            password: data.password,
            name: data.name,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || 'Registration failed';
          setError(errorMessage);
          return { success: false, message: errorMessage };
        }

        // Automatically log in after successful registration
        await login({
          username: data.username,
          password: data.password,
        });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [login]
  );

  const logout = useCallback(
    async (redirectTo = '/login') => {
      setIsLoading(true);
      setError(null);

      try {
        // Call the logout API if configured
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (apiUrl) {
          try {
            await fetch(`${apiUrl}/logout`, {
              method: 'POST',
              credentials: 'include',
            });
          } catch (err) {
            console.error('Logout API error:', err);
            // Continue with sign out even if API call fails
          }
        }

        // Sign out from NextAuth
        await nextAuthSignOut({ redirect: false });

        // Clear local state
        setUser(null);
        setIsAuthenticated(false);

        // Update the session
        await update();

        // Redirect to login page
        router.push(redirectTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred during logout');
      } finally {
        setIsLoading(false);
      }
    },
    [router, update]
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API base URL is not configured');
        }

        const response = await fetch(`${apiUrl}/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || 'Failed to send password reset email';
          setError(errorMessage);
          return { success: false, message: errorMessage };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send password reset email';
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const resetPassword = useCallback(
    async (
      data: Omit<ResetPasswordData, 'email'> & { email?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      setIsLoading(true);
      setError(null);

      try {
        // If email is not provided, try to get it from the session
        const email = data.email || session?.user?.email;

        if (!email) {
          const message = 'Email is required for password reset';
          setError(message);
          return { success: false, message };
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API base URL is not configured');
        }

        const response = await fetch(`${apiUrl}/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: data.token,
            email,
            password: data.password,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || 'Failed to reset password';
          setError(errorMessage);
          return { success: false, message: errorMessage };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [session?.user?.email]
  );

  const updateProfile = useCallback(
    async (
      data: Partial<UserProfile>
    ): Promise<{ success: boolean; user?: UserProfile; message?: string }> => {
      if (!user) {
        const message = 'User not authenticated';
        setError(message);
        return { success: false, message };
      }

      setIsLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API base URL is not configured');
        }

        const response = await fetch(`${apiUrl}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify(data),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || 'Failed to update profile';
          setError(errorMessage);
          return { success: false, message: errorMessage };
        }

        // Update the session with the new user data
        await update();

        return { success: true, user: responseData.user };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update profile';
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [user, update]
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ success: boolean; message?: string }> => {
      if (!user) {
        const message = 'User not authenticated';
        setError(message);
        return { success: false, message };
      }

      setIsLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error('API base URL is not configured');
        }

        const response = await fetch(`${apiUrl}/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.accessToken}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          const errorMessage = responseData.message || 'Failed to change password';
          setError(errorMessage);
          return { success: false, message: errorMessage };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to change password';
        setError(message);
        return { success: false, message };
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      // This will trigger the session callback in [...nextauth].ts
      await update();
      return true;
    } catch (err) {
      console.error('Failed to refresh session:', err);
      return false;
    }
  }, [update]);

  // Auto-refresh session when it's about to expire
  useEffect(() => {
    if (!session?.expires) return;

    const expires = new Date(session.expires);
    const now = new Date();
    const timeout = expires.getTime() - now.getTime() - 30000; // Refresh 30 seconds before expiration

    if (timeout <= 0) return;

    const timer = setTimeout(() => {
      refreshSession();
    }, timeout);

    return () => clearTimeout(timer);
  }, [session?.expires, refreshSession]);

  // Redirect to login if not authenticated and not on a public page
  useEffect(() => {
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

    if (status === 'unauthenticated' && !isPublicPath) {
      const callbackUrl = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [status, pathname, searchParams, router]);

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || status === 'loading',
    error,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    refreshSession,
  };
}
