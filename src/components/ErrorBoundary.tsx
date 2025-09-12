import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, reset }: { error?: Error; reset: () => void }) {
  return (
    <div className="error-boundary">
      <div className="error-content">
        <h2>Something went wrong</h2>
        <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
        {error && (
          <details className="error-details">
            <summary>Error details</summary>
            <pre>{error.message}</pre>
          </details>
        )}
        <div className="error-actions">
          <button onClick={reset} className="error-retry">
            Try again
          </button>
          <button onClick={() => window.location.reload()} className="error-reload">
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}