import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
  }, []);
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
