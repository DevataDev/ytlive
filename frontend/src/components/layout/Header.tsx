'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBroadcastTower, 
  faTachometerAlt, 
  faVideo, 
  faPlay, 
  faUsers, 
  faChartLine, 
  faPlayCircle, 
  faFolderOpen,
  faSignOutAlt,
  faSearch,
  faBars,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import styles from './header.module.css';
import { faTiktok } from '@fortawesome/free-brands-svg-icons';
import { isSalesMode } from '@/config/salesMode';

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname() || '';
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut({ redirect: false });
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!session?.user?.name) return 'U';
    return session.user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Check if current path matches the nav item
  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <nav className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/dashboard" className="flex items-center px-2 text-gray-900 hover:text-blue-600 transition-colors">
                <FontAwesomeIcon icon={faBroadcastTower} className="h-6 w-6 mr-2" />
                <span className="font-bold text-xl">YukLive!</span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:space-x-1">
              <Link 
                href="/dashboard" 
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  isActive('/dashboard') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faTachometerAlt} className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              
              <Link 
                href="/stream" 
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  isActive('/stream') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faVideo} className="h-4 w-4" />
                <span>Stream</span>
              </Link>
              
              {/* Only show Mirror menu if not in sales mode */}
              {!isSalesMode() && (
                <Link 
                  href="/mirror" 
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                    isActive('/mirror') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
                  <span>Mirror</span>
                </Link>
              )}
              
              {/* TikTok Dropdown - Only show if not in sales mode */}
              {!isSalesMode() && (
                <div className="relative group">
                  <button className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                    (pathname.startsWith('/tiktok')) 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}>
                    <FontAwesomeIcon icon={faTiktok} className="h-4 w-4" />
                    <span>TikTok</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <Link 
                        href="/tiktok/live" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <FontAwesomeIcon icon={faBroadcastTower} className="h-4 w-4 mr-3" />
                        <span>Live</span>
                      </Link>
                      <Link 
                        href="/tiktok/search" 
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <FontAwesomeIcon icon={faSearch} className="h-4 w-4 mr-3" />
                        <span>Search</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              
              {session?.user?.isAdmin && (
                <Link 
                  href="/users" 
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                    isActive('/users') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <FontAwesomeIcon icon={faUsers} className="h-4 w-4" />
                  <span>Users</span>
                </Link>
              )}
              
              {!isSalesMode() && (
              <Link 
                href="/monitor" 
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  isActive('/monitor') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faChartLine} className="h-4 w-4" />
                <span>Monitor</span>
              </Link>
              )}
              
              <Link 
                href="/channels" 
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  isActive('/channels') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faPlayCircle} className="h-4 w-4" />
                <span>Channels</span>
              </Link>
              
              <Link 
                href="/media" 
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  isActive('/media') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FontAwesomeIcon icon={faFolderOpen} className="h-4 w-4" />
                <span>Media Manager</span>
              </Link>
            </div>
            
            {/* User Dropdown */}
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2">
                  <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {getUserInitials()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">
                    {session?.user?.name || 'User'}
                  </span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{session?.user?.name || 'User'}</p>
                    <p className="text-sm text-gray-500">{session?.user?.email || ''}</p>
                  </div>
                  <div className="py-1">
                    <button 
                      onClick={handleSignOut}
                      disabled={isLoading}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-3"></div>
                          Signing out...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4 mr-3" />
                          Sign out
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FontAwesomeIcon 
                  icon={isMobileMenuOpen ? faTimes : faBars} 
                  className="h-5 w-5" 
                />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link 
                href="/dashboard" 
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                  isActive('/dashboard') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faTachometerAlt} className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              
              <Link 
                href="/stream" 
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                  isActive('/stream') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faVideo} className="h-5 w-5" />
                <span>Stream</span>
              </Link>
              
              {/* Only show Mirror menu if not in sales mode */}
              {!isSalesMode() && (
                <Link 
                  href="/mirror" 
                  className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                    isActive('/mirror') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faPlay} className="h-5 w-5" />
                  <span>Mirror</span>
                </Link>
              )}
              
              {/* Only show TikTok menus if not in sales mode */}
              {!isSalesMode() && (
                <>
                  <Link 
                    href="/tiktok/live" 
                    className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                      isActive('/tiktok/live') 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FontAwesomeIcon icon={faBroadcastTower} className="h-5 w-5" />
                    <span>TikTok Live</span>
                  </Link>
                  
                  <Link 
                    href="/tiktok/search" 
                    className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                      isActive('/tiktok/search') 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <FontAwesomeIcon icon={faSearch} className="h-5 w-5" />
                    <span>TikTok Search</span>
                  </Link>
                </>
              )}
              
              {session?.user?.isAdmin && (
                <Link 
                  href="/users" 
                  className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                    isActive('/users') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faUsers} className="h-5 w-5" />
                  <span>Users</span>
                </Link>
              )}
              
              {!isSalesMode() && (
                <Link 
                  href="/monitor" 
                  className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                    isActive('/monitor') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faChartLine} className="h-5 w-5" />
                  <span>Monitor</span>
                </Link>
              )}
              
              <Link 
                href="/channels" 
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                  isActive('/channels') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faPlayCircle} className="h-5 w-5" />
                <span>Channels</span>
              </Link>
              
              <Link 
                href="/media" 
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center space-x-3 ${
                  isActive('/media') 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FontAwesomeIcon icon={faFolderOpen} className="h-5 w-5" />
                <span>Media Manager</span>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
