'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting to sign in...');
      
      // First, try to sign in with credentials
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl || '/dashboard',
      });

      console.log('Sign in result:', result);

      if (result?.error) {
        console.error('Sign in error:', result.error);
        setError('Invalid email or password. Please try again.');
        return;
      }

      // If we get here, sign in was successful
      console.log('Sign in successful, checking session...');
      
      // Verify the session is actually set
      const sessionCheck = await fetch('/api/auth/session');
      const sessionData = await sessionCheck.json();
      console.log('Session data:', sessionData);
      
      if (sessionData?.user) {
        console.log('Session verified, redirecting to dashboard');
        // Use window.location to ensure a full page reload
        window.location.href = callbackUrl || '/dashboard';
      } else {
        console.error('No session found after sign in');
        setError('Authentication successful but session not established. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6">
            {/* Logo/Branding */}
            <div className="text-center mb-5">
              <Link href="/" className="text-decoration-none">
                <div className="d-flex align-items-center justify-content-center mb-3">
                  <div className="bg-primary rounded p-2 me-2 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="bi bi-play-circle-fill text-white" style={{ fontSize: '2rem' }}></i>
                  </div>
                  <span className="fs-3 fw-bold text-dark">YukLive!</span>
                </div>
              </Link>
              <h1 className="h3 mb-2 fw-bold">Welcome Back</h1>
              <p className="text-muted">Sign in to your account to continue</p>
            </div>

            {/* Card */}
            <div className="card shadow-sm">
              <div className="card-body p-4 p-md-5">
                {/* Error Message */}
                {error && (
                  <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>{error}</div>
                  </div>
                )}

                {/* Sign In Form */}
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email Address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-envelope"></i>
                      </span>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="form-control form-control-lg"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label htmlFor="password" className="form-label">
                        Password
                      </label>
                    </div>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-lock"></i>
                      </span>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className="form-control form-control-lg"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                      <button 
                        className="btn btn-outline-secondary" 
                        type="button" 
                        onClick={togglePasswordVisibility}
                        disabled={isLoading}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  <div className="form-check mb-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="remember-me"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                    />
                    <label className="form-check-label" htmlFor="remember-me">
                      Remember me
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100 mb-3"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Signing in...
                      </>
                    ) : (
                      'Sign in to your account'
                    )}
                  </button>
                </form>

                {/* Removed social login and register link as per request */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
