import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  createSearch,
  type AppData,
  type PersistenceAdapter,
} from "../src/shared/types";
import { emptyData } from "../src/features/tracker/persistence";
import { useTrackerStore } from "../src/features/tracker/store";
import { createDemoOffers } from "../src/features/tracker/demoService";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function namedSearch(name = "Cloud search") {
  const search = createSearch();
  search.name = name;
  return search;
}

describe("storage identity lifetime and confirmed writes", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("waits for asynchronous data before allowing any mutation", async () => {
    const pending = deferred<AppData>();
    const save = vi.fn();
    const store = useTrackerStore();
    const load = store.init({ load: () => pending.promise, save });
    expect(store.initializing).toBe(true);
    expect(store.ready).toBe(false);
    expect(store.saveSearch(namedSearch())).toBe(false);
    expect(save).not.toHaveBeenCalled();
    pending.resolve(emptyData());
    await load;
    expect(store.ready).toBe(true);
    expect(store.initializing).toBe(false);
  });
  it("keeps confirmed state and success unchanged until the save completes", async () => {
    const pending = deferred<void>();
    const store = useTrackerStore();
    await store.init({
      load: async () => emptyData(),
      save: () => pending.promise,
    });
    const search = namedSearch();
    search.filters.minSalary.value = "0050000.50";
    search.filters.maxAgeDays.value = "1e1";
    const saving = store.saveSearch(search);
    expect(store.saving).toBe(true);
    expect(store.searches).toHaveLength(0);
    expect(store.success).toBe("");
    expect(store.saveSearch(namedSearch("Concurrent"))).toBe(false);
    pending.resolve();
    expect(await saving).toBe(true);
    expect(store.saving).toBe(false);
    expect(store.searches).toHaveLength(1);
    expect(store.searches[0]?.filters.minSalary.value).toBe("50000.5");
    expect(store.searches[0]?.filters.maxAgeDays.value).toBe("10");
    expect(search.filters.maxAgeDays.value).toBe("1e1");
    expect(store.success).toBe("Search saved.");
  });
  it("publishes search results and diagnostic metadata only after storage confirmation", async () => {
    const pending = deferred<void>();
    let saveCount = 0;
    const store = useTrackerStore();
    store.init(
      {
        load: emptyData,
        save: () => {
          saveCount++;
          return saveCount === 1 ? undefined : pending.promise;
        },
      },
      {
        search: async () => createDemoOffers(),
        getDiagnostics: () => [
          {
            offerId: "excluded",
            title: "Excluded demo",
            reasons: ["No match"],
          },
        ],
      },
    );
    const search = namedSearch();
    store.saveSearch(search);
    const running = store.runSearch(search.id);
    await Promise.resolve();
    expect(store.saving).toBe(true);
    expect(store.offers).toHaveLength(0);
    expect(store.lastSearchId).toBe("");
    expect(store.diagnostics).toEqual([]);
    pending.resolve();
    expect(await running).toBe(true);
    expect(store.offers).toHaveLength(4);
    expect(store.lastSearchId).toBe(search.id);
    expect(store.diagnostics).toHaveLength(1);
  });
  it("reports failures without fallback and retries the exact unconfirmed write", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValue(undefined);
    const store = useTrackerStore();
    await store.init({ load: async () => emptyData(), save });
    expect(await store.saveSearch(namedSearch())).toBe(false);
    expect(store.searches).toHaveLength(0);
    expect(store.error).toContain("Could not save changes");
    expect(store.canRetry).toBe(true);
    expect(await store.retry()).toBe(true);
    expect(store.searches).toHaveLength(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(store.error).toBe("");
  });
  it("loads errors with retry and never falls back to demo storage", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(emptyData());
    const store = useTrackerStore();
    await store.init({ load, save: async () => undefined });
    expect(store.ready).toBe(false);
    expect(store.error).toContain("storage mode has not changed");
    expect(store.canRetry).toBe(true);
    await store.retry();
    expect(store.ready).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("disposes and clears an old identity before ignoring late load results", async () => {
    const oldLoad = deferred<AppData>();
    const dispose = vi.fn();
    const store = useTrackerStore();
    const previous = store.init({
      load: () => oldLoad.promise,
      save: async () => undefined,
      dispose,
    });
    const key = store.sessionKey;
    store.reset();
    await store.init({
      load: async () => emptyData(),
      save: async () => undefined,
    });
    oldLoad.resolve({ ...emptyData(), searches: [namedSearch("User A")] });
    await previous;
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(store.sessionKey).toBeGreaterThan(key);
    expect(store.searches).toHaveLength(0);
    expect(store.error).toBe("");
    expect(store.ready).toBe(true);
  });
  it("ignores both late success and late failure from prior saves", async () => {
    for (const reject of [false, true]) {
      const pending = deferred<void>();
      const store = useTrackerStore();
      await store.init({
        load: async () => emptyData(),
        save: () => pending.promise,
      });
      const previous = store.saveSearch(namedSearch("User A"));
      store.reset();
      store.init({ load: emptyData, save: () => undefined });
      store.saveSearch(namedSearch("User B"));
      const success = store.success;
      if (reject) pending.reject(new Error("old failure"));
      else pending.resolve();
      expect(await previous).toBe(false);
      expect(store.searches.map((item) => item.name)).toEqual(["User B"]);
      expect(store.success).toBe(success);
      expect(store.error).toBe("");
      expect(store.saving).toBe(false);
    }
  });
  it("ignores old demo search results and clears all per-session display state", async () => {
    const pending = deferred<ReturnType<typeof createDemoOffers>>();
    const adapter: PersistenceAdapter = {
      load: emptyData,
      save: () => undefined,
    };
    const store = useTrackerStore();
    store.init(adapter, { search: () => pending.promise });
    const search = namedSearch();
    store.saveSearch(search);
    const previous = store.runSearch(search.id);
    store.reset();
    store.init(adapter);
    pending.resolve(createDemoOffers());
    expect(await previous).toBe(false);
    expect(store.offers).toHaveLength(0);
    expect(store.searches).toHaveLength(0);
    expect(store.lastSearchId).toBe("");
    expect(store.diagnostics).toEqual([]);
    expect(store.loadingId).toBeNull();
    expect(store.success).toBe("");
  });
  it("drops stale retry actions after any new mutation or identity reset", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue(undefined);
    const store = useTrackerStore();
    await store.init({ load: async () => emptyData(), save });
    await store.saveSearch(namedSearch("First"));
    expect(store.canRetry).toBe(true);
    await store.saveSearch(namedSearch("Second"));
    expect(store.canRetry).toBe(false);
    expect(store.searches.map((item) => item.name)).toEqual(["Second"]);
    store.reset();
    expect(store.canRetry).toBe(false);
  });
});
