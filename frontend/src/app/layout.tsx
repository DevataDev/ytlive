'use client';

import { Inter } from 'next/font/google';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'react-toastify/dist/ReactToastify.css';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SessionProvider } from 'next-auth/react';
import { ToastContainer } from 'react-toastify';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useEffect } from 'react';
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

  // Load Bootstrap JS
  useEffect(() => {
    // @ts-ignore - Bootstrap requires jQuery in global scope
    window.jQuery = window.$ = require('jquery');
    require('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);

  const shouldHide = hideHeaderFooter.includes(pathname);
  // Debug logging (remove after testing)
  console.log('Current pathname:', pathname);
  console.log('Should hide header/footer:', shouldHide);

  return (
    <html lang="en" className={inter.variable}>
      <body className="d-flex flex-column min-vh-100">
        <SessionProvider>
          <AuthProvider>
            {shouldHide ? null : <Header />}
            <main className="flex-grow-1">
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
            {shouldHide ? null : <Footer />}
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';