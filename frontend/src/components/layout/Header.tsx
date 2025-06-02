'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import styles from './Header.module.css';

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load Bootstrap JS
    require('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []); 

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
    return pathname === path ? 'active' : '';
  };

  return (
    <header className="app-header">
      <nav className="navbar navbar-expand-lg">
        <div className="container-fluid px-3 px-lg-4">
          <Link className="navbar-brand" href="/dashboard">
            <i className="bi bi-broadcast"></i>
            <span>YukLive!</span>
          </Link>
          
          <button 
            className="navbar-toggler" 
            type="button" 
            data-bs-toggle="collapse" 
            data-bs-target="#mainNavbar" 
            aria-controls="mainNavbar" 
            aria-expanded="false" 
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          
          <div className="collapse navbar-collapse" id="mainNavbar">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link href="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
                  <i className="bi bi-speedometer2"></i>
                  <span>Dashboard</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/stream" className={`nav-link ${isActive('/stream')}`}>
                  <i className="bi bi-camera-reels"></i>
                  <span>Stream</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/mirror" className={`nav-link ${isActive('/mirror')}`}>
                  <i className="bi bi-play-circle"></i>
                  <span>Mirror</span>
                </Link>
              </li>
              <li className="nav-item dropdown">
                <Link 
                  className={`nav-link dropdown-toggle ${pathname.startsWith('/tiktok') ? 'active' : ''}`} 
                  href="#" 
                  id="tiktokDropdown" 
                  role="button" 
                  data-bs-toggle="dropdown" 
                  aria-expanded="false"
                >
                  <i className="bi bi-tiktok"></i>
                  <span>TikTok</span>
                </Link>
                <ul className="dropdown-menu" aria-labelledby="tiktokDropdown">
                  <li>
                    <Link className="dropdown-item" href="/tiktok/live">
                      <i className="bi bi-broadcast me-2"></i>
                      <span>Live</span>
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" href="/tiktok/search">
                      <i className="bi bi-search me-2"></i>
                      <span>Search</span>
                    </Link>
                  </li>
                </ul>
              </li>
              {session?.user?.isAdmin && (
                <li className="nav-item">
                  <Link href="/users" className={`nav-link ${isActive('/users')}`}>
                    <i className="bi bi-people"></i>
                    <span>Users</span>
                  </Link>
                </li>
              )}
              <li className="nav-item">
                <Link href="/monitor" className={`nav-link ${isActive('/monitor')}`}>
                  <i className="bi bi-graph-up"></i>
                  <span>Monitor</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link href="/channels" className={`nav-link ${isActive('/channels')}`}>
                  <i className="bi bi-collection-play"></i>
                  <span>Channels</span>
                </Link>
              </li>
            </ul>
            
            <div className="d-flex align-items-center">
              <div className="dropdown">
                <button
                  className="btn btn-link nav-link dropdown-toggle d-flex align-items-center p-0"
                  type="button"
                  id="userDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <div className={`${styles.userAvatar} bg-primary text-white d-flex align-items-center justify-content-center`}>
                    {getUserInitials()}
                  </div>
                  <span className={`ms-2 d-none d-sm-inline ${styles.userName}`}>
                    {session?.user?.name || 'User'}
                  </span>
                </button>
                <ul className={`dropdown-menu dropdown-menu-end ${styles.dropdownMenu}`} aria-labelledby="userDropdown">
                  <li className={styles.userInfo}>
                    <span className={styles.userInfoName}>{session?.user?.name || 'User'}</span>
                    <span className={styles.userInfoEmail}>{session?.user?.email || ''}</span>
                  </li>
                  <li><hr className={`dropdown-divider my-1 ${styles.dropdownDivider}`} /></li>
                  <li>
                    <button 
                      className={`dropdown-item text-danger ${styles.dropdownItem}`}
                      onClick={handleSignOut}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Signing out...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-right"></i>
                          Sign out
                        </>
                      )}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
