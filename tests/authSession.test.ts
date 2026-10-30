import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  useSessionStore,
  type SessionDependencies,
} from "../src/features/auth/store";
import { useTrackerStore } from "../src/features/tracker/store";
import type {
  AuthService,
  SessionUser,
} from "../src/features/auth/authService";
import { createSearch, type AppData } from "../src/shared/types";
import { emptyData } from "../src/features/tracker/persistence";

function setup() {
  let listener: ((user: SessionUser | null) => void) | undefined;
  let stopped = 0;
  let demoLoads = 0;
  let cloudLoads = 0;
  let signInFailure: unknown;
  const pending = new Map<string, (data: AppData) => void>();
  const auth: AuthService = {
    observe: (next) => {
      listener = next;
      return () => {
        stopped++;
      };
    },
    signIn: async () => {
      if (signInFailure) throw signInFailure;
    },
    signOut: async () => {
      listener?.(null);
    },
  };
  const dependencies: SessionDependencies = {
    settings: { mode: "connected" },
    createAuth: () => auth,
    createDemo: () => ({
      load: () => {
        demoLoads++;
        return emptyData();
      },
      save: () => undefined,
    }),
    createCloud: (user) => ({
      load: () => {
        cloudLoads++;
        return new Promise((resolve) => pending.set(user.uid, resolve));
      },
      save: async () => undefined,
    }),
  };
  return {
    auth,
    dependencies,
    emit: (uid: string | null) =>
      listener?.(uid ? { uid, displayName: uid, email: null } : null),
    pending,
    failSignIn: (error: unknown) => {
      signInFailure = error;
    },
    stats: () => ({ stopped, demoLoads, cloudLoads }),
  };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
describe("session coordinator with explicit test doubles", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("does not complete an old session transition while a retry is resolving a new observer", async () => {
    const fixture = setup();
    const session = useSessionStore();
    const tracker = useTrackerStore();
    await session.start(fixture.dependencies);
    fixture.emit("A");
    await session.retry();
    fixture.pending.get("A")!(emptyData());
    await flush();
    expect(session.phase).toBe("loading");
    expect(tracker.ready).toBe(false);
    fixture.emit(null);
    await flush();
    expect(session.phase).toBe("demo");
    session.dispose();
  });
  it("ignores a cancelled popup response after another user session is established", async () => {
    const fixture = setup();
    const session = useSessionStore();
    let rejectPopup!: (error: unknown) => void;
    fixture.auth.signIn = () =>
      new Promise((_resolve, reject) => {
        rejectPopup = reject;
      });
    await session.start(fixture.dependencies);
    fixture.emit(null);
    await flush();
    const popup = session.signIn();
    fixture.emit("B");
    fixture.pending.get("B")!(emptyData());
    await flush();
    rejectPopup({ code: "auth/popup-closed-by-user" });
    await popup;
    expect(session.user?.uid).toBe("B");
    expect(session.notice).toBe("");
    expect(session.error).toBe("");
    expect(session.busy).toBe(false);
    session.dispose();
  });
  it("waits for auth before reading storage and does not upload demo data", async () => {
    const fixture = setup();
    const session = useSessionStore();
    const tracker = useTrackerStore();
    await session.start(fixture.dependencies);
    expect(session.phase).toBe("loading");
    expect(fixture.stats().demoLoads).toBe(0);
    expect(fixture.stats().cloudLoads).toBe(0);
    fixture.emit("A");
    fixture.pending.get("A")!(emptyData());
    await flush();
    expect(session.phase).toBe("connected");
    expect(tracker.searches).toEqual([]);
    expect(fixture.stats().demoLoads).toBe(0);
    session.dispose();
  });
  it("clears prior data and ignores slow reads from a previous user", async () => {
    const fixture = setup();
    const session = useSessionStore();
    const tracker = useTrackerStore();
    await session.start(fixture.dependencies);
    fixture.emit("A");
    fixture.emit("B");
    const old = createSearch();
    old.name = "Private A";
    fixture.pending.get("B")!(emptyData());
    await flush();
    fixture.pending.get("A")!({ ...emptyData(), searches: [old] });
    await flush();
    expect(session.user?.uid).toBe("B");
    expect(tracker.searches).toEqual([]);
    session.dispose();
  });
  it("keeps cloud failures visible until retry or an explicit demo choice", async () => {
    const fixture = setup();
    fixture.dependencies.createCloud = () => ({
      load: async () => {
        throw new Error("unavailable");
      },
      save: async () => undefined,
    });
    const session = useSessionStore();
    const tracker = useTrackerStore();
    await session.start(fixture.dependencies);
    fixture.emit("A");
    await flush();
    expect(session.phase).toBe("connected");
    expect(tracker.error).toContain("Could not load");
    expect(session.storageLabel).toContain("unavailable");
    expect(tracker.canRetry).toBe(true);
    expect(fixture.stats().demoLoads).toBe(0);
    await session.signOut();
    await flush();
    expect(session.phase).toBe("demo");
    expect(tracker.searches).toEqual([]);
    session.dispose();
  });
  it("does not simulate successful sign-in and reports cancellation", async () => {
    const fixture = setup();
    const session = useSessionStore();
    await session.start(fixture.dependencies);
    fixture.emit(null);
    await flush();
    fixture.failSignIn({ code: "auth/popup-closed-by-user" });
    await session.signIn();
    expect(session.user).toBeNull();
    expect(session.phase).toBe("demo");
    expect(session.notice).toContain("cancelled");
    session.dispose();
  });
  it("starts a functional demo without creating an Auth or cloud service when disabled", async () => {
    const fixture = setup();
    fixture.dependencies.settings = { mode: "disabled" };
    fixture.dependencies.createAuth = () => {
      throw new Error("Must not initialize Firebase");
    };
    const session = useSessionStore();
    const tracker = useTrackerStore();
    await session.start(fixture.dependencies);
    const search = createSearch();
    search.name = "Local demo";
    expect(tracker.saveSearch(search)).toBe(true);
    await tracker.runSearch(search.id);
    expect(tracker.offers).toHaveLength(4);
    expect(fixture.stats().cloudLoads).toBe(0);
    session.dispose();
  });
});
