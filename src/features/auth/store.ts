import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useTrackerStore } from "../tracker/store";
import { LocalStorageAdapter } from "../tracker/persistence";
import { FirestoreAdapter } from "../cloud/firestoreAdapter";
import {
  firebaseSettings,
  getFirebaseRuntime,
} from "../../shared/firebase/runtime";
import type { FirebaseSettings } from "../../shared/firebase/config";
import type { PersistenceAdapter } from "../../shared/types";
import {
  authErrorMessage,
  FirebaseAuthService,
  type AuthService,
  type SessionUser,
} from "./authService";

export interface SessionDependencies {
  settings: FirebaseSettings;
  createAuth(): AuthService;
  createCloud(user: SessionUser): PersistenceAdapter;
  createDemo(): PersistenceAdapter;
}
const defaults: SessionDependencies = {
  settings: firebaseSettings,
  createAuth: () => new FirebaseAuthService(getFirebaseRuntime().auth),
  createCloud: (user) => {
    const { auth, db } = getFirebaseRuntime();
    return new FirestoreAdapter(
      db,
      user.uid,
      () => auth.currentUser?.uid === user.uid,
    );
  },
  createDemo: () => new LocalStorageAdapter(),
};
export const useSessionStore = defineStore("session", () => {
  const tracker = useTrackerStore();
  const phase = ref<"loading" | "demo" | "connected" | "error">("loading");
  const user = ref<SessionUser | null>(null);
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const settingsMode = ref(defaults.settings.mode);
  const storageLabel = computed(() =>
    phase.value === "connected"
      ? !tracker.ready
        ? "Selected storage unavailable · retry required"
        : settingsMode.value === "emulator"
          ? "Connected storage · local emulators"
          : "Connected storage · Firestore"
      : phase.value === "demo"
        ? "Demo storage · this browser"
        : phase.value === "loading"
          ? "Resolving session…"
          : "Storage unavailable",
  );
  let dependencies = defaults;
  let auth: AuthService | undefined;
  let unsubscribe: (() => void) | undefined;
  let generation = 0;
  let actionVersion = 0;
  let subscription = 0;
  let started = false;
  function stopObserver() {
    subscription++;
    unsubscribe?.();
    unsubscribe = undefined;
  }
  async function switchUser(nextUser: SessionUser | null) {
    if (user.value?.uid !== nextUser?.uid) {
      actionVersion++;
      busy.value = false;
    }
    const current = ++generation;
    tracker.reset();
    user.value = nextUser;
    phase.value = "loading";
    error.value = "";
    notice.value = "";
    try {
      await tracker.init(
        nextUser
          ? dependencies.createCloud(nextUser)
          : dependencies.createDemo(),
      );
      if (current !== generation) return;
      phase.value = nextUser ? "connected" : "demo";
    } catch (failure) {
      if (current === generation) fail(failure);
    }
  }
  function fail(failure: unknown) {
    generation++;
    actionVersion++;
    busy.value = false;
    tracker.reset();
    phase.value = "error";
    error.value = `${authErrorMessage(failure).message} Retry the session or explicitly choose demo storage. No data was moved.`;
  }
  function observe() {
    generation++;
    stopObserver();
    const active = subscription;
    auth ??= dependencies.createAuth();
    phase.value = "loading";
    tracker.reset();
    unsubscribe = auth.observe(
      (nextUser) => {
        if (active === subscription) void switchUser(nextUser);
      },
      (failure) => {
        if (active === subscription) fail(failure);
      },
    );
  }
  async function start(overrides?: SessionDependencies) {
    if (started && !overrides) return;
    started = true;
    if (overrides) {
      generation++;
      actionVersion++;
      busy.value = false;
      stopObserver();
      auth = undefined;
      dependencies = overrides;
    }
    settingsMode.value = dependencies.settings.mode;
    if (dependencies.settings.mode === "disabled") {
      await switchUser(null);
      return;
    }
    if (dependencies.settings.mode === "invalid") {
      tracker.reset();
      phase.value = "error";
      error.value =
        dependencies.settings.error ?? "Firebase configuration needs review.";
      return;
    }
    try {
      observe();
    } catch (failure) {
      fail(failure);
    }
  }
  async function signIn() {
    if (busy.value) return;
    error.value = "";
    notice.value = "";
    if (["disabled", "invalid"].includes(dependencies.settings.mode)) {
      error.value =
        dependencies.settings.error ??
        "Google sign-in needs Firebase web configuration. Demo storage remains available without an account.";
      return;
    }
    let action = actionVersion;
    try {
      if (!unsubscribe) observe();
      action = ++actionVersion;
      busy.value = true;
      await auth!.signIn();
      // Only the authentication observer may establish an authenticated session.
    } catch (failure) {
      if (action !== actionVersion) return;
      const detail = authErrorMessage(failure);
      if (detail.cancelled) notice.value = detail.message;
      else error.value = detail.message;
    } finally {
      if (action === actionVersion) busy.value = false;
    }
  }
  async function signOut() {
    if (!auth || busy.value) return;
    const previous = user.value;
    const action = ++actionVersion;
    generation++;
    tracker.reset();
    phase.value = "loading";
    error.value = "";
    notice.value = "";
    busy.value = true;
    try {
      await auth.signOut();
    } catch (failure) {
      if (action !== actionVersion) return;
      // Do not fall back to local storage when sign-out fails.
      user.value = previous;
      phase.value = "error";
      error.value = authErrorMessage(failure).message;
    } finally {
      if (action === actionVersion) busy.value = false;
    }
  }
  async function useDemo() {
    if (user.value) {
      await signOut();
      return;
    }
    stopObserver();
    actionVersion++;
    busy.value = false;
    await switchUser(null);
  }
  async function retry() {
    error.value = "";
    notice.value = "";
    await start({ ...dependencies });
  }
  function dispose() {
    generation++;
    actionVersion++;
    stopObserver();
    tracker.reset();
    user.value = null;
    busy.value = false;
    started = false;
    auth = undefined;
  }
  return {
    phase,
    user,
    busy,
    error,
    notice,
    settingsMode,
    storageLabel,
    start,
    signIn,
    signOut,
    useDemo,
    retry,
    dispose,
  };
});
