import { useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/router";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin() {
    await signInWithEmailAndPassword(auth, email, password);
    router.push("/meals");
  }

  async function handleSignup() {
    await createUserWithEmailAndPassword(auth, email, password);
    router.push("/meals");
  }

  return (
    <div>
      <h1>Recipe Tracker</h1>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Log In</button>
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  );
}
