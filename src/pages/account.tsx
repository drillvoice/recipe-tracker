import { useEffect, useState } from "react";
import Link from "next/link";
import {
  signInEmail,
  signUpEmail,
  signOutUser,
  sendReset,
  sendVerification,
} from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Account() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email || null);
      setVerified(u?.emailVerified ?? false);
    });
  }, []);

  async function handleSubmit() {
    setStatus("");
    try {
      if (mode === "signin") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password);
      }
      setStatus("success");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleReset() {
    try {
      await sendReset(email);
      setStatus("reset sent");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleVerify() {
    try {
      await sendVerification();
      setStatus("verification sent");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <main className="container">
      <nav className="top-nav">
        <Link href="/" className="nav-item">
          + Add
        </Link>
        <Link href="/history" className="nav-item">
          History
        </Link>
        <Link href="/ideas" className="nav-item">
          Ideas
        </Link>
        <Link href="/account" className="nav-item active">
          Account
        </Link>
      </nav>
      <h1>Account</h1>
      {userEmail && (
        <p className="subtitle">
          Signed in as {userEmail} {verified ? "(verified)" : "(unverified)"}
        </p>
      )}
      {status && <p>{status}</p>}
      <div className="auth-card">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>
        <div className="auth-fields">
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email..."
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password..."
            />
          </label>
          <button className="auth-submit" onClick={handleSubmit}>
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
          <button className="auth-submit" onClick={handleReset}>
            Reset Password
          </button>
          {!verified && userEmail && (
            <button className="auth-submit" onClick={handleVerify}>
              Send Verification Email
            </button>
          )}
          {userEmail && (
            <button className="auth-submit" onClick={() => signOutUser()}>
              Sign Out
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

