import type { FilterKey, JobOffer, JobSearch } from "../../shared/types";
import { filterDefinitions } from "../../shared/types";
import { splitFilterValues } from "../../shared/filterValues";

export type MatchStatus = "matched" | "unmatched" | "unknown";
export interface CriterionAssessment {
  status: MatchStatus;
  reason: string;
}
export interface OfferAssessment {
  offer: JobOffer;
  eligible: boolean;
  reasons: string[];
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
const missing = (value: string) =>
  ["", "unknown", "not specified", "not listed", "n/a"].includes(
    normalize(value),
  );
const terms = (value: string) => splitFilterValues(value).map(normalize);
const result = (matches: boolean, reason = ""): CriterionAssessment => ({
  status: matches ? "matched" : "unmatched",
  reason,
});
const unknown = (reason: string): CriterionAssessment => ({
  status: "unknown",
  reason,
});
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function assessCriterion(
  offer: JobOffer,
  key: FilterKey,
  value: string,
  currency: string,
  now = Date.now(),
): CriterionAssessment {
  if (!terms(value).length) return result(true);
  if (key === "minSalary") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0)
      return unknown("The minimum annual salary is invalid and needs review.");
    if (
      offer.salary === undefined ||
      !Number.isFinite(offer.salary) ||
      offer.salary < 0
    )
      return unknown(
        "Annual salary is not available, so the minimum salary cannot be verified.",
      );
    if (!offer.currency || offer.currency !== currency)
      return unknown(
        `Salary comparison is unknown: ${offer.currency || "unknown currency"} and ${currency} cannot be compared without currency conversion.`,
      );
    return result(
      offer.salary >= amount,
      "Annual salary is below the requested minimum.",
    );
  }
  if (key === "maxAgeDays") {
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0)
      return unknown(
        "The maximum listing age must be a non-negative whole number and needs review.",
      );
    const date = Date.parse(offer.publishedAt);
    if (!Number.isFinite(date) || date > now)
      return unknown(
        "The publication date is unknown or invalid, so the listing age cannot be verified.",
      );
    // Listing age uses UTC calendar days: zero includes listings from today.
    const ageInDays = Math.floor(now / 86400000) - Math.floor(date / 86400000);
    return result(
      ageInDays <= days,
      "The listing is older than the maximum allowed age.",
    );
  }
  if (key === "excludedWords") {
    const knownFields = [
      offer.title,
      offer.company,
      offer.description,
      ...offer.technologies,
    ].filter((item) => !missing(item));
    if (!knownFields.length)
      return unknown(
        "Listing text is unavailable, so excluded words cannot be checked.",
      );
    const text = normalize(knownFields.join(" "));
    const excluded = terms(value).find((term) =>
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])${escaped(term)}(?=$|[^\\p{L}\\p{N}_])`,
        "u",
      ).test(text),
    );
    return result(
      !excluded,
      excluded ? `Excluded word or phrase found: ${excluded}.` : "",
    );
  }
  if (key === "technologies" || key === "languages") {
    const values = offer[key].filter((item) => !missing(item)).map(normalize);
    if (!values.length)
      return unknown(
        `${key === "technologies" ? "Technology" : "Language"} information is unavailable.`,
      );
    return result(
      terms(value).some((term) => values.includes(term)),
      `No matching ${key} alternative was found.`,
    );
  }
  const field = key === "keywords" ? offer.title : offer[key];
  if (missing(field))
    return unknown(
      `${filterDefinitions.find((item) => item.key === key)?.label ?? key} information is unavailable.`,
    );
  const matches =
    key === "experience" || key === "modality" || key === "employment"
      ? terms(value).includes(normalize(field))
      : terms(value).some((term) => normalize(field).includes(term));
  return result(
    matches,
    `No matching ${filterDefinitions.find((item) => item.key === key)?.label.toLowerCase() ?? key} alternative was found.`,
  );
}

export function assessOffer(
  offer: JobOffer,
  search: JobSearch,
  now = Date.now(),
): OfferAssessment {
  const active = filterDefinitions.filter(
    ({ key }) => terms(search.filters[key].value).length,
  );
  const criteria = active.map((definition) => ({
    ...definition,
    assessment: assessCriterion(
      offer,
      definition.key,
      search.filters[definition.key].value,
      search.currency,
      now,
    ),
  }));
  const mandatory = criteria.filter(
    ({ key }) =>
      key === "excludedWords" ||
      key === "maxAgeDays" ||
      search.filters[key].required,
  );
  const reasons = mandatory
    .filter((item) => item.assessment.status !== "matched")
    .map((item) => `${item.label}: ${item.assessment.reason}`);
  const matched = criteria.filter(
    (item) => item.assessment.status === "matched",
  );
  const missed = criteria.filter(
    (item) =>
      item.assessment.status === "unmatched" && !mandatory.includes(item),
  );
  const unverifiable = criteria.filter(
    (item) => item.assessment.status === "unknown",
  );
  const explanation = active.length
    ? `Simulated assessment. Matches: ${matched.map((item) => item.label.toLowerCase()).join(", ") || "no criteria"}.${missed.length ? ` Unmatched preferences: ${missed.map((item) => item.label.toLowerCase()).join(", ")}.` : ""}${unverifiable.length ? ` Unknown comparisons: ${unverifiable.map((item) => `${item.label.toLowerCase()}: ${item.assessment.reason}`).join(" ")}` : ""}${reasons.length ? ` Not included among offers meeting all requirements: ${reasons.join(" ")}` : " All mandatory criteria are verified."}`
    : "Simulated assessment. No preferences specified; the full demo catalogue is shown.";
  return {
    eligible: reasons.length === 0,
    reasons,
    offer: {
      ...offer,
      searchIds: [search.id],
      score: active.length
        ? Math.round((matched.length / active.length) * 100)
        : 100,
      explanation,
    },
  };
}

export function assessOffers(
  offers: JobOffer[],
  search: JobSearch,
  now = Date.now(),
): OfferAssessment[] {
  return offers.map((offer) => assessOffer(offer, search, now));
}
