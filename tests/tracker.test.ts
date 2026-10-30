import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  createSearch,
  type AppData,
  type PersistenceAdapter,
} from "../src/shared/types";
import {
  createDemoOffers,
  DemoJobSearchService,
  evaluateOffers,
  mergeOffers,
} from "../src/features/tracker/demoService";
import {
  emptyData,
  LocalStorageAdapter,
} from "../src/features/tracker/persistence";
import { useTrackerStore } from "../src/features/tracker/store";

describe("optional criteria and demo evaluation", () => {
  it("treats blank mandatory filters as no preference", () => {
    const search = createSearch();
    search.filters.technologies.required = true;
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(4);
  });
  it("ranks preferences but only mandatory criteria restrict results", () => {
    const search = createSearch();
    search.filters.technologies.value = "React";
    const preferred = evaluateOffers(createDemoOffers(), search);
    expect(preferred).toHaveLength(4);
    expect(preferred[0]?.technologies).toContain("React");
    search.filters.technologies.required = true;
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(1);
  });
  it("handles excluded terms, salary currency and unknown salaries", () => {
    const search = createSearch();
    search.filters.excludedWords = { value: "Junior", required: true };
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(3);
    search.filters.minSalary = { value: "40000", required: true };
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(2);
    search.currency = "USD";
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(0);
  });
  it("deduplicates stable identifiers while retaining search associations", () => {
    const offer = createDemoOffers()[0]!;
    const result = mergeOffers(
      [{ ...offer, searchIds: ["one"] }],
      [{ ...offer, searchIds: ["two"] }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.searchIds).toEqual(["one", "two"]);
  });
});

describe("persistence boundary and complete workflow", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("creates, searches, saves and restores without duplicates", async () => {
    let persisted: AppData = emptyData();
    const adapter: PersistenceAdapter = {
      load: () => structuredClone(persisted),
      save: (value) => {
        persisted = JSON.parse(JSON.stringify(value)) as AppData;
      },
    };
    const store = useTrackerStore();
    store.init(adapter, new DemoJobSearchService(0));
    const search = createSearch();
    search.name = "Mi primera búsqueda";
    expect(store.saveSearch(search)).toBe(true);
    await store.runSearch(search.id);
    const id = store.offers[0]!.id;
    store.decide(id, "saved");
    await store.runSearch(search.id);
    expect(store.offers).toHaveLength(4);
    expect(store.decisions[id]).toBe("saved");
    store.init(adapter);
    expect(store.searches).toHaveLength(1);
    expect(store.decisions[id]).toBe("saved");
    expect(store.error).toBe("");
  });
  it("refreshes search associations after editing without losing saved offers", async () => {
    const store = useTrackerStore();
    store.init(
      { load: emptyData, save: () => undefined },
      new DemoJobSearchService(0),
    );
    const search = createSearch();
    search.name = "Editable";
    store.saveSearch(search);
    await store.runSearch(search.id);
    store.decide("demo-northstar-vue", "saved");
    search.filters.technologies = { value: "React", required: true };
    store.saveSearch(search);
    await store.runSearch(search.id);
    expect(
      store.offers
        .filter((offer) => offer.searchIds.includes(search.id))
        .map((offer) => offer.id),
    ).toEqual(["demo-orbit-product"]);
    expect(store.offers).toHaveLength(4);
    expect(store.decisions["demo-northstar-vue"]).toBe("saved");
  });
  it("does not replace state when a storage write fails", () => {
    const store = useTrackerStore();
    store.init({
      load: emptyData,
      save: () => {
        throw new Error("quota");
      },
    });
    const search = createSearch();
    search.name = "Test";
    expect(store.saveSearch(search)).toBe(false);
    expect(store.searches).toHaveLength(0);
    expect(store.error).toContain("Could not save changes");
  });
  it("validates persisted data and reports malformed storage", () => {
    const adapter = new LocalStorageAdapter({
      getItem: () => '{"searches":[]}',
      setItem: () => undefined,
    });
    expect(() => adapter.load()).toThrow("invalid format");
    const store = useTrackerStore();
    store.init(adapter);
    expect(store.error).toContain("Could not read local data");
  });
  it("exposes service failure and clears the loading state", async () => {
    const store = useTrackerStore();
    store.init(
      { load: emptyData, save: () => undefined },
      {
        search: async () => {
          throw new Error("demo");
        },
      },
    );
    const search = createSearch();
    search.name = "Test";
    store.saveSearch(search);
    await store.runSearch(search.id);
    expect(store.error).toContain("demo search failed");
    expect(store.loadingId).toBeNull();
  });
});
