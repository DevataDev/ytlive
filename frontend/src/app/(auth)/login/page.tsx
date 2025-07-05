'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlayCircle, 
  faExclamationTriangle, 
  faEnvelope, 
  faLock, 
  faEye, 
  faEyeSlash,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

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
    <div className="min-h-screen flex items-center bg-gray-50">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="flex flex-col justify-center">
          <div className="w-full">
            {/* Logo/Branding */}
            <div className="text-center mb-8">
              <Link href="/" className="text-decoration-none">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-blue-600 rounded-lg p-2 mr-3 flex items-center justify-center w-12 h-12">
                    <FontAwesomeIcon icon={faPlayCircle} className="text-white text-2xl" />
                  </div>
                  <span className="text-3xl font-bold text-gray-900">YukLive!</span>
                </div>
              </Link>
              <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
              <p className="text-gray-600">Sign in to your account to continue</p>
            </div>

            {/* Card */}
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-8">
                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center mb-6" role="alert">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mr-3" />
                    <div className="text-red-700">{error}</div>
                  </div>
                )}

                {/* Sign In Form */}
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                      <button 
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50" 
                        type="button" 
                        onClick={togglePasswordVisibility}
                        disabled={isLoading}
                      >
                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center mb-6">
                    <input
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                      type="checkbox"
                      id="remember-me"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                    />
                    <label className="ml-2 block text-sm text-gray-700" htmlFor="remember-me">
                      Remember me
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin h-8 w-8 text-blue-600 mb-4" />
          <p className="text-gray-600">Loading login form...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
