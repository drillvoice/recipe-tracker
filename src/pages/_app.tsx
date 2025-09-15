import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { registerServiceWorker } from "@/lib/pwa-utils";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Initialize Firebase auth
    signInAnonymously(auth).catch(() => {});

    // Register service worker for PWA functionality
    registerServiceWorker().then((registration) => {
      if (registration) {
        console.log('PWA: Service worker registered successfully');
      }
    }).catch((error) => {
      console.error('PWA: Service worker registration failed:', error);
    });

    // Listen for app updates
    const handleSWUpdate = () => {
      if (confirm('A new version of the app is available. Reload to update?')) {
        window.location.reload();
      }
    };

    window.addEventListener('sw-update-available', handleSWUpdate);

    return () => {
      window.removeEventListener('sw-update-available', handleSWUpdate);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
