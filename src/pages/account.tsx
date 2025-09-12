import { useEffect, useState } from "react";
import {
  signInEmail,
  signUpEmail,
  signOutUser,
  sendReset,
  sendVerification,
} from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Navigation from "@/components/Navigation";

export default function Account() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email || null);
      setVerified(u?.emailVerified ?? false);
      setIsAnonymous(u?.isAnonymous ?? true);
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
      setStatus("Successfully " + (mode === "signin" ? "signed in" : "signed up") + "!");
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleReset() {
    if (!email) {
      setStatus("Please enter your email address first");
      return;
    }
    try {
      await sendReset(email);
      setStatus("Password reset email sent to " + email);
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleVerify() {
    try {
      await sendVerification();
      setStatus("Verification email sent to " + userEmail);
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      setStatus("Successfully signed out");
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <main className="container">
      <Navigation currentPage="account" />
      
      <h1>Account</h1>
      
      {status && (
        <div className="auth-card">
          <div className="auth-fields">
            <p className={status.includes("error") || status.includes("Error") ? "error-message" : "success-message"}>
              {status}
            </p>
          </div>
        </div>
      )}

      {userEmail && !isAnonymous ? (
        // Signed in user view
        <div className="auth-card">
          <div className="auth-fields">
            <div>
              <p className="subtitle">
                Signed in as <strong>{userEmail}</strong>
              </p>
              <p className={`verification-status ${verified ? "verified" : "unverified"}`}>
                {verified ? "✓ Email verified" : "⚠ Email not verified"}
              </p>
            </div>
            
            {!verified && (
              <button className="auth-submit" onClick={handleVerify}>
                Send Verification Email
              </button>
            )}
            
            <button className="auth-submit secondary" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        // Sign in/up view for anonymous users
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
            <p className="subtitle">
              {mode === "signin" 
                ? "Sign in to sync your meals across devices" 
                : "Create an account to sync your meals across devices"}
            </p>
            
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
                minLength={6}
              />
            </label>
            
            <button className="auth-submit" onClick={handleSubmit}>
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
            
            <button className="auth-submit secondary" onClick={handleReset}>
              Forgot Password?
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

