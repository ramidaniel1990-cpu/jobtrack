import type { AppData } from "../../shared/types";
import { createSearch } from "../../shared/types";
import { createDemoOffers, assessOffer } from "./demoService";

// Refresh only the built-in demo catalogue. Searches and external offers are untouched.
export function localizeDemoData(data: AppData): AppData {
  const catalogue = createDemoOffers();
  return {
    ...data,
    offers: data.offers.map((offer) => {
      const sample = catalogue.find(
        (item) => item.id === offer.id && item.company === offer.company,
      );
      if (!sample) return offer;
      const search = data.searches.find(
        (item) => item.id === offer.searchIds.at(-1),
      );
      const translated = {
        ...sample,
        publishedAt: offer.publishedAt,
        searchIds: offer.searchIds,
      };
      // Historical saved offers may no longer meet required criteria; retain them.
      const assessment = assessOffer(
        translated,
        search ?? createSearch(),
      ).offer;
      return {
        ...translated,
        score: assessment.score,
        explanation: assessment.explanation,
      };
    }),
  };
}
