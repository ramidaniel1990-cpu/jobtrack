// Convert only known legacy representations; leave unknown values intact for validation.
export function migrateStoredData(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.searches)) return value;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 2)
    return value;
  return {
    ...value,
    searches: value.searches.map((search) => {
      if (!isRecord(search) || !isRecord(search.filters)) return search;
      return {
        ...search,
        filters: Object.fromEntries(
          Object.entries(search.filters).map(([key, criterion]) => {
            if (!isRecord(criterion)) return [key, criterion];
            const raw = criterion.value;
            const converted =
              typeof raw === "number" && Number.isFinite(raw)
                ? String(raw)
                : Array.isArray(raw) &&
                    raw.every((item) => typeof item === "string")
                  ? raw.join(", ")
                  : raw;
            return [key, { ...criterion, value: converted }];
          }),
        ),
      };
    }),
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
