import type { CanvasSnapshot } from "./drawingsApi";

const DB_NAME = "myboard-local";
const DB_VERSION = 1;
const STORE_SNAPSHOTS = "canvas_snapshots";

export type LocalCanvasSnapshotRow = {
  id: string;
  snapshot: CanvasSnapshot;
  updatedAt: number;
  pendingSync: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function putLocalCanvasSnapshot(
  id: string,
  snapshot: CanvasSnapshot,
  pendingSync: boolean,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
    tx.objectStore(STORE_SNAPSHOTS).put({
      id,
      snapshot,
      updatedAt: Date.now(),
      pendingSync,
    } satisfies LocalCanvasSnapshotRow);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put failed"));
  });
  db.close();
}

export async function getLocalCanvasSnapshot(
  id: string,
): Promise<LocalCanvasSnapshotRow | null> {
  const db = await openDb();
  const row = await new Promise<LocalCanvasSnapshotRow | null>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, "readonly");
    const req = tx.objectStore(STORE_SNAPSHOTS).get(id);
    req.onsuccess = () => resolve((req.result as LocalCanvasSnapshotRow | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
  db.close();
  return row;
}
