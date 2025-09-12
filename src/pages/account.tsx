import { useState } from "react";
import Link from "next/link";

export default function Account() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

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
      <p className="subtitle">Sign in or create your account</p>
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
            <input type="email" placeholder="Enter your email..." />
          </label>
          <label>
            Password
            <input type="password" placeholder="Enter your password..." />
          </label>
          <button className="auth-submit">
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </main>
  );
}

