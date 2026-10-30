export type FilterKey =
  | "keywords"
  | "technologies"
  | "experience"
  | "location"
  | "modality"
  | "employment"
  | "languages"
  | "minSalary"
  | "maxAgeDays"
  | "excludedWords";
export interface Criterion {
  // Comma-separated alternatives keep existing localStorage records compatible.
  value: string;
  required: boolean;
}
export type SearchFilters = Record<FilterKey, Criterion>;
export interface Schedule {
  frequency: "manual" | "daily" | "weekly";
  time: string;
  timezone: string;
  weekday: string;
}
export interface JobSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  currency: string;
  schedule: Schedule;
  paused: boolean;
  createdAt: string;
  lastRunAt?: string;
}
export interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: string;
  technologies: string[];
  experience: string;
  employment: string;
  languages: string[];
  salary?: number;
  currency: string;
  publishedAt: string;
  description: string;
  explanation: string;
  score: number;
  searchIds: string[];
}
export type OfferDecision = "saved" | "discarded";
export interface AppData {
  searches: JobSearch[];
  offers: JobOffer[];
  decisions: Record<string, OfferDecision>;
  schemaVersion?: 2;
}
export interface SearchDiagnostic {
  offerId: string;
  title: string;
  reasons: string[];
}
export interface PersistenceAdapter {
  load(): AppData | Promise<AppData>;
  save(data: AppData): void | Promise<void>;
  dispose?(): void;
}
export interface JobSearchService {
  search(search: JobSearch): Promise<JobOffer[]>;
  getDiagnostics?(): SearchDiagnostic[];
}
export type MultiFilterKey = "experience" | "modality" | "employment";
export const multiFilterOptions = {
  experience: ["Junior", "Mid", "Senior"],
  modality: ["Remote", "Hybrid", "On-site"],
  employment: ["Full-time", "Part-time", "Contract", "Internship"],
} as const satisfies Record<MultiFilterKey, readonly string[]>;
export type ExperienceLevel = (typeof multiFilterOptions.experience)[number];
export type WorkArrangement = (typeof multiFilterOptions.modality)[number];
export type EmploymentType = (typeof multiFilterOptions.employment)[number];
export interface FilterDefinition {
  key: FilterKey;
  label: string;
  placeholder: string;
}
export const filterDefinitions: FilterDefinition[] = [
  {
    key: "keywords",
    label: "Job title or keywords",
    placeholder: "Frontend developer",
  },
  {
    key: "technologies",
    label: "Technologies",
    placeholder: "Vue, TypeScript",
  },
  {
    key: "experience",
    label: "Experience level",
    placeholder: "Junior, Mid, Senior",
  },
  { key: "location", label: "Country or city", placeholder: "Spain, Madrid" },
  {
    key: "modality",
    label: "Work arrangement",
    placeholder: "Remote, Hybrid, On-site",
  },
  {
    key: "employment",
    label: "Employment type",
    placeholder: "Full-time, Part-time, Contract, Internship",
  },
  { key: "languages", label: "Languages", placeholder: "Spanish, English" },
  { key: "minSalary", label: "Minimum annual salary", placeholder: "35000" },
  { key: "maxAgeDays", label: "Maximum listing age (days)", placeholder: "30" },
  {
    key: "excludedWords",
    label: "Excluded words",
    placeholder: "Internship, PHP",
  },
];
export function createSearch(): JobSearch {
  return {
    id: crypto.randomUUID(),
    name: "",
    filters: Object.fromEntries(
      filterDefinitions.map(({ key }) => [key, { value: "", required: false }]),
    ) as SearchFilters,
    currency: "EUR",
    schedule: {
      frequency: "manual",
      time: "09:00",
      timezone: "Europe/Berlin",
      weekday: "1",
    },
    paused: false,
    createdAt: new Date().toISOString(),
  };
}
