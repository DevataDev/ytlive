'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Spinner } from 'react-bootstrap';

// Dynamically import the MediaManager component with SSR disabled
const MediaManager = dynamic(
  () => import('./components/MediaManager'),
  { 
    ssr: false,
    loading: () => (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    )
  }
);

export default function MediaManagerPage() {
  return (
    <Suspense 
      fallback={
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      }
    >
      <MediaManager />
    </Suspense>
  );
}