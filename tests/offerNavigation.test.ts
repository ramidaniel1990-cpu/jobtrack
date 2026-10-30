import { effectScope, nextTick, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { expect, it } from "vitest";
import { useOfferFilters } from "../src/features/tracker/composables/useOfferFilters";
import { useTrackerStore } from "../src/features/tracker/store";
import { createSearch } from "../src/shared/types";
import { DemoJobSearchService } from "../src/features/tracker/demoService";
import { emptyData } from "../src/features/tracker/persistence";

it("resets search and discarded filters when switching from latest results to Saved", async () => {
  setActivePinia(createPinia());
  const store = useTrackerStore();
  store.init(
    { load: emptyData, save: () => undefined },
    new DemoJobSearchService(0),
  );
  const first = createSearch();
  first.name = "All offers";
  store.saveSearch(first);
  await store.runSearch(first.id);
  store.decide("demo-northstar-vue", "saved");
  const second = createSearch();
  second.name = "React only";
  second.filters.technologies = { value: "React", required: true };
  store.saveSearch(second);
  await store.runSearch(second.id);
  const saved = ref(false);
  const scope = effectScope();
  const filters = scope.run(() => useOfferFilters(saved, store))!;
  expect(filters.offers.value.map((offer) => offer.company)).toEqual([
    "Orbit Labs",
  ]);
  filters.showDiscarded.value = true;
  saved.value = true;
  await nextTick();
  expect(filters.selectedSearch.value).toBe("");
  expect(filters.showDiscarded.value).toBe(false);
  expect(filters.offers.value.map((offer) => offer.company)).toEqual([
    "Northstar Studio",
  ]);
  saved.value = false;
  await nextTick();
  expect(filters.offers.value.map((offer) => offer.company)).toEqual([
    "Orbit Labs",
  ]);
  scope.stop();
});
