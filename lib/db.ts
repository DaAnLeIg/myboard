import Dexie, { type Table } from "dexie";
import { supabase } from "../utils/supabaseClient";

export type ProjectRow = {
  id: string;
  name?: string;
  updated_at: string;
};

export type SyncStatus = "synced" | "pending";

/** Local-First строка: весь fabric-объект в `fabric_json`, `id` = `drawing_id:object_id` как в Supabase. */
export interface CanvasObject {
  id: string;
  drawing_id: string;
  object_id: string;
  layer: "img" | "text" | "draw";
  fabric_json: Record<string, unknown>;
  last_updated: number;
  sync_status: SyncStatus;
}

class MyBoardDatabase extends Dexie {
  projects!: Table<ProjectRow, string>;
  canvas_objects!: Table<CanvasObject, string>;

  constructor() {
    super("MyBoardDB");
    this.version(1).stores({
      projects: "id, updated_at",
      canvas_objects: "id, drawing_id, object_id, layer, updated_at, dirty",
    });
    this.version(2)
      .stores({
        projects: "id, updated_at",
        canvas_objects:
          "id, drawing_id, object_id, layer, sync_status, [drawing_id+sync_status], last_updated",
      })
      .upgrade(async (trans) => {
        await trans.table("canvas_objects").clear();
      });
  }
}

export const db = new MyBoardDatabase();

export async function upsertProjectLocal(row: ProjectRow): Promise<void> {
  await db.projects.put(row);
}

export async function upsertCanvasObjectLocal(row: CanvasObject): Promise<void> {
  await db.canvas_objects.put(row);
}

export async function markCanvasObjectSynced(id: string): Promise<void> {
  await db.canvas_objects.update(id, {
    sync_status: "synced",
    last_updated: Date.now(),
  });
}

export async function replaceDrawingCanvasObjectsLocal(
  drawingId: string,
  objects: CanvasObject[],
): Promise<void> {
  await db.transaction("rw", db.canvas_objects, async () => {
    const existing = await db.canvas_objects.where("drawing_id").equals(drawingId).toArray();
    if (existing.length > 0) {
      await db.canvas_objects.bulkDelete(existing.map((r) => r.id));
    }
    if (objects.length > 0) {
      await db.canvas_objects.bulkPut(objects);
    }
  });
}

/** Сопоставить строку Supabase → Local-First для `bulkPut`. */
export function supabaseRowToCanvasObject(row: {
  id: string;
  drawing_id: string;
  object_id: string;
  layer: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  updated_at: string;
}): CanvasObject {
  return {
    id: String(row.id),
    drawing_id: String(row.drawing_id),
    object_id: String(row.object_id),
    layer: row.layer === "img" || row.layer === "text" || row.layer === "draw" ? row.layer : "draw",
    fabric_json:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    last_updated: new Date(row.updated_at).getTime(),
    sync_status: "synced",
  };
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Все `pending` объекты → `canvas_objects` в Supabase (upsert), при успехе — `synced` в Dexie.
 */
export async function pushChanges(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  const pending = await db.canvas_objects.where("sync_status").equals("pending").toArray();
  if (pending.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  const tstamp = Date.now();
  const batch = pending.map((row) => ({
    id: row.id,
    drawing_id: row.drawing_id,
    object_id: row.object_id,
    layer: row.layer,
    payload: row.fabric_json,
    updated_at: new Date(row.last_updated).toISOString(),
    last_updated_at: new Date(row.last_updated).toISOString(),
    last_sync_tstamp: now,
  }));
  const { error } = await supabase.from("canvas_objects").upsert(batch, { onConflict: "id" });
  if (error) {
    console.warn("pushChanges:", error);
    return;
  }
  await db.transaction("rw", db.canvas_objects, async () => {
    for (const row of pending) {
      await db.canvas_objects.update(row.id, {
        sync_status: "synced",
        last_updated: tstamp,
      });
    }
  });
}

export function pushChangesDebounced(ms = 300): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
  }
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushChanges();
  }, ms);
}
