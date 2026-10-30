import type { JobSearch, Schedule } from "./types";
import { filterDefinitions } from "./types";
import { splitFilterValues } from "./filterValues";

export function isValidNonNegativeNumber(
  value: string,
  integer = false,
): boolean {
  const raw = value.trim();
  if (!raw) return true;
  const number = Number(raw);
  return (
    /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) &&
    Number.isFinite(number) &&
    number >= 0 &&
    (!integer || Number.isInteger(number))
  );
}

export function validateSchedule(schedule: Schedule): string[] {
  if (schedule.frequency === "manual") return [];
  if (schedule.frequency !== "daily" && schedule.frequency !== "weekly") {
    return [
      "The saved frequency needs review. Choose Manual, Daily or Weekly.",
    ];
  }
  const errors: string[] = [];
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time))
    errors.push("Enter a valid local time in HH:mm format.");
  try {
    if (
      !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(schedule.timezone) ||
      schedule.timezone.length > 100
    )
      throw new Error("Invalid IANA time zone");
    new Intl.DateTimeFormat("en-GB", { timeZone: schedule.timezone });
  } catch {
    errors.push("Enter a valid time zone, such as Europe/Madrid.");
  }
  if (schedule.frequency === "weekly" && !/^[1-7]$/.test(schedule.weekday))
    errors.push("Choose a valid day of the week.");
  return errors;
}

export function validateSearch(search: JobSearch): string[] {
  const errors: string[] = [];
  if (!search.name.trim()) errors.push("Enter a name for your search.");
  if (search.name.trim().length > 80)
    errors.push("Search names must contain at most 80 characters.");
  if (!/^[A-Z]{3}$/.test(search.currency))
    errors.push("Choose a valid three-letter salary currency.");
  for (const { key, label } of filterDefinitions) {
    if (search.filters[key].value.length > 1000)
      errors.push(`${label} must contain at most 1,000 characters.`);
  }
  for (const key of ["technologies", "languages"] as const) {
    const tags = splitFilterValues(search.filters[key].value);
    if (tags.length > 20 || tags.some((tag) => tag.length > 128))
      errors.push(
        `${key === "technologies" ? "Technologies" : "Languages"} allow up to 20 tags of 128 characters each.`,
      );
  }
  if (!isValidNonNegativeNumber(search.filters.minSalary.value))
    errors.push(
      "Minimum annual salary must be a finite number of zero or more.",
    );
  if (!isValidNonNegativeNumber(search.filters.maxAgeDays.value, true))
    errors.push("Maximum listing age must be a whole number of zero or more.");
  if (Number(search.filters.minSalary.value) > 1_000_000_000)
    errors.push("Minimum annual salary must not exceed 1,000,000,000.");
  if (Number(search.filters.maxAgeDays.value) > 36500)
    errors.push("Maximum listing age must not exceed 36,500 days.");
  return [...errors, ...validateSchedule(search.schedule)];
}
