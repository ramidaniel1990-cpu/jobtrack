import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createSearch, filterDefinitions } from "../src/shared/types";
import {
  createDemoOffers,
  evaluateOffers,
} from "../src/features/tracker/demoService";
import { localizeDemoData } from "../src/features/tracker/localizeDemoData";
import { validationMessage } from "../src/shared/formValidation";

describe("English interface standard", () => {
  it("uses English labels, demo values and match explanations", () => {
    expect(
      filterDefinitions.find((item) => item.key === "modality")?.placeholder,
    ).toBe("Remote, Hybrid, On-site");
    const search = createSearch();
    search.filters.modality = { value: "Remote", required: true };
    const offers = evaluateOffers(createDemoOffers(), search);
    expect(offers).toHaveLength(2);
    expect(
      offers.every((offer) =>
        offer.explanation.startsWith("Simulated assessment."),
      ),
    ).toBe(true);
    expect(offers[0]?.languages).toContain("English");
  });
  it("refreshes legacy demo text without changing user input, decisions or external offers", () => {
    const search = createSearch();
    search.name = "Mi búsqueda personal";
    search.filters.location.value = "España";
    const sample = {
      ...createDemoOffers()[0]!,
      modality: "Remoto",
      description: "Empresa ficticia.",
      explanation: "Valoración simulada.",
      searchIds: [search.id],
    };
    const external = {
      ...sample,
      id: "external-1",
      title: "Oferta original",
      company: "Nombre propio",
    };
    const data = {
      searches: [search],
      offers: [sample, external],
      decisions: { [sample.id]: "saved" as const },
    };
    const result = localizeDemoData(data);
    expect(result.searches).toBe(data.searches);
    expect(result.searches[0]?.name).toBe("Mi búsqueda personal");
    expect(result.searches[0]?.filters.location.value).toBe("España");
    expect(result.decisions).toBe(data.decisions);
    expect(result.offers[1]).toBe(external);
    expect(result.offers[0]?.modality).toBe("Remote");
    expect(result.offers[0]?.publishedAt).toBe(sample.publishedAt);
    expect(result.offers[0]?.explanation).toContain(
      "Unmatched preferences: country or city",
    );
  });
  it("provides English validation independent of browser language", () => {
    expect(validationMessage({ valueMissing: true } as ValidityState, "")).toBe(
      "Please fill in this field.",
    );
    expect(
      validationMessage({ rangeUnderflow: true } as ValidityState, "1"),
    ).toBe("Enter a value of at least 1.");
  });
  it("has no remaining Spanish interface literals or Spanish formatters in application sources", () => {
    function sources(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? sources(join(directory, entry.name))
          : /\.(ts|vue)$/.test(entry.name)
            ? [join(directory, entry.name)]
            : [],
      );
    }
    for (const file of [...sources("src"), "index.html"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(
        /búsqueda|oferta|guardad[ao]|descartad[ao]|simulada|Imprescindible|EXPLORA|es-ES|lang="es"/i,
      );
    }
    expect(readFileSync("index.html", "utf8")).toContain('lang="en-GB"');
  });
});
