import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../firebase";

export class AuthNotConfiguredError extends Error {
  constructor() {
    super(
      "AfterCare isn't connected to a Firebase project yet. Add your Firebase keys to apps/web/.env.local (see .env.example) and reload."
    );
    this.name = "AuthNotConfiguredError";
  }
}

/** Maps Firebase's error codes to plain-language messages a patient or caregiver can act on. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right. Please check it and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support if you think that's a mistake.";
    case "auth/user-not-found":
      return "We couldn't find an account with that email. Check the spelling, or create a new account.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "That password doesn't match this account. Try again or reset your password.";
    case "auth/email-already-in-use":
      return "An account already exists with that email. Try signing in instead.";
    case "auth/weak-password":
      return "That password is too short — please use at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "We couldn't reach the server. Check your internet connection and try again.";
    default:
      if (err instanceof AuthNotConfiguredError) return err.message;
      return "Something went wrong. Please try again in a moment.";
  }
}

function assertConfigured() {
  if (!isFirebaseConfigured) throw new AuthNotConfiguredError();
}

export async function signUp(email: string, password: string): Promise<User> {
  assertConfigured();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email: cred.user.email,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  assertConfigured();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  assertConfigured();
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  assertConfigured();
  await sendPasswordResetEmail(auth, email);
}

export function watchAuthState(cb: (user: User | null) => void): () => void {
  if (!isFirebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}
