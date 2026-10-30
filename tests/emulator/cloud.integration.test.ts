import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  signInWithCredential,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  initializeFirestore,
  memoryLocalCache,
  terminate,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { FirestoreAdapter } from "../../src/features/cloud/firestoreAdapter";
import { createSearch } from "../../src/shared/types";
import {
  createDemoOffers,
  mergeOffers,
} from "../../src/features/tracker/demoService";

// The suite cannot initialise an SDK until both explicit loopback endpoints are present.
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const enabled = process.env.JOBTRACK_EMULATOR_TESTS === "true";
function endpoint(value: string | undefined, expectedPort: number): string {
  const address = value ?? "";
  if (
    address !== `127.0.0.1:${expectedPort}` &&
    address !== `localhost:${expectedPort}`
  ) {
    throw new Error(
      "Emulator integration tests require the documented loopback endpoints.",
    );
  }
  return address;
}
const emulatorSuite = enabled ? describe : describe.skip;

emulatorSuite("real Auth and Firestore emulator persistence", () => {
  let app: FirebaseApp;
  let auth: Auth;
  let db: Firestore;
  let uid = "";
  beforeAll(async () => {
    endpoint(authHost, 9099);
    endpoint(firestoreHost, 8080);
    app = initializeApp(
      {
        projectId: "demo-jobtrack",
        apiKey: "demo-key",
        authDomain: "demo-jobtrack.firebaseapp.com",
      },
      `repository-${crypto.randomUUID()}`,
    );
    auth = initializeAuth(app, { persistence: inMemoryPersistence });
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
    const [host, port] = firestoreHost!.split(":");
    connectFirestoreEmulator(db, host!, Number(port));
    // Official non-interactive Auth Emulator IDP flow; no real Google credentials.
    const credential = GoogleAuthProvider.credential(
      JSON.stringify({
        sub: `jobtrack-${crypto.randomUUID()}`,
        email: "emulator-user@example.test",
        email_verified: true,
      }),
    );
    uid = (await signInWithCredential(auth, credential)).user.uid;
  }, 20000);
  afterAll(async () => {
    if (auth) await signOut(auth);
    if (db) await terminate(db);
    if (app) await deleteApp(app);
  });

  it("creates, searches, saves, reloads, edits, pauses and restores without duplicating offers", async () => {
    const adapter = new FirestoreAdapter(
      db,
      uid,
      () => auth.currentUser?.uid === uid,
    );
    const data = await adapter.load();
    expect(data.searches).toEqual([]);
    expect(data.offers).toEqual([]); // No demo/localStorage data is imported.
    const search = createSearch();
    search.name = "Authenticated emulator search";
    data.searches.push(search);
    await adapter.save(data);
    const searchDocument = await getDocFromServer(
      doc(db, "users", uid, "searches", search.id),
    );
    expect(searchDocument.data()?.updatedAt).toBeInstanceOf(Timestamp);
    const savedTimestamp = searchDocument.data()?.updatedAt as Timestamp;
    await adapter.save(data);
    const unchanged = await getDocFromServer(
      doc(db, "users", uid, "searches", search.id),
    );
    expect(
      (unchanged.data()?.updatedAt as Timestamp).isEqual(savedTimestamp),
    ).toBe(true);

    const offers = createDemoOffers().map((offer) => ({
      ...offer,
      searchIds: [search.id],
    }));
    data.offers = mergeOffers(data.offers, offers);
    const offerId = data.offers[0]!.id;
    data.decisions[offerId] = "saved";
    await adapter.save(data);
    data.offers = mergeOffers(data.offers, offers);
    search.name = "Edited and paused";
    search.paused = true;
    data.decisions[offerId] = "discarded";
    await adapter.save(data);
    delete data.decisions[offerId];
    await adapter.save(data);
    data.decisions[offerId] = "saved";
    await adapter.save(data);
    adapter.dispose();
    const restored = new FirestoreAdapter(db, uid);
    const loaded = await restored.load();
    expect(loaded.searches[0]?.name).toBe("Edited and paused");
    expect(loaded.searches[0]?.paused).toBe(true);
    expect(loaded.offers).toHaveLength(4);
    expect(loaded.decisions[offerId]).toBe("saved");
    loaded.searches = [];
    await restored.save(loaded);
    expect((await restored.load()).searches).toEqual([]);
    restored.dispose();
  }, 30000);

  it("rejects operations after session disposal or user change", async () => {
    let current = true;
    const adapter = new FirestoreAdapter(db, uid, () => current);
    await adapter.load();
    current = false;
    await expect(adapter.load()).rejects.toMatchObject({ name: "AbortError" });
    current = true;
    adapter.dispose();
    await expect(
      adapter.save({ searches: [], offers: [], decisions: {} }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
