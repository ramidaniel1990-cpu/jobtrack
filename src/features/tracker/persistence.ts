import type { AppData, PersistenceAdapter } from "../../shared/types";
import { filterDefinitions } from "../../shared/types";
import { migrateStoredData } from "./migration";

export const storageKey = "jobtrack:v1";
export const emptyData = (): AppData => ({
  searches: [],
  offers: [],
  decisions: {},
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
function validSearch(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.filters) || !isObject(value.schedule))
    return false;
  const filters = value.filters;
  return (
    ["id", "name", "currency", "createdAt"].every(
      (key) => typeof value[key] === "string",
    ) &&
    typeof value.paused === "boolean" &&
    filterDefinitions.every(
      ({ key }) =>
        isObject(filters[key]) &&
        typeof filters[key].value === "string" &&
        typeof filters[key].required === "boolean",
    ) &&
    typeof value.schedule.frequency === "string" &&
    ["time", "timezone", "weekday"].every(
      (key) =>
        typeof (value.schedule as Record<string, unknown>)[key] === "string",
    )
  );
}
function validOffer(value: unknown): boolean {
  return (
    isObject(value) &&
    [
      "id",
      "title",
      "company",
      "location",
      "modality",
      "experience",
      "employment",
      "currency",
      "publishedAt",
      "description",
      "explanation",
    ].every((key) => typeof value[key] === "string") &&
    strings(value.technologies) &&
    strings(value.languages) &&
    strings(value.searchIds) &&
    typeof value.score === "number" &&
    (value.salary === undefined || typeof value.salary === "number")
  );
}
export function isAppData(value: unknown): value is AppData {
  return (
    isObject(value) &&
    (value.schemaVersion === undefined || value.schemaVersion === 2) &&
    Array.isArray(value.searches) &&
    value.searches.every(validSearch) &&
    Array.isArray(value.offers) &&
    value.offers.every(validOffer) &&
    isObject(value.decisions) &&
    Object.values(value.decisions).every(
      (item) => item === "saved" || item === "discarded",
    )
  );
}
export class LocalStorageAdapter implements PersistenceAdapter {
  migrationNotice = "";
  constructor(
    private readonly storage: Pick<
      Storage,
      "getItem" | "setItem"
    > = window.localStorage,
  ) {}
  load(): AppData {
    this.migrationNotice = "";
    const raw = this.storage.getItem(storageKey);
    if (!raw) return emptyData();
    const original: unknown = JSON.parse(raw);
    const parsed = migrateStoredData(original);
    if (!isAppData(parsed))
      throw new Error(
        "Stored data has an invalid format. Original values were retained and need review.",
      );
    this.migrationNotice =
      isObject(original) && original.schemaVersion === undefined
        ? "Existing searches were preserved. Filter rules have changed: excluded words and maximum listing age now always apply. Review your searches before running them."
        : "";
    return parsed;
  }
  save(data: AppData): void {
    this.storage.setItem(
      storageKey,
      JSON.stringify({ ...data, schemaVersion: 2 }),
    );
  }
}
