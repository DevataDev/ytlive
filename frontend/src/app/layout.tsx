'use client';

import { Inter } from 'next/font/google';
import 'react-toastify/dist/ReactToastify.css';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

import { usePathname } from 'next/navigation';

// Load Inter font with all weights
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();

  // List of routes where header/footer should be hidden
  const hideHeaderFooter = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/login/',
    '/register/',
    '/forgot-password/',
    '/reset-password/',
    '/login/[...nextauth]',
  ];

  const shouldHide = hideHeaderFooter.includes(pathname || '');

  return (
    <html lang="en" className={inter.variable}>
      
      <body className="flex flex-col min-h-screen">
          <SessionProvider>
            <AuthProvider>
              {shouldHide ? null : <Header />}
              {pathname === '/' ? (
                <>
                  {children}
                  <ToastContainer 
                    position="top-right"
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                  />
                </>
              ) : (
                <main className="flex-grow">
                  {children}
                  <ToastContainer 
                    position="top-right"
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                  />
                </main>
              )}
              {shouldHide ? null : <Footer />}
            </AuthProvider>
          </SessionProvider>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';