import { describe, expect, it } from "vitest";
import { createSearch } from "../src/shared/types";
import {
  assessCriterion,
  assessOffer,
  createDemoOffers,
  DemoJobSearchService,
  evaluateOffers,
  matchesCriterion,
} from "../src/features/tracker/demoService";

describe("strict restrictions and unknown information", () => {
  it("uses OR inside one criterion and AND between required criteria", () => {
    const search = createSearch();
    search.filters.modality = { value: "Remote, Hybrid", required: true };
    search.filters.experience = { value: "Mid, Senior", required: true };
    search.filters.technologies = { value: "Vue", required: true };
    expect(
      evaluateOffers(createDemoOffers(), search).map((item) => item.id),
    ).toEqual(["demo-northstar-vue", "demo-lumen-ui"]);
  });
  it("never excludes offers for unmatched or unverifiable preferences", () => {
    const search = createSearch();
    search.filters.minSalary.value = "40000";
    search.currency = "USD";
    const offers = evaluateOffers(createDemoOffers(), search);
    expect(offers).toHaveLength(4);
    expect(offers[0]?.score).toBe(0);
    expect(offers[0]?.explanation).toContain(
      "cannot be compared without currency conversion",
    );
    expect(
      offers.find((item) => item.id === "demo-lumen-ui")?.explanation,
    ).toContain("Annual salary is not available");
  });
  it("does not certify unknown required salary, currencies or missing fields", () => {
    const noText = {
      ...createDemoOffers()[0]!,
      title: "",
      company: "",
      description: "",
      technologies: [],
    };
    expect(assessCriterion(noText, "excludedWords", "PHP", "EUR").status).toBe(
      "unknown",
    );
    const search = createSearch();
    search.filters.minSalary = { value: "1", required: true };
    search.currency = "USD";
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(0);
    const unknown = assessOffer(createDemoOffers()[0]!, search);
    expect(unknown.eligible).toBe(false);
    expect(unknown.reasons.join(" ")).toContain("Salary comparison is unknown");
    search.filters.minSalary.value = "";
    search.filters.location = { value: "Madrid", required: true };
    expect(
      assessOffer(
        { ...createDemoOffers()[0]!, location: "" },
        search,
      ).reasons.join(" "),
    ).toContain("information is unavailable");
    search.filters.location.value = "";
    search.filters.languages = { value: "English", required: true };
    expect(
      assessOffer({ ...createDemoOffers()[0]!, languages: [] }, search)
        .eligible,
    ).toBe(false);
    expect(
      assessCriterion(
        { ...createDemoOffers()[0]!, languages: ["Unknown"] },
        "languages",
        "Unknown",
        "EUR",
      ).status,
    ).toBe("unknown");
  });
  it("always applies exclusions without matching unrelated substrings", () => {
    const search = createSearch();
    search.filters.excludedWords = { value: "  jÚnIoR  ", required: false };
    expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(3);
    const offer = {
      ...createDemoOffers()[0]!,
      title: "PHP Developer",
      description: "Work on shipping and scalable applications.",
      technologies: [],
    };
    expect(matchesCriterion(offer, "excludedWords", "PHP", "EUR")).toBe(false);
    expect(matchesCriterion(offer, "excludedWords", "ship, scala", "EUR")).toBe(
      true,
    );
    expect(matchesCriterion(offer, "excludedWords", "developer", "EUR")).toBe(
      false,
    );
    expect(matchesCriterion(offer, "excludedWords", " , ", "EUR")).toBe(true);
  });
  it("applies listing age regardless of Required, and cannot verify invalid dates", () => {
    const search = createSearch();
    search.filters.maxAgeDays = { value: "3", required: false };
    expect(
      evaluateOffers(createDemoOffers(), search).map((item) => item.id),
    ).toEqual(["demo-northstar-vue", "demo-lumen-ui"]);
    const offer = { ...createDemoOffers()[0]!, publishedAt: "unknown" };
    expect(assessOffer(offer, search).eligible).toBe(false);
    expect(assessOffer(offer, search).reasons.join(" ")).toContain(
      "listing age cannot be verified",
    );
    for (const age of ["-1", "0.5", "abc", "Infinity"]) {
      expect(
        assessCriterion(createDemoOffers()[0]!, "maxAgeDays", age, "EUR")
          .status,
      ).toBe("unknown");
    }
    expect(
      assessCriterion(
        { ...offer, publishedAt: "2026-01-01T12:00:00Z" },
        "maxAgeDays",
        "0",
        "EUR",
        Date.parse("2026-01-01T12:00:00Z"),
      ).status,
    ).toBe("matched");
  });
  it("does not treat invalid minimum salaries as confirmed matches", () => {
    for (const amount of ["-1", "abc", "Infinity"]) {
      expect(
        assessCriterion(createDemoOffers()[0]!, "minSalary", amount, "EUR")
          .status,
      ).toBe("unknown");
    }
  });
  it("uses UTC calendar-day age so zero includes today but excludes yesterday", () => {
    const offer = createDemoOffers()[0]!;
    const now = Date.parse("2026-10-27T23:59:00Z");
    expect(
      assessCriterion(
        { ...offer, publishedAt: "2026-10-27T00:00:00Z" },
        "maxAgeDays",
        "0",
        "EUR",
        now,
      ).status,
    ).toBe("matched");
    expect(
      assessCriterion(
        { ...offer, publishedAt: "2026-10-26T23:59:59Z" },
        "maxAgeDays",
        "0",
        "EUR",
        now,
      ).status,
    ).toBe("unmatched");
    expect(
      assessCriterion(
        { ...offer, publishedAt: "2026-10-26T23:59:59Z" },
        "maxAgeDays",
        "1",
        "EUR",
        now,
      ).status,
    ).toBe("matched");
    expect(
      assessCriterion(
        { ...offer, publishedAt: "2026-10-28T00:00:00Z" },
        "maxAgeDays",
        "1",
        "EUR",
        now,
      ).status,
    ).toBe("unknown");
  });
  it("provides excluded-offer diagnostics through the demo service", async () => {
    const service = new DemoJobSearchService(0);
    const search = createSearch();
    search.filters.minSalary = { value: "100", required: true };
    search.currency = "USD";
    expect(await service.search(search)).toHaveLength(0);
    expect(service.getDiagnostics()).toHaveLength(4);
    expect(service.getDiagnostics()[0]?.reasons.join(" ")).toContain("unknown");
    search.filters.minSalary.value = "";
    expect(await service.search(search)).toHaveLength(4);
    expect(service.getDiagnostics()).toEqual([]);
  });
});
