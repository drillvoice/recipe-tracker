import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Link from "next/link";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <nav>
        <Link href="/">Add Meal</Link>
        <Link href="/history">History</Link>
        <Link href="/account">Account</Link>
      </nav>
      <Component {...pageProps} />
    </>
  );
}
