import type {
  FilterKey,
  JobOffer,
  JobSearch,
  JobSearchService,
  SearchDiagnostic,
} from "../../shared/types";
import { assessCriterion, assessOffers } from "./filterEvaluation";
export { assessCriterion, assessOffer, assessOffers } from "./filterEvaluation";

export function matchesCriterion(
  offer: JobOffer,
  key: FilterKey,
  value: string,
  currency: string,
  now = Date.now(),
): boolean {
  return assessCriterion(offer, key, value, currency, now).status === "matched";
}

export function evaluateOffers(
  offers: JobOffer[],
  search: JobSearch,
): JobOffer[] {
  return assessOffers(offers, search)
    .filter((item) => item.eligible)
    .map((item) => item.offer)
    .sort((a, b) => b.score - a.score);
}

export function createDemoOffers(): JobOffer[] {
  const today = new Date();
  const date = (days: number) =>
    new Date(today.getTime() - days * 86400000).toISOString();
  const base = {
    currency: "EUR",
    employment: "Full-time",
    explanation: "Simulated assessment.",
    score: 0,
    searchIds: [],
  };
  return [
    {
      ...base,
      id: "demo-northstar-vue",
      title: "Frontend Developer · Vue",
      company: "Northstar Studio",
      location: "Madrid, Spain",
      modality: "Remote",
      technologies: ["Vue", "TypeScript", "Tailwind CSS"],
      experience: "Mid",
      languages: ["Spanish", "English"],
      salary: 44000,
      publishedAt: date(2),
      description:
        "Fictional company. Build accessible interfaces and component systems with Vue and TypeScript.",
    },
    {
      ...base,
      id: "demo-orbit-product",
      title: "Product Engineer",
      company: "Orbit Labs",
      location: "Berlin, Germany",
      modality: "Hybrid",
      technologies: ["React", "TypeScript", "Node.js"],
      experience: "Senior",
      languages: ["English"],
      salary: 68000,
      publishedAt: date(5),
      description:
        "Fictional company. Work with product and design on tools for distributed teams.",
    },
    {
      ...base,
      id: "demo-verde-junior",
      title: "Junior Frontend Developer",
      company: "Verde Digital",
      location: "Barcelona, Spain",
      modality: "On-site",
      technologies: ["Vue", "JavaScript", "CSS"],
      experience: "Junior",
      languages: ["Spanish"],
      salary: 28000,
      publishedAt: date(10),
      description:
        "Fictional company. Develop web experiences with support from a frontend team.",
    },
    {
      ...base,
      id: "demo-lumen-ui",
      title: "UI Developer",
      company: "Lumen Collective",
      location: "Valencia, Spain",
      modality: "Remote",
      technologies: ["Vue", "TypeScript", "Figma"],
      experience: "Mid",
      employment: "Part-time",
      languages: ["Spanish", "English"],
      publishedAt: date(1),
      description:
        "Fictional company. Turn designs into reusable interfaces. Salary not listed.",
    },
  ];
}

export class DemoJobSearchService implements JobSearchService {
  private diagnostics: SearchDiagnostic[] = [];
  constructor(private readonly delay = 650) {}
  async search(search: JobSearch): Promise<JobOffer[]> {
    await new Promise((resolve) => setTimeout(resolve, this.delay));
    const assessments = assessOffers(createDemoOffers(), search);
    this.diagnostics = assessments
      .filter((item) => !item.eligible)
      .map((item) => ({
        offerId: item.offer.id,
        title: item.offer.title,
        reasons: item.reasons,
      }));
    return assessments
      .filter((item) => item.eligible)
      .map((item) => item.offer)
      .sort((a, b) => b.score - a.score);
  }
  getDiagnostics(): SearchDiagnostic[] {
    return this.diagnostics.map((item) => ({
      ...item,
      reasons: [...item.reasons],
    }));
  }
}

export function mergeOffers(
  existing: JobOffer[],
  incoming: JobOffer[],
): JobOffer[] {
  const merged = new Map(existing.map((offer) => [offer.id, offer]));
  for (const offer of incoming) {
    const previous = merged.get(offer.id);
    merged.set(offer.id, {
      ...offer,
      searchIds: [
        ...new Set([...(previous?.searchIds ?? []), ...offer.searchIds]),
      ],
    });
  }
  return [...merged.values()];
}
