import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";
import { readFirebaseSettings } from "./config";

export const firebaseSettings = readFirebaseSettings(
  import.meta.env,
  import.meta.env.DEV,
);
let runtime: ReturnType<typeof createRuntime> | undefined;
function createRuntime() {
  if (
    !firebaseSettings.options ||
    !["emulator", "connected"].includes(firebaseSettings.mode)
  )
    throw new Error(
      firebaseSettings.error ??
        "Firebase is not configured. Demo storage is available without an account.",
    );
  const app = initializeApp(firebaseSettings.options, "jobtrack");
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  if (firebaseSettings.mode === "emulator") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: false,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { auth, db };
}
export function getFirebaseRuntime() {
  runtime ??= createRuntime();
  return runtime;
}
