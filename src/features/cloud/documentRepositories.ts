import {
  collection,
  doc,
  getDocsFromServer,
  serverTimestamp,
  Timestamp,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import type { JobOffer, JobSearch, OfferDecision } from "../../shared/types";
import { isAppData } from "../tracker/persistence";

export interface DecisionDocument {
  offerId: string;
  status: OfferDecision;
}
type Entity = { id: string } | DecisionDocument;
type CollectionName = "searches" | "offers" | "decisions";
const identifier = (value: string) => /^[A-Za-z0-9_-]{1,128}$/.test(value);
const entityId = (value: Entity) => ("id" in value ? value.id : value.offerId);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function cloneData<T>(value: T): T {
  // Domain records contain JSON data only; this also removes optional undefined fields.
  return JSON.parse(JSON.stringify(value)) as T;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export class UserDocumentRepository<T extends Entity> {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly name: CollectionName,
    private readonly decode: (value: unknown) => T,
  ) {
    if (!uid || uid.includes("/")) throw new Error("Invalid user identifier.");
  }

  validate(values: readonly T[]): void {
    const ids = new Set<string>();
    for (const value of values) {
      const decoded = this.decode(value);
      const id = entityId(decoded);
      if (!identifier(id) || ids.has(id))
        throw new Error("Invalid or duplicate document identifier.");
      ids.add(id);
    }
  }

  async list(): Promise<T[]> {
    const snapshot = await getDocsFromServer(
      collection(this.db, "users", this.uid, this.name),
    );
    const values = snapshot.docs.map((document) => {
      const envelope: unknown = document.data();
      if (!record(envelope) || !(envelope.updatedAt instanceof Timestamp)) {
        throw new Error("Connected data has an invalid document envelope.");
      }
      const value = this.decode(envelope.payload);
      if (entityId(value) !== document.id)
        throw new Error("Connected document identifiers do not match.");
      return value;
    });
    this.validate(values);
    return values;
  }

  appendChanges(
    batch: WriteBatch,
    previous: readonly T[],
    next: readonly T[],
  ): number {
    this.validate(next);
    const before = new Map(previous.map((value) => [entityId(value), value]));
    const after = new Map(next.map((value) => [entityId(value), value]));
    let changes = 0;
    for (const [id, value] of after) {
      if (stableJson(before.get(id)) === stableJson(value)) continue;
      batch.set(doc(this.db, "users", this.uid, this.name, id), {
        payload: cloneData(value),
        updatedAt: serverTimestamp(),
      });
      changes++;
    }
    for (const id of before.keys()) {
      if (after.has(id)) continue;
      batch.delete(doc(this.db, "users", this.uid, this.name, id));
      changes++;
    }
    return changes;
  }
}

function decodeSearch(value: unknown): JobSearch {
  const candidate = { searches: [value], offers: [], decisions: {} };
  if (!isAppData(candidate))
    throw new Error("Connected search data has an invalid format.");
  return candidate.searches[0]!;
}
function decodeOffer(value: unknown): JobOffer {
  const candidate = { searches: [], offers: [value], decisions: {} };
  if (!isAppData(candidate))
    throw new Error("Connected offer data has an invalid format.");
  return candidate.offers[0]!;
}
function decodeDecision(value: unknown): DecisionDocument {
  if (
    !record(value) ||
    typeof value.offerId !== "string" ||
    (value.status !== "saved" && value.status !== "discarded")
  ) {
    throw new Error("Connected decision data has an invalid format.");
  }
  return { offerId: value.offerId, status: value.status };
}

export class SearchRepository extends UserDocumentRepository<JobSearch> {
  constructor(db: Firestore, uid: string) {
    super(db, uid, "searches", decodeSearch);
  }
}
export class OfferRepository extends UserDocumentRepository<JobOffer> {
  constructor(db: Firestore, uid: string) {
    super(db, uid, "offers", decodeOffer);
  }
}
export class DecisionRepository extends UserDocumentRepository<DecisionDocument> {
  constructor(db: Firestore, uid: string) {
    super(db, uid, "decisions", decodeDecision);
  }
}
