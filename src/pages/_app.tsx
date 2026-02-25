import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { auth, ensureAuthPersistence, isFirebaseConfigured } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { registerServiceWorker } from "@/lib/pwa-utils";
import { QueryClientProvider, queryClient } from "@/hooks/queries";
import { startCloudSync } from "@/lib/cloud-sync";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const stopCloudSync = startCloudSync();

    // Initialize Firebase auth
    if (!isFirebaseConfigured || !auth) {
      console.warn("Firebase auth is not configured. Skipping anonymous sign-in.");
    } else {
      const firebaseAuth = auth;
      ensureAuthPersistence()
        .then(() => signInAnonymously(firebaseAuth))
        .catch((error) => {
          console.warn("Firebase auth initialization skipped:", error);
        });
    }

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
      stopCloudSync();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
