import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  setLogLevel,
} from "firebase/firestore";
// Rejected writes are expected; Vitest still reports unexpected Firebase errors.
setLogLevel("silent");
import { createSearch } from "../../src/shared/types";
import { createDemoOffers } from "../../src/features/tracker/demoService";

const projectId = "demo-jobtrack";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
  throw new Error(
    "Rules tests require an explicitly configured loopback FIRESTORE_EMULATOR_HOST. No production connection is allowed.",
  );
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)
  throw new Error("Rules tests only support demo-jobtrack.");
let environment: RulesTestEnvironment;
const search = () => ({
  ...createSearch(),
  id: "search-one",
  name: "Frontend radar",
});
const offer = () => createDemoOffers()[0]!;
const envelope = (payload: unknown) => ({
  payload,
  updatedAt: serverTimestamp(),
});

describe("Firestore ownership and validation rules on the local emulator", () => {
  beforeAll(async () => {
    const [hostname, port] = host.split(":");
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: hostname,
        port: Number(port),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });
  beforeEach(async () => environment.clearFirestore());
  afterAll(async () => environment?.cleanup());

  it("allows user A to create, list, read, update and delete their own typed documents", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const payloads = {
      searches: search(),
      offers: offer(),
      decisions: { offerId: offer().id, status: "saved" },
    };
    for (const [name, payload] of Object.entries(payloads)) {
      const id = name === "searches" ? search().id : offer().id;
      const reference = doc(db, "users", "user-a", name, id);
      await assertSucceeds(setDoc(reference, envelope(payload)));
      expect((await assertSucceeds(getDoc(reference))).exists()).toBe(true);
      expect(
        (await assertSucceeds(getDocs(collection(db, "users", "user-a", name))))
          .size,
      ).toBe(1);
      await assertSucceeds(setDoc(reference, envelope(payload)));
      await assertSucceeds(deleteDoc(reference));
    }
  });
  it("rejects A reading, listing, creating, updating or deleting B's documents", async () => {
    const alice = environment.authenticatedContext("user-a").firestore();
    const bob = environment.authenticatedContext("user-b").firestore();
    for (const [name, payload, id] of [
      ["searches", search(), search().id],
      ["offers", offer(), offer().id],
      ["decisions", { offerId: offer().id, status: "saved" }, offer().id],
    ] as const) {
      await assertSucceeds(
        setDoc(doc(bob, "users", "user-b", name, id), envelope(payload)),
      );
      const forbidden = doc(alice, "users", "user-b", name, id);
      await assertFails(getDoc(forbidden));
      await assertFails(getDocs(collection(alice, "users", "user-b", name)));
      await assertFails(
        setDoc(
          doc(alice, "users", "user-b", name, "new-id"),
          envelope(payload),
        ),
      );
      await assertFails(setDoc(forbidden, envelope(payload)));
      await assertFails(deleteDoc(forbidden));
    }
  });
  it("rejects unauthenticated access and denies paths outside the three private collections", async () => {
    const db = environment.unauthenticatedContext().firestore();
    for (const name of ["searches", "offers", "decisions"]) {
      const reference = doc(db, "users", "user-a", name, "private");
      await assertFails(getDoc(reference));
      await assertFails(getDocs(collection(db, "users", "user-a", name)));
      await assertFails(setDoc(reference, envelope(search())));
      await assertFails(deleteDoc(reference));
    }
    const alice = environment.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(alice, "users", "user-a"), { profile: true }));
    await assertFails(
      setDoc(doc(alice, "public", "anything"), { public: true }),
    );
    await assertFails(getDocs(collection(alice, "public")));
  });
  it("rejects invalid search shapes, nested types, names, ids, numeric filters and schedules", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const base = search();
    const invalid = [
      { ...base, extra: true },
      { ...base, name: "x".repeat(81) },
      { ...base, name: "   " },
      { ...base, id: "different" },
      {
        ...base,
        filters: {
          ...base.filters,
          keywords: { value: "Vue", required: "yes" },
        },
      },
      {
        ...base,
        filters: {
          ...base.filters,
          keywords: { value: "Vue", required: true, hidden: true },
        },
      },
      {
        ...base,
        filters: {
          ...base.filters,
          minSalary: { value: "-1", required: false },
        },
      },
      {
        ...base,
        filters: {
          ...base.filters,
          minSalary: { value: "1e99", required: false },
        },
      },
      {
        ...base,
        filters: {
          ...base.filters,
          maxAgeDays: { value: "1.5", required: false },
        },
      },
      {
        ...base,
        schedule: { ...base.schedule, frequency: "weekly", weekday: "8" },
      },
      {
        ...base,
        schedule: { ...base.schedule, frequency: "daily", time: "25:00" },
      },
    ];
    for (const payload of invalid)
      await assertFails(
        setDoc(
          doc(db, "users", "user-a", "searches", base.id),
          envelope(payload),
        ),
      );
  });
  it("rejects negative salaries, bad array elements, excessive arrays, bad scores and extra fields", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const base = offer();
    const invalid = [
      { ...base, salary: -1 },
      { ...base, salary: "40000" },
      { ...base, salary: Number.POSITIVE_INFINITY },
      { ...base, technologies: ["Vue", 42] },
      { ...base, languages: Array(21).fill("English") },
      { ...base, searchIds: [...Array(19).fill("one"), false] },
      { ...base, score: 101 },
      { ...base, privateKey: "forbidden" },
    ];
    for (const payload of invalid)
      await assertFails(
        setDoc(
          doc(db, "users", "user-a", "offers", base.id),
          envelope(payload),
        ),
      );
  });
  it("accepts all twenty valid entries in each offer list within the evaluation budget", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const base = offer();
    const payload = {
      ...base,
      technologies: Array(20).fill("v".repeat(128)),
      languages: Array(20).fill("English"),
      searchIds: Array.from({ length: 20 }, (_, index) => `search-${index}`),
    };
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "offers", base.id), envelope(payload)),
    );
    for (const key of ["technologies", "languages", "searchIds"] as const) {
      for (const invalid of [42, false, null, {}, Timestamp.fromMillis(0)]) {
        const invalidType = {
          ...payload,
          [key]: [...payload[key].slice(0, 19), invalid],
        };
        await assertFails(
          setDoc(
            doc(db, "users", "user-a", "offers", base.id),
            envelope(invalidType),
          ),
        );
      }
      for (const invalidList of [null, {}, 42, "Vue"]) {
        await assertFails(
          setDoc(
            doc(db, "users", "user-a", "offers", base.id),
            envelope({ ...payload, [key]: invalidList }),
          ),
        );
      }
      const invalidLength = {
        ...payload,
        [key]: [...payload[key].slice(0, 19), "x".repeat(129)],
      };
      await assertFails(
        setDoc(
          doc(db, "users", "user-a", "offers", base.id),
          envelope(invalidLength),
        ),
      );
    }
    await assertSucceeds(
      setDoc(
        doc(db, "users", "user-a", "offers", base.id),
        envelope({
          ...payload,
          technologies: Array(20).fill(`${"é".repeat(127)}\n`),
        }),
      ),
    );
  });
  it("accepts a fully configured search at the supported numeric limits", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const base = search();
    for (const key of Object.keys(
      base.filters,
    ) as (keyof typeof base.filters)[]) {
      base.filters[key] = { value: "Vue", required: true };
    }
    base.filters.minSalary.value = "1000000000";
    base.filters.maxAgeDays.value = "36500";
    base.schedule = {
      frequency: "weekly",
      time: "23:59",
      timezone: "Europe/Berlin",
      weekday: "7",
    };
    await assertSucceeds(
      setDoc(doc(db, "users", "user-a", "searches", base.id), envelope(base)),
    );
  });
  it("rejects malformed decisions and requires a server-confirmed updatedAt timestamp", async () => {
    const db = environment.authenticatedContext("user-a").firestore();
    const reference = doc(db, "users", "user-a", "decisions", offer().id);
    await assertFails(
      setDoc(reference, envelope({ offerId: offer().id, status: "applied" })),
    );
    await assertFails(
      setDoc(reference, envelope({ offerId: "other", status: "saved" })),
    );
    await assertFails(
      setDoc(
        reference,
        envelope({ offerId: offer().id, status: "saved", admin: true }),
      ),
    );
    await assertFails(
      setDoc(reference, {
        payload: { offerId: offer().id, status: "saved" },
        updatedAt: Timestamp.fromMillis(0),
      }),
    );
    await assertFails(
      setDoc(reference, {
        payload: { offerId: offer().id, status: "saved" },
        updatedAt: "now",
      }),
    );
    await assertFails(
      setDoc(reference, {
        ...envelope({ offerId: offer().id, status: "saved" }),
        admin: true,
      }),
    );
  });
});
