import type { FirebaseOptions } from "firebase/app";

export interface FirebaseSettings {
  mode: "disabled" | "invalid" | "emulator" | "connected";
  options?: FirebaseOptions;
  error?: string;
}
export function readFirebaseSettings(
  env: Record<string, string | boolean | undefined>,
  development: boolean,
): FirebaseSettings {
  if (env.VITE_FIREBASE_ENABLED !== "true") return { mode: "disabled" };
  const emulator = env.VITE_FIREBASE_USE_EMULATORS === "true";
  const options: FirebaseOptions = {
    apiKey: String(env.VITE_FIREBASE_API_KEY ?? ""),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? ""),
    appId: String(env.VITE_FIREBASE_APP_ID ?? ""),
  };
  if (
    !Object.values(options).every((value) => value && !value.includes("YOUR_"))
  )
    return {
      mode: "invalid",
      error:
        "Firebase configuration is incomplete. Check the public web settings and retry, or explicitly choose demo storage.",
    };
  if (emulator && (!development || options.projectId !== "demo-jobtrack"))
    return {
      mode: "invalid",
      error:
        "Emulators require development mode and the local demo-jobtrack project. No Firebase connection was made.",
    };
  if (!emulator && options.projectId?.startsWith("demo-"))
    return {
      mode: "invalid",
      error:
        "A demo project can only be used with explicitly enabled emulators.",
    };
  return { mode: emulator ? "emulator" : "connected", options };
}
