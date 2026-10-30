import { describe, expect, it } from "vitest";
import { createSearch } from "../src/shared/types";
import {
  isValidNonNegativeNumber,
  validateSchedule,
  validateSearch,
} from "../src/shared/searchValidation";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import SearchFilterField from "../src/features/tracker/components/SearchFilterField.vue";
import { filterDefinitions } from "../src/shared/types";

describe("search and schedule validation", () => {
  it("enforces the server limits before a remote save", () => {
    const search = createSearch();
    search.name = "Bounded search";
    search.filters.minSalary.value = "1000000001";
    search.filters.maxAgeDays.value = "36501";
    expect(validateSearch(search).join(" ")).toContain("1,000,000,000");
    expect(validateSearch(search).join(" ")).toContain("36,500");
    search.filters.minSalary.value = "50000.50";
    search.filters.maxAgeDays.value = "1e1";
    expect(validateSearch(search)).toEqual([]);
  });
  it("allows empty numeric criteria and zero values", () => {
    const search = createSearch();
    search.name = "Open search";
    expect(validateSearch(search)).toEqual([]);
    search.filters.minSalary.value = "0";
    search.filters.maxAgeDays.value = "0";
    expect(validateSearch(search)).toEqual([]);
  });
  it.each(["-1", "NaN", "Infinity", "0x20", "1,000", "not a number"])(
    "rejects invalid or negative salary %s without changing it",
    (value) => {
      const search = createSearch();
      search.name = "Legacy";
      search.filters.minSalary.value = value;
      expect(
        validateSearch(search).some((message) => message.includes("salary")),
      ).toBe(true);
      expect(search.filters.minSalary.value).toBe(value);
    },
  );
  it("accepts finite decimal salaries but requires whole listing ages", () => {
    expect(isValidNonNegativeNumber("35000.50")).toBe(true);
    expect(isValidNonNegativeNumber("1.5", true)).toBe(false);
    expect(isValidNonNegativeNumber("1e999")).toBe(false);
  });
  it("ignores hidden schedule fields for Manual and the weekday for Daily", () => {
    const schedule = {
      frequency: "manual" as const,
      time: "invalid",
      timezone: "invalid",
      weekday: "invalid",
    };
    expect(validateSchedule(schedule)).toEqual([]);
    expect(
      validateSchedule({
        ...schedule,
        frequency: "daily",
        time: "09:30",
        timezone: "Europe/Berlin",
      }),
    ).toEqual([]);
  });
  it("validates initial saved time zones, time and weekly weekdays", () => {
    const schedule = {
      frequency: "weekly" as const,
      time: "25:01",
      timezone: "Unknown/Zone",
      weekday: "8",
    };
    expect(validateSchedule(schedule)).toHaveLength(3);
    expect(
      validateSchedule({
        ...schedule,
        time: "09:30",
        timezone: "Europe/Berlin",
        weekday: "1",
      }),
    ).toEqual([]);
  });
  it("removes Required from exclusions and listing age and exposes invalid legacy values", async () => {
    for (const key of ["excludedWords", "maxAgeDays"] as const) {
      const html = await renderToString(
        createSSRApp({
          render: () =>
            h(SearchFilterField, {
              filter: filterDefinitions.find((item) => item.key === key)!,
              modelValue: {
                value: key === "maxAgeDays" ? "unknown" : "PHP",
                required: true,
              },
              currency: "EUR",
            }),
        }),
      );
      expect(html).not.toContain('type="checkbox"');
      if (key === "maxAgeDays") {
        expect(html).toContain("unknown");
        expect(html).toContain("needs review");
        expect(html).toContain('min="0"');
      }
    }
  });
});
