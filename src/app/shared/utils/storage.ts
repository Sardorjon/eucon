/** localStorage access that never throws (private mode, disabled storage, quota exceeded). */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStorage(key: string, store: Storage | null = storage()): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string, store: Storage | null = storage()): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* preferences are a convenience, never an error */
  }
}
