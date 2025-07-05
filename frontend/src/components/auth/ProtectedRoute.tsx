'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Define public routes that don't require authentication
const AUTH_PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/error'];

type ProtectedRouteProps = {
  children: React.ReactNode;
  redirectPath?: string;
};

export default function ProtectedRoute({ 
  children, 
  redirectPath = '/login' 
}: ProtectedRouteProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated' && !AUTH_PUBLIC_ROUTES.includes(pathname || '')) {
      router.push(redirectPath);
    }
  }, [status, pathname, redirectPath, router]);

  if (!isClient || status === 'loading') {
    // Show loading state during initial render or when status is loading
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // If not authenticated and not on a public route, the useEffect will handle the redirect
  if (status !== 'authenticated' && !AUTH_PUBLIC_ROUTES.includes(pathname || '')) {
    return null;
  }

  return <>{children}</>;
}
