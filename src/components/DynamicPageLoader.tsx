import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Lazy load page components
const History = lazy(() => import('@/pages/history'));
const Ideas = lazy(() => import('@/pages/ideas'));
const Account = lazy(() => import('@/pages/account'));

// Loading component
const PageLoadingFallback = () => (
  <main className="container">
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '200px',
      color: '#6b7280'
    }}>
      <div>
        <div style={{ 
          marginBottom: '1rem',
          fontSize: '1.5rem' 
        }}>⏳</div>
        <p>Loading page...</p>
      </div>
    </div>
  </main>
);

interface DynamicPageLoaderProps {
  page: 'history' | 'ideas' | 'account';
}

const DynamicPageLoader: React.FC<DynamicPageLoaderProps> = ({ page }) => {
  let Component;
  
  switch (page) {
    case 'history':
      Component = History;
      break;
    case 'ideas':
      Component = Ideas;
      break;
    case 'account':
      Component = Account;
      break;
    default:
      return <div>Page not found</div>;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingFallback />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
};

export default DynamicPageLoader;