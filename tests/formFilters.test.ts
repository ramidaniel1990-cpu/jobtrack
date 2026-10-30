import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import MultiChoiceField from "../src/features/tracker/components/MultiChoiceField.vue";
import SearchFilterField from "../src/features/tracker/components/SearchFilterField.vue";
import TagInput from "../src/features/tracker/components/TagInput.vue";
import {
  addFilterValues,
  removeFilterValue,
  splitFilterValues,
} from "../src/shared/filterValues";
import {
  createSearch,
  filterDefinitions,
  multiFilterOptions,
  type MultiFilterKey,
} from "../src/shared/types";
import {
  createDemoOffers,
  evaluateOffers,
  matchesCriterion,
} from "../src/features/tracker/demoService";
import { LocalStorageAdapter } from "../src/features/tracker/persistence";

describe("multiple optional selections", () => {
  it.each<MultiFilterKey>(["experience", "modality", "employment"])(
    "allows any alternative in %s and ignores empty required selections",
    (key) => {
      const search = createSearch();
      search.filters[key] = { value: "", required: true };
      expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(4);
      search.filters[key].value = multiFilterOptions[key]
        .slice(0, 2)
        .join(", ");
      expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(
        key === "experience" ? 3 : key === "modality" ? 3 : 4,
      );
      search.filters[key].value = "No matching value";
      search.filters[key].required = false;
      expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(4);
      search.filters[key].required = true;
      expect(evaluateOffers(createDemoOffers(), search)).toHaveLength(0);
    },
  );
  it("matches Contract and Internship exactly without treating partial strings as choices", () => {
    const base = createDemoOffers()[0]!;
    for (const employment of ["Contract", "Internship"]) {
      expect(
        matchesCriterion(
          { ...base, employment },
          "employment",
          "Contract, Internship",
          "EUR",
        ),
      ).toBe(true);
    }
    expect(matchesCriterion(base, "employment", "time", "EUR")).toBe(false);
  });
  it("renders labelled checkbox groups without applying placeholder options", async () => {
    for (const key of Object.keys(multiFilterOptions) as MultiFilterKey[]) {
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(MultiChoiceField, {
              id: key,
              label: key,
              options: multiFilterOptions[key],
              modelValue: "",
            }),
        }),
      );
      expect(html.match(/type="checkbox"/g)).toHaveLength(
        multiFilterOptions[key].length,
      );
      expect(html).not.toContain(" checked");
      expect(html).toContain("<legend>");
      expect(html).toContain("None selected means no preference.");
    }
  });
  it("displays legacy selections, including custom values, without silently deleting them", async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(MultiChoiceField, {
            id: "experience",
            label: "Experience level",
            options: multiFilterOptions.experience,
            modelValue: "junior, Lead",
          }),
      }),
    );
    expect(html.match(/ checked/g)).toHaveLength(2);
    expect(html).toContain("Lead");
  });
});

describe("tag editing, salary and backwards compatibility", () => {
  it("adds comma-separated tags without blank or duplicate values and removes individual tags", () => {
    const value = addFilterValues("Vue, TypeScript", "vue, CSS, ,CSS");
    expect(splitFilterValues(value)).toEqual(["Vue", "TypeScript", "CSS"]);
    expect(removeFilterValue(value, "TypeScript")).toBe("Vue, CSS");
    expect(removeFilterValue("Vue", "Vue")).toBe("");
    expect(splitFilterValues(", ,")).toEqual([]);
  });
  it("renders removable tags with accessible names and keeps examples as placeholders", async () => {
    const render = (modelValue: string) =>
      renderToString(
        createSSRApp({
          render: () =>
            h(TagInput, {
              id: "technologies",
              label: "Technologies",
              placeholder: "Vue, TypeScript",
              modelValue,
            }),
        }),
      );
    const empty = await render("");
    expect(empty).toContain('placeholder="Vue, TypeScript"');
    expect(empty).not.toContain('role="listitem"');
    const selected = await render("Vue, CSS");
    expect(selected).toContain('aria-label="Remove Vue from technologies"');
    expect(selected).toContain('aria-label="Remove CSS from technologies"');
  });
  it("renders optional numeric gross salary with currency and no applied amount", async () => {
    const filter = filterDefinitions.find((item) => item.key === "minSalary")!;
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(SearchFilterField, {
            filter,
            modelValue: { value: "", required: false },
            currency: "EUR",
          }),
      }),
    );
    expect(html).toContain('type="number"');
    expect(html).toContain('placeholder="35000"');
    expect(html).not.toContain('value="35000"');
    expect(html).toContain("Gross annual salary before taxes");
    expect(html).toContain("Salary currency");
  });
  it("round-trips existing string criteria, custom values and decisions unchanged", () => {
    const search = createSearch();
    search.name = "Mi búsqueda";
    search.filters.experience = { value: "junior, Lead", required: true };
    search.filters.languages = { value: "Español, English", required: false };
    const data = {
      searches: [search],
      offers: [],
      decisions: { "demo-northstar-vue": "saved" as const },
    };
    let stored = JSON.stringify(data);
    const adapter = new LocalStorageAdapter({
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    });
    expect(adapter.load()).toEqual(data);
    adapter.save(adapter.load());
    expect(JSON.parse(stored)).toEqual({ ...data, schemaVersion: 2 });
  });
});
