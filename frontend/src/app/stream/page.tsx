'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Spinner } from 'react-bootstrap';

// Dynamically import the StreamList component with SSR disabled
const StreamList = dynamic(
  () => import('./components/StreamList'),
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

export default function StreamListPage() {
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
      <StreamList />
    </Suspense>
  );
}
