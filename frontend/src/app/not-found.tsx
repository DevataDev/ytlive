'use client';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faHome } from '@fortawesome/free-solid-svg-icons';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 text-red-500">
          <FontAwesomeIcon icon={faExclamationTriangle} className="h-16 w-16" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          The page you are looking for does not exist or is not available in the current mode.
        </p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FontAwesomeIcon icon={faHome} className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
