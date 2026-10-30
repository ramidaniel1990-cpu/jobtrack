import { beforeEach, describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { createSearch } from "../src/shared/types";
import { LocalStorageAdapter } from "../src/features/tracker/persistence";
import { useTrackerStore } from "../src/features/tracker/store";
import {
  DemoJobSearchService,
  createDemoOffers,
} from "../src/features/tracker/demoService";
import SearchForm from "../src/features/tracker/components/SearchForm.vue";
import OfferDetailView from "../src/features/tracker/views/OfferDetailView.vue";

function storage(initial: string | null = null) {
  let raw = initial;
  let writes = 0;
  return {
    adapter: new LocalStorageAdapter({
      getItem: () => raw,
      setItem: (_key, next) => {
        raw = next;
        writes++;
      },
    }),
    read: () => raw,
    writes: () => writes,
  };
}
describe("legacy migration", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("does not demote mandatory criteria while restoring historical saved offers", () => {
    const search = createSearch();
    search.name = "Salary review";
    search.currency = "USD";
    search.filters.minSalary = { value: "35000", required: true };
    const sample = { ...createDemoOffers()[0]!, searchIds: [search.id] };
    const memory = storage(
      JSON.stringify({
        searches: [search],
        offers: [sample],
        decisions: { [sample.id]: "saved" },
      }),
    );
    const store = useTrackerStore();
    store.init(memory.adapter);
    expect(store.offers[0]?.explanation).toContain(
      "cannot be compared without currency conversion",
    );
    expect(store.offers[0]?.explanation).toContain(
      "Not included among offers meeting all requirements",
    );
    expect(store.offers[0]?.explanation).not.toContain(
      "All mandatory criteria are verified",
    );
    expect(store.decisions[sample.id]).toBe("saved");
  });
  it("converts known number/array representations only in memory and retains decisions", () => {
    const search = createSearch();
    search.name = "Original name";
    const legacy = {
      ...search,
      filters: {
        ...search.filters,
        minSalary: { value: 35000, required: true },
        technologies: { value: ["Vue", "TypeScript"], required: false },
      },
    };
    const original = JSON.stringify({
      searches: [legacy],
      offers: [],
      decisions: { existing: "saved" },
    });
    const memory = storage(original);
    const data = memory.adapter.load();
    expect(data.searches[0]?.filters.minSalary.value).toBe("35000");
    expect(data.searches[0]?.filters.technologies.value).toBe(
      "Vue, TypeScript",
    );
    expect(data.decisions.existing).toBe("saved");
    expect(memory.adapter.migrationNotice).toContain("always apply");
    expect(memory.read()).toBe(original);
    expect(memory.writes()).toBe(0);
    memory.adapter.save(data);
    expect(JSON.parse(memory.read()!).schemaVersion).toBe(2);
  });
  it("preserves unconvertible source data and prevents subsequent writes", () => {
    const search = createSearch();
    const original = JSON.stringify({
      searches: [
        {
          ...search,
          filters: {
            ...search.filters,
            experience: { value: { unknown: true }, required: false },
          },
        },
      ],
      offers: [],
      decisions: {},
    });
    const memory = storage(original);
    const store = useTrackerStore();
    store.init(memory.adapter);
    expect(store.error).toContain("need review");
    search.name = "New search";
    expect(store.saveSearch(search)).toBe(false);
    expect(memory.read()).toBe(original);
    expect(memory.writes()).toBe(0);
  });
  it("retains unfamiliar frequency values so the form can flag them for review", () => {
    const search = createSearch();
    const original = JSON.stringify({
      searches: [
        { ...search, schedule: { ...search.schedule, frequency: "monthly" } },
      ],
      offers: [],
      decisions: {},
    });
    const memory = storage(original);
    expect(memory.adapter.load().searches[0]?.schedule.frequency).toBe(
      "monthly",
    );
    expect(memory.read()).toBe(original);
  });
  it("opening or cancelling a form cannot write storage or change the original search", async () => {
    const search = createSearch();
    search.name = "Keep me";
    search.filters.experience.value = "Lead";
    const original = JSON.stringify({
      searches: [search],
      offers: [],
      decisions: {},
    });
    const memory = storage(original);
    const store = useTrackerStore();
    store.init(memory.adapter);
    const html = await renderToString(
      createSSRApp({
        render: () => h(SearchForm, { search: store.searches[0] }),
      }),
    );
    expect(html).toContain("Cancel");
    expect(html).toContain("need review");
    expect(memory.writes()).toBe(0);
    expect(memory.read()).toBe(original);
    expect(store.searches[0]?.filters.experience.value).toBe("Lead");
  });
  it("keeps historical saved offers even when new unconditional exclusions reject them", () => {
    const search = createSearch();
    search.name = "Saved history";
    search.filters.excludedWords.value = "Frontend";
    const sample = { ...createDemoOffers()[0]!, searchIds: [search.id] };
    const memory = storage(
      JSON.stringify({
        searches: [search],
        offers: [sample],
        decisions: { [sample.id]: "saved" },
      }),
    );
    const store = useTrackerStore();
    store.init(memory.adapter);
    expect(store.error).toBe("");
    expect(store.decisions[sample.id]).toBe("saved");
    expect(store.offers[0]?.explanation).toContain("Not included");
  });
});

describe("automated create-search-detail-save-reload workflow", () => {
  it("preserves edits, schedule, pause and offer decisions through real adapter round-trips", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const memory = storage();
    const store = useTrackerStore();
    store.init(memory.adapter, new DemoJobSearchService(0));
    const search = createSearch();
    search.name = "Frontend radar";
    search.schedule = {
      frequency: "weekly",
      time: "10:30",
      timezone: "Europe/Berlin",
      weekday: "3",
    };
    expect(store.saveSearch(search)).toBe(true);
    await store.runSearch(search.id);
    const offer = store.offers[0]!;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/offers/:id", component: OfferDetailView }],
    });
    await router.push(`/offers/${offer.id}`);
    const html = await renderToString(
      createSSRApp({ render: () => h(OfferDetailView) })
        .use(pinia)
        .use(router),
    );
    expect(html).toContain(offer.title);
    expect(html).toContain("Save offer");
    store.decide(offer.id, "saved");
    await store.runSearch(search.id);
    expect(store.offers).toHaveLength(4);
    const edit = JSON.parse(JSON.stringify(store.searches[0])) as typeof search;
    edit.name = "Updated radar";
    expect(store.saveSearch(edit)).toBe(true);
    store.togglePause(search.id);
    await store.runSearch(search.id);
    expect(store.error).toContain("Resume");
    store.togglePause(search.id);
    store.decide(offer.id, "discarded");
    expect(store.decisions[offer.id]).toBe("discarded");
    store.decide(offer.id);
    expect(store.decisions[offer.id]).toBeUndefined();
    store.decide(offer.id, "saved");
    setActivePinia(createPinia());
    const reloaded = useTrackerStore();
    reloaded.init(memory.adapter, new DemoJobSearchService(0));
    expect(reloaded.searches[0]?.name).toBe("Updated radar");
    expect(reloaded.searches[0]?.schedule).toEqual(search.schedule);
    expect(reloaded.searches[0]?.paused).toBe(false);
    expect(reloaded.decisions[offer.id]).toBe("saved");
    expect(reloaded.offers).toHaveLength(4);
  });
});
