import { computed, ref, watch, type Ref } from "vue";
import type { JobOffer, OfferDecision } from "../../../shared/types";

interface OfferFilterSource {
  lastSearchId: string;
  offers: JobOffer[];
  decisions: Record<string, OfferDecision>;
}
export function useOfferFilters(
  saved: Ref<boolean | undefined>,
  source: OfferFilterSource,
) {
  const showDiscarded = ref(false);
  const selectedSearch = ref(saved.value ? "" : source.lastSearchId);
  watch(saved, (value) => {
    selectedSearch.value = value ? "" : source.lastSearchId;
    showDiscarded.value = false;
  });
  const offers = computed(() =>
    source.offers.filter((offer) => {
      const decision = source.decisions[offer.id];
      const visible = saved.value
        ? decision === "saved"
        : showDiscarded.value
          ? decision === "discarded"
          : decision !== "discarded";
      return (
        visible &&
        (!selectedSearch.value ||
          offer.searchIds.includes(selectedSearch.value))
      );
    }),
  );
  return { showDiscarded, selectedSearch, offers };
}
