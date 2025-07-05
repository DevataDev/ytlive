import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isSalesMode } from './config/salesMode';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is a public path that doesn't require authentication
  const isPublicPath = (
    pathname === '/' || 
    pathname === '/login' || 
    pathname.startsWith('/login/') || // Include any subpaths of login
    pathname === '/404' || 
    pathname.startsWith('/api/') || // All API routes are public
    pathname.startsWith('/login') // All sales routes are public
  );
  
  // If it's a public path, just continue
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check for sales mode restricted paths
  if (isSalesMode()) {
    // Define paths that should be blocked in sales mode
    const restrictedPaths = [
      '/mirror', 
      '/tiktok', 
      '/monitor',
      '/tiktok/live',
      '/tiktok/search',
    ];
    
    // More precise path matching for restricted routes
    const isRestrictedPath = restrictedPaths.some(path => {
      // Exact match (e.g., '/mirror' matches '/mirror')
      if (pathname === path) return true;
      
      // Path with trailing slash (e.g., '/mirror/' matches '/mirror')
      if (pathname === `${path}/`) return true;
      
      // Path with additional segments (e.g., '/mirror/something' matches '/mirror')
      if (pathname.startsWith(`${path}/`)) return true;
      
      return false;
    });
    
    // If trying to access a restricted path in sales mode, return 404
    if (isRestrictedPath) {
      return NextResponse.rewrite(new URL('/404', request.url));
    }
  }
  
  // Check for authentication
  const token = await getToken({ req: request });
  
  // If no token and not a public path, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // If we have a token and trying to access login, redirect to dashboard
  if (token && (pathname === '/login' || pathname.startsWith('/login/'))) {
    // Get the callbackUrl if it exists, otherwise default to dashboard
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/dashboard';
    
    // If the callbackUrl is also a login page, redirect to dashboard to break the loop
    if (callbackUrl === '/login' || callbackUrl.startsWith('/login/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Otherwise redirect to the callbackUrl
    return NextResponse.redirect(new URL(callbackUrl, request.url));
  }
  
  // If we have a token, continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
