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
import { validateEmail, validatePassword } from "@/utils/validation";
import { checkAuthAttemptLimit, checkPasswordResetLimit } from "@/utils/rateLimit";

export default function Account() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
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
    // Clear previous errors and status
    setErrors([]);
    setStatus("");

    // Check rate limiting
    const rateLimitCheck = checkAuthAttemptLimit(email);
    if (!rateLimitCheck.allowed) {
      setErrors([`Too many authentication attempts. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`]);
      return;
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.success) {
      setErrors(emailValidation.errors);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.success) {
      setErrors(passwordValidation.errors);
      return;
    }

    try {
      if (mode === "signin") {
        await signInEmail(emailValidation.data, passwordValidation.data);
      } else {
        await signUpEmail(emailValidation.data, passwordValidation.data);
      }
      setStatus("Successfully " + (mode === "signin" ? "signed in" : "signed up") + "!");
      setEmail("");
      setPassword("");
    } catch (e: any) {
      setErrors([e.message || 'Authentication failed. Please try again.']);
    }
  }

  async function handleReset() {
    // Clear previous errors and status
    setErrors([]);
    setStatus("");

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.success) {
      setErrors(emailValidation.errors);
      return;
    }

    // Check rate limiting for password reset
    const rateLimitCheck = checkPasswordResetLimit(emailValidation.data);
    if (!rateLimitCheck.allowed) {
      setErrors([`Too many password reset attempts. Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`]);
      return;
    }

    try {
      await sendReset(emailValidation.data);
      setStatus("Password reset email sent to " + emailValidation.data);
    } catch (e: any) {
      setErrors([e.message || 'Failed to send reset email. Please try again.']);
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
      
      {errors.length > 0 && (
        <div className="auth-card">
          <div className="auth-fields">
            {errors.map((error, index) => (
              <p key={index} className="error-message">{error}</p>
            ))}
          </div>
        </div>
      )}

      {status && (
        <div className="auth-card">
          <div className="auth-fields">
            <p className="success-message">
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

