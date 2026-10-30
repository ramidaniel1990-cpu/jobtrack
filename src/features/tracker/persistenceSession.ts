import { computed, ref } from "vue";
import type { AppData, PersistenceAdapter } from "../../shared/types";
import { emptyData, LocalStorageAdapter } from "./persistence";
import { localizeDemoData } from "./localizeDemoData";

type RetryAction = () => boolean | void | Promise<boolean | void>;

// Owns the lifetime of one storage identity, including unconfirmed operations.
export function usePersistenceSession() {
  const data = ref<AppData>(emptyData());
  const error = ref("");
  const success = ref("");
  const migrationNotice = ref("");
  const ready = ref(false);
  const initializing = ref(false);
  const saving = ref(false);
  const sessionKey = ref(0);
  const retryAction = ref<RetryAction>();
  const canRetry = computed(
    () => Boolean(retryAction.value) && !initializing.value && !saving.value,
  );
  let persistence: PersistenceAdapter | undefined;
  const current = (key: number) => key === sessionKey.value;

  function clearState() {
    sessionKey.value++;
    data.value = emptyData();
    error.value = "";
    success.value = "";
    migrationNotice.value = "";
    ready.value = false;
    initializing.value = false;
    saving.value = false;
    retryAction.value = undefined;
  }
  function reset() {
    const previous = persistence;
    persistence = undefined;
    clearState();
    previous?.dispose?.();
  }
  function offerRetry(action: RetryAction, key = sessionKey.value) {
    if (current(key)) retryAction.value = action;
  }
  function clearRetry() {
    retryAction.value = undefined;
  }

  function load(target: PersistenceAdapter): void | Promise<void> {
    if (persistence !== target) persistence?.dispose?.();
    persistence = target;
    clearState();
    const key = sessionKey.value;
    initializing.value = true;
    const failed = () => {
      if (!current(key)) return;
      initializing.value = false;
      error.value =
        target instanceof LocalStorageAdapter
          ? "Could not read local data. Original values have not been overwritten and may need review. Check your browser storage and retry."
          : "Could not load your stored data. Your storage mode has not changed. Check your connection and permissions, then retry.";
      offerRetry(() => load(target), key);
    };
    const loaded = (next: AppData) => {
      if (!current(key)) return;
      try {
        data.value = localizeDemoData(next);
        migrationNotice.value =
          target instanceof LocalStorageAdapter ? target.migrationNotice : "";
        ready.value = true;
        initializing.value = false;
      } catch {
        failed();
      }
    };
    try {
      const result = target.load();
      if (result instanceof Promise) return result.then(loaded, failed);
      loaded(result);
    } catch {
      failed();
    }
  }
  function init(adapter?: PersistenceAdapter): void | Promise<void> {
    if (ready.value && !adapter) return;
    try {
      return load(adapter ?? new LocalStorageAdapter());
    } catch {
      reset();
      error.value =
        "Could not read local data. Original values have not been overwritten and may need review. Check your browser storage and retry.";
      offerRetry(() => init(adapter));
    }
  }
  function commit(
    next: AppData,
    message: string,
    confirmed?: () => void,
  ): boolean | Promise<boolean> {
    if (initializing.value || saving.value || !ready.value || !persistence)
      return false;
    clearRetry();
    error.value = "";
    success.value = "";
    const key = sessionKey.value;
    const target = persistence;
    const snapshot = JSON.parse(JSON.stringify(next)) as AppData;
    const done = () => {
      if (!current(key)) return false;
      data.value = snapshot;
      saving.value = false;
      success.value = message;
      confirmed?.();
      return true;
    };
    const failed = () => {
      if (!current(key)) return false;
      saving.value = false;
      error.value =
        "Could not save changes. The previous confirmed data has been kept. Check your connection, storage space or permissions and retry.";
      offerRetry(() => commit(snapshot, message, confirmed), key);
      return false;
    };
    try {
      const result = target.save(snapshot);
      if (result instanceof Promise) {
        saving.value = true;
        return result.then(done, failed);
      }
      return done();
    } catch {
      return failed();
    }
  }
  function retry(): ReturnType<RetryAction> {
    if (!canRetry.value) return;
    const action = retryAction.value;
    clearRetry();
    return action?.();
  }
  return {
    data,
    error,
    success,
    migrationNotice,
    ready,
    initializing,
    saving,
    sessionKey,
    canRetry,
    current,
    clearRetry,
    offerRetry,
    init,
    reset,
    commit,
    retry,
  };
}
