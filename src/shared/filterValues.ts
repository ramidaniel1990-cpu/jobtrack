export function splitFilterValues(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase("en-GB");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function addFilterValues(value: string, added: string): string {
  return splitFilterValues(`${value},${added}`).join(", ");
}

export function removeFilterValue(value: string, removed: string): string {
  return splitFilterValues(value)
    .filter((item) => item !== removed)
    .join(", ");
}
