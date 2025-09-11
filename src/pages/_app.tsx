import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

export default function App({ Component, pageProps }: AppProps) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No user signed in, attempt anonymous sign-in
        try {
          await signInAnonymously(auth);
          console.log("Anonymous sign-in successful");
        } catch (error: any) {
          console.error("Anonymous sign-in failed:", error);
          setAuthError(`Authentication failed: ${error.message}`);
        }
      } else {
        console.log("User authenticated:", user.uid);
        setAuthError(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (authLoading) {
    return <div>Loading authentication...</div>;
  }

  if (authError) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Authentication Error</h2>
        <p>{authError}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return <Component {...pageProps} />;
}