import Dexie, { type Table } from "dexie";
import { supabase } from "../utils/supabaseClient";

export type ProjectRow = {
  id: string;
  name?: string;
  updated_at: string;
};

export type SyncStatus = "synced" | "pending";

/**
 * Local-First строка: весь fabric-объект в `fabric_json`, `id` = `drawing_id:object_id` как в Supabase.
 * `drawing_id` — id работы (`public.drawings`); в приложении: `?id` / `?drawing`, не `?room`.
 */
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

export async function upsertCanvasObjectLocal(row: CanvasObject, debugTag?: string): Promise<void> {
  if (debugTag) {
    console.log("[save:canvas] upsertCanvasObjectLocal", {
      id: row.id,
      object_id: row.object_id,
      layer: row.layer,
      sync_status: row.sync_status,
      from: debugTag,
    });
  }
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

export async function getLocalCanvasObjectsByDrawingId(
  drawingId: string,
): Promise<CanvasObject[]> {
  return db.canvas_objects.where("drawing_id").equals(drawingId).toArray();
}

/** Все `canvas_objects` в Supabase для рисунка (как в UI-гидратации). */
export async function fetchCanvasObjectsFromSupabase(
  drawingId: string,
): Promise<CanvasObject[]> {
  const { data, error } = await supabase
    .from("canvas_objects")
    .select("id,drawing_id,object_id,layer,payload,updated_at,last_sync_tstamp")
    .eq("drawing_id", drawingId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) =>
    supabaseRowToCanvasObject({
      id: String(row.id),
      drawing_id: String(row.drawing_id),
      object_id: String(row.object_id),
      layer: String(row.layer),
      payload: row.payload,
      updated_at: String(row.updated_at ?? new Date().toISOString()),
    }),
  );
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

/** Минимальный снимок слоёв для согласования `canvas_objects` в MyBoardDB. */
type SnapshotForLocalObjects = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imgLayer?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  textLayer?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drawLayer?: any;
};

function layerObjectsForSnapshot(layer: unknown): unknown[] {
  if (layer && typeof layer === "object" && !Array.isArray(layer) && "objects" in layer) {
    const o = (layer as { objects?: unknown }).objects;
    return Array.isArray(o) ? o : [];
  }
  return [];
}

function readCollabId(obj: unknown): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const o = obj as Record<string, unknown>;
  if (typeof o.mbCollabId === "string" && o.mbCollabId.length > 0) {
    return o.mbCollabId;
  }
  if (typeof o.id === "string" && o.id.length > 0) {
    return o.id;
  }
  return null;
}

/**
 * Полная выгрузка снимка в `MyBoardDB`: каждое тело в снимке с `sync_status: 'pending'`,
 * отсутствующие в снимке локальные строки `drawing_id` удаляются (согласованность после `object:removed` и т.д.).
 */
export async function reconcileLocalCanvasObjectsFromSnapshot(
  drawingId: string,
  snapshot: SnapshotForLocalObjects,
): Promise<void> {
  console.log("[save:canvas] reconcileLocalCanvasObjectsFromSnapshot start", { drawingId });
  const t = Date.now();
  const rows: CanvasObject[] = [];
  const objectIds = new Set<string>();
  const layers: { layer: "img" | "text" | "draw"; items: unknown[] }[] = [
    { layer: "img", items: layerObjectsForSnapshot(snapshot?.imgLayer) },
    { layer: "text", items: layerObjectsForSnapshot(snapshot?.textLayer) },
    { layer: "draw", items: layerObjectsForSnapshot(snapshot?.drawLayer) },
  ];
  for (const { layer, items } of layers) {
    for (const item of items) {
      const objectId = readCollabId(item);
      if (!objectId) {
        console.warn("[save:canvas] reconcile: пропущен объект без mbCollabId/id", { layer });
        continue;
      }
      objectIds.add(objectId);
      const fabricJson = item as Record<string, unknown>;
      rows.push({
        id: `${drawingId}:${objectId}`,
        drawing_id: drawingId,
        object_id: objectId,
        layer,
        fabric_json: fabricJson,
        last_updated: t,
        sync_status: "pending",
      });
    }
  }
  let deletedN = 0;
  await db.transaction("rw", db.canvas_objects, async () => {
    const existing = await db.canvas_objects.where("drawing_id").equals(drawingId).toArray();
    for (const e of existing) {
      if (!objectIds.has(e.object_id)) {
        await db.canvas_objects.delete(e.id);
        deletedN += 1;
      }
    }
    for (const row of rows) {
      await db.canvas_objects.put(row);
    }
  });
  console.log("[save:canvas] reconcileLocalCanvasObjectsFromSnapshot done", {
    drawingId,
    put: rows.length,
    deleted: deletedN,
  });
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Все `pending` объекты → `canvas_objects` в Supabase (upsert), при успехе — `synced` в Dexie.
 */
export async function pushChanges(): Promise<void> {
  console.log("[save:canvas] pushChanges: entry");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    console.log("[save:canvas] pushChanges: skip (offline)");
    return;
  }
  const pending = await db.canvas_objects.where("sync_status").equals("pending").toArray();
  if (pending.length === 0) {
    console.log("[save:canvas] pushChanges: no pending rows");
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
  const ids = batch.map((b) => b.id);
  console.log("[save:canvas] pushChanges: supabase upsert", {
    count: batch.length,
    onConflict: "id",
    ids,
  });
  const { error } = await supabase.from("canvas_objects").upsert(batch, { onConflict: "id" });
  if (error) {
    console.warn("[save:canvas] pushChanges: supabase error", error);
    return;
  }
  console.log("[save:canvas] pushChanges: supabase ok, marking Dexie synced", { count: pending.length });
  await db.transaction("rw", db.canvas_objects, async () => {
    for (const row of pending) {
      await db.canvas_objects.update(row.id, {
        sync_status: "synced",
        last_updated: tstamp,
      });
    }
  });
  console.log("[save:canvas] pushChanges: done");
}

export function pushChangesDebounced(ms = 300): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
  }
  console.log("[save:canvas] pushChangesDebounced: scheduled", { delayMs: ms });
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushChanges();
  }, ms);
}
