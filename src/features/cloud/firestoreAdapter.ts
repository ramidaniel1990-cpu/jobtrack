import { writeBatch, type Firestore } from "firebase/firestore";
import type { AppData, PersistenceAdapter } from "../../shared/types";
import { emptyData, isAppData } from "../tracker/persistence";
import {
  cloneData,
  DecisionRepository,
  OfferRepository,
  SearchRepository,
} from "./documentRepositories";

export class FirestoreAdapter implements PersistenceAdapter {
  private readonly searches: SearchRepository;
  private readonly offers: OfferRepository;
  private readonly decisions: DecisionRepository;
  private baseline: AppData | undefined;
  private disposed = false;
  private saving = false;
  private generation = 0;

  constructor(
    private readonly db: Firestore,
    readonly uid: string,
    private readonly isCurrent: () => boolean = () => true,
  ) {
    this.searches = new SearchRepository(db, uid);
    this.offers = new OfferRepository(db, uid);
    this.decisions = new DecisionRepository(db, uid);
  }

  private assertActive(generation = this.generation): void {
    if (this.disposed || !this.isCurrent() || generation !== this.generation) {
      throw new DOMException(
        "This storage session is no longer active.",
        "AbortError",
      );
    }
  }

  async load(): Promise<AppData> {
    this.assertActive();
    if (this.saving)
      throw new Error(
        "Wait for the current save before reloading connected storage.",
      );
    this.baseline = undefined;
    const generation = ++this.generation;
    const [searches, offers, decisions] = await Promise.all([
      this.searches.list(),
      this.offers.list(),
      this.decisions.list(),
    ]);
    this.assertActive(generation);
    const data: AppData = {
      ...emptyData(),
      searches,
      offers,
      decisions: Object.fromEntries(
        decisions.map((value) => [value.offerId, value.status]),
      ),
      schemaVersion: 2,
    };
    if (!isAppData(data))
      throw new Error("Connected data has an invalid format.");
    this.baseline = cloneData(data);
    return cloneData(data);
  }

  async save(data: AppData): Promise<void> {
    this.assertActive();
    if (!this.baseline)
      throw new Error("Load connected storage before saving.");
    if (this.saving)
      throw new Error("A connected save is already in progress.");
    if (!isAppData(data))
      throw new Error("Cannot save invalid connected data.");
    const next = cloneData(data);
    const generation = this.generation;
    this.saving = true;
    try {
      const batch = writeBatch(this.db);
      const changes =
        this.searches.appendChanges(
          batch,
          this.baseline.searches,
          next.searches,
        ) +
        this.offers.appendChanges(batch, this.baseline.offers, next.offers) +
        this.decisions.appendChanges(
          batch,
          Object.entries(this.baseline.decisions).map(([offerId, status]) => ({
            offerId,
            status,
          })),
          Object.entries(next.decisions).map(([offerId, status]) => ({
            offerId,
            status,
          })),
        );
      if (changes > 450)
        throw new Error(
          "Too many changes for one confirmed save. Use smaller updates.",
        );
      this.assertActive(generation);
      if (changes) await batch.commit();
      this.assertActive(generation);
      this.baseline = next;
    } finally {
      this.saving = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.baseline = undefined;
  }
}
