import { afterAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from "firebase/auth";

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (host !== "127.0.0.1:9099" && host !== "localhost:9099")
  throw new Error(
    "Auth tests require the explicit loopback emulator; no real project is allowed.",
  );
if (
  process.env.GCLOUD_PROJECT &&
  process.env.GCLOUD_PROJECT !== "demo-jobtrack"
)
  throw new Error("Only demo-jobtrack is supported.");

const app = initializeApp(
  {
    apiKey: "demo-jobtrack-public-key",
    projectId: "demo-jobtrack",
    authDomain: "demo-jobtrack.firebaseapp.com",
  },
  `auth-test-${crypto.randomUUID()}`,
);
const auth = initializeAuth(app, { persistence: inMemoryPersistence });
connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
afterAll(async () => {
  await signOut(auth);
  await deleteApp(app);
});

describe("real local Authentication emulator", () => {
  it("resolves the initial session, signs in with emulator Google credentials and signs out", async () => {
    await auth.authStateReady();
    expect(auth.currentUser).toBeNull();
    const states: (string | null)[] = [];
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      states.push(user?.uid ?? null);
    });
    try {
      const identity = `jobtrack-auth-${crypto.randomUUID()}`;
      const credential = GoogleAuthProvider.credential(
        JSON.stringify({
          sub: identity,
          email: `${identity}@example.test`,
          email_verified: true,
        }),
      );
      const result = await signInWithCredential(auth, credential);
      expect(result.user.uid).toBeTruthy();
      expect(result.user.providerData[0]?.providerId).toBe("google.com");
      expect(auth.currentUser?.uid).toBe(result.user.uid);
      const uid = result.user.uid;
      await signOut(auth);
      expect(auth.currentUser).toBeNull();
      const restored = await signInWithCredential(auth, credential);
      expect(restored.user.uid).toBe(uid);
      await signOut(auth);
      expect(states).toContain(uid);
    } finally {
      unsubscribe();
    }
  });
});
