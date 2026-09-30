// Auth context around Firebase Auth. Same users as the website (same Firebase
// project). Exposes the current viewer, a display name, and email/password +
// sign-out helpers.

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

type AuthState = {
  user: User | null;
  ready: boolean;
  displayName: string;
  signIn: (email: string, pw: string) => Promise<void>;
  signUp: (email: string, pw: string, name: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Viewer";

  async function signIn(email: string, pw: string) {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email.trim(), pw);
  }

  async function signUp(email: string, pw: string, name: string) {
    const auth = getFirebaseAuth();
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    setUser({ ...cred.user });
  }

  // Exchange a Google OAuth id_token (from expo-auth-session) for a Firebase
  // session. Same Firebase project as the website, so a Google account signed in
  // here is the same account as on the site.
  async function signInWithGoogleIdToken(idToken: string) {
    const auth = getFirebaseAuth();
    const cred = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, cred);
  }

  async function logout() {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }

  return (
    <Ctx.Provider value={{ user, ready, displayName, signIn, signUp, signInWithGoogleIdToken, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
