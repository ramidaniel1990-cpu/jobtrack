import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  JobSearch,
  JobSearchService,
  OfferDecision,
  PersistenceAdapter,
  SearchDiagnostic,
} from "../../shared/types";
import { DemoJobSearchService, mergeOffers } from "./demoService";
import { validateSearch } from "../../shared/searchValidation";
import { usePersistenceSession } from "./persistenceSession";

export const useTrackerStore = defineStore("tracker", () => {
  const session = usePersistenceSession();
  const { data, error, success, ready, initializing, saving, sessionKey } =
    session;
  const searches = computed(() => data.value.searches);
  const offers = computed(() => data.value.offers);
  const decisions = computed(() => data.value.decisions);
  const loadingId = ref<string | null>(null);
  const diagnostics = ref<SearchDiagnostic[]>([]);
  const lastSearchId = ref("");
  let service: JobSearchService = new DemoJobSearchService();

  function clearSearchState() {
    loadingId.value = null;
    diagnostics.value = [];
    lastSearchId.value = "";
  }
  function reset() {
    session.reset();
    clearSearchState();
    service = new DemoJobSearchService();
  }
  function init(
    adapter?: PersistenceAdapter,
    searchService?: JobSearchService,
  ) {
    if (ready.value && !adapter) return;
    clearSearchState();
    service = searchService ?? new DemoJobSearchService();
    return session.init(adapter);
  }
  function validate(search: JobSearch) {
    session.clearRetry();
    const issues = validateSearch(search);
    if (!issues.length) return true;
    success.value = "";
    error.value = issues.join(" ");
    return false;
  }
  function writable() {
    return (
      ready.value && !initializing.value && !saving.value && !loadingId.value
    );
  }
  function saveSearch(search: JobSearch) {
    if (!writable()) return false;
    const copy = JSON.parse(JSON.stringify(search)) as JobSearch;
    copy.name = copy.name.trim();
    if (!validate(copy)) return false;
    // Canonical numeric text matches the server rules while keeping empty filters empty.
    for (const key of ["minSalary", "maxAgeDays"] as const) {
      if (copy.filters[key].value.trim())
        copy.filters[key].value = String(Number(copy.filters[key].value));
    }
    return session.commit(
      {
        ...data.value,
        searches: [
          ...searches.value.filter((item) => item.id !== copy.id),
          copy,
        ],
      },
      "Search saved.",
    );
  }
  function deleteSearch(id: string) {
    if (!writable()) return false;
    return session.commit(
      {
        ...data.value,
        searches: searches.value.filter((search) => search.id !== id),
      },
      "Search deleted. Offers and your decisions have been kept.",
    );
  }
  function togglePause(id: string) {
    if (!writable()) return false;
    return session.commit(
      {
        ...data.value,
        searches: searches.value.map((search) =>
          search.id === id ? { ...search, paused: !search.paused } : search,
        ),
      },
      "Status updated. Scheduled searches do not run yet.",
    );
  }
  async function runSearch(id: string): Promise<boolean> {
    const search = searches.value.find((item) => item.id === id);
    if (!search || loadingId.value || !writable()) return false;
    session.clearRetry();
    if (search.paused) {
      success.value = "";
      error.value = "Resume this search before running it.";
      return false;
    }
    if (!validate(search)) return false;
    const key = sessionKey.value;
    const runningService = service;
    loadingId.value = id;
    error.value = "";
    success.value = "";
    diagnostics.value = [];
    try {
      const results = await runningService.search(search);
      if (
        !session.current(key) ||
        !searches.value.some((item) => item.id === id)
      )
        return false;
      const nextDiagnostics = runningService.getDiagnostics?.() ?? [];
      const previousOffers = offers.value.map((offer) => ({
        ...offer,
        searchIds: offer.searchIds.filter((searchId) => searchId !== id),
      }));
      return await session.commit(
        {
          ...data.value,
          offers: mergeOffers(previousOffers, results),
          searches: searches.value.map((item) =>
            item.id === id
              ? { ...item, lastRunAt: new Date().toISOString() }
              : item,
          ),
        },
        `${results.length} simulated offers found. Duplicates are not added.`,
        () => {
          lastSearchId.value = id;
          diagnostics.value = nextDiagnostics;
        },
      );
    } catch {
      if (!session.current(key)) return false;
      error.value = "The demo search failed. Please try again.";
      session.offerRetry(() => runSearch(id), key);
      return false;
    } finally {
      if (session.current(key)) loadingId.value = null;
    }
  }
  function decide(id: string, decision?: OfferDecision) {
    if (!writable()) return false;
    const next = { ...decisions.value };
    if (decision) next[id] = decision;
    else delete next[id];
    return session.commit(
      { ...data.value, decisions: next },
      decision === "saved"
        ? "Offer saved."
        : decision === "discarded"
          ? "Offer discarded."
          : "Offer restored.",
    );
  }
  return {
    searches,
    offers,
    decisions,
    loadingId,
    error,
    success,
    migrationNotice: session.migrationNotice,
    diagnostics,
    lastSearchId,
    ready,
    initializing,
    saving,
    sessionKey,
    canRetry: session.canRetry,
    init,
    reset,
    retry: session.retry,
    saveSearch,
    deleteSearch,
    togglePause,
    runSearch,
    decide,
  };
});
