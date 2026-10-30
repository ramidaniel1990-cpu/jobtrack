import { describe, expect, it } from "vitest";
import { readFirebaseSettings } from "../src/shared/firebase/config";
import { authErrorMessage } from "../src/features/auth/authService";

const complete = {
  VITE_FIREBASE_ENABLED: "true",
  VITE_FIREBASE_API_KEY: "public-web-key",
  VITE_FIREBASE_AUTH_DOMAIN: "jobtrack.example",
  VITE_FIREBASE_PROJECT_ID: "jobtrack-dedicated",
  VITE_FIREBASE_APP_ID: "public-app-id",
};
describe("explicit Firebase configuration", () => {
  it("keeps the demo independent of Firebase when no configuration is present", () => {
    expect(readFirebaseSettings({}, true)).toEqual({ mode: "disabled" });
    expect(
      readFirebaseSettings(
        { ...complete, VITE_FIREBASE_ENABLED: "false" },
        true,
      ).mode,
    ).toBe("disabled");
  });
  it("rejects incomplete setup without falling back to demo", () => {
    expect(
      readFirebaseSettings({ VITE_FIREBASE_ENABLED: "true" }, true).mode,
    ).toBe("invalid");
  });
  it("requires explicit emulator activation, development and a fixed demo project", () => {
    const emulator = {
      ...complete,
      VITE_FIREBASE_PROJECT_ID: "demo-jobtrack",
      VITE_FIREBASE_USE_EMULATORS: "true",
    };
    expect(readFirebaseSettings(emulator, true).mode).toBe("emulator");
    expect(readFirebaseSettings(emulator, false).mode).toBe("invalid");
    expect(
      readFirebaseSettings(
        { ...complete, VITE_FIREBASE_USE_EMULATORS: "true" },
        true,
      ).mode,
    ).toBe("invalid");
    expect(
      readFirebaseSettings(
        { ...emulator, VITE_FIREBASE_USE_EMULATORS: "false" },
        true,
      ).mode,
    ).toBe("invalid");
  });
  it("recognizes cancellation and provides actionable popup/domain failures", () => {
    expect(
      authErrorMessage({ code: "auth/popup-closed-by-user" }).cancelled,
    ).toBe(true);
    expect(authErrorMessage({ code: "auth/popup-blocked" }).message).toContain(
      "Allow popups",
    );
    expect(
      authErrorMessage({ code: "auth/unauthorized-domain" }).message,
    ).toContain("not authorized");
  });
});
