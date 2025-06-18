'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// Dynamically import the MediaManager component with SSR disabled
const MediaManager = dynamic(
  () => import('./components/MediaManager'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
        <FontAwesomeIcon icon={faSpinner} className="text-2xl text-gray-400 animate-spin" />
      </div>
    )
  }
);

export default function MediaManagerPage() {
  return (
    <Suspense 
      fallback={
        <div className="flex justify-center items-center" style={{ minHeight: '60vh' }}>
          <FontAwesomeIcon icon={faSpinner} className="text-2xl text-gray-400 animate-spin" />
        </div>
      }
    >
      <MediaManager />
    </Suspense>
  );
}