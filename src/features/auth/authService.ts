import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

export interface SessionUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}
export interface AuthService {
  observe(
    next: (user: SessionUser | null) => void,
    error: (error: unknown) => void,
  ): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}
export class FirebaseAuthService implements AuthService {
  constructor(private readonly auth: Auth) {}
  observe(
    next: (user: SessionUser | null) => void,
    error: (error: unknown) => void,
  ) {
    return onAuthStateChanged(
      this.auth,
      (user) =>
        next(
          user
            ? {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
              }
            : null,
        ),
      error,
    );
  }
  async signIn() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(this.auth, provider);
  }
  async signOut() {
    await signOut(this.auth);
  }
}
export function authErrorMessage(error: unknown): {
  message: string;
  cancelled: boolean;
} {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (
    ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)
  )
    return {
      message: "Sign-in cancelled. Your storage mode has not changed.",
      cancelled: true,
    };
  if (code === "auth/popup-blocked")
    return {
      message:
        "The sign-in popup was blocked. Allow popups for this site and retry.",
      cancelled: false,
    };
  if (code === "auth/unauthorized-domain")
    return {
      message:
        "This domain is not authorized for Google sign-in. Check Firebase Authentication settings and retry.",
      cancelled: false,
    };
  return {
    message:
      "Firebase authentication failed. Check the connection and configuration, then retry. No demo data has been uploaded.",
    cancelled: false,
  };
}
