import Dexie from "dexie";
import { supabase } from "./supabaseClient";

const db = new Dexie("myboard_dexie");

db.version(1).stores({
  canvas_objects: "++id, objectId, layer, updatedAt, dirty",
});

function normalizeLayer(layer) {
  if (layer === "img" || layer === "text" || layer === "draw") {
    return layer;
  }
  return "draw";
}

export async function saveCanvasObjectsFromSnapshot(snapshot) {
  if (!snapshot) return;
  const imgObjects = snapshot?.imgLayer?.objects ?? [];
  const textObjects = snapshot?.textLayer?.objects ?? [];
  const drawObjects = snapshot?.drawLayer?.objects ?? [];
  const now = Date.now();

  const records = [
    ...imgObjects.map((obj) => ({
      objectId: obj?.mbCollabId || obj?.id || crypto.randomUUID(),
      layer: "img",
      payload: obj,
      updatedAt: now,
      dirty: true,
    })),
    ...textObjects.map((obj) => ({
      objectId: obj?.mbCollabId || obj?.id || crypto.randomUUID(),
      layer: "text",
      payload: obj,
      updatedAt: now,
      dirty: true,
    })),
    ...drawObjects.map((obj) => ({
      objectId: obj?.mbCollabId || obj?.id || crypto.randomUUID(),
      layer: "draw",
      payload: obj,
      updatedAt: now,
      dirty: true,
    })),
  ];

  await db.transaction("rw", db.canvas_objects, async () => {
    await db.canvas_objects.clear();
    if (records.length > 0) {
      await db.canvas_objects.bulkAdd(records);
    }
  });
}

export async function loadSnapshotFromDexie() {
  const rows = await db.canvas_objects.toArray();
  if (!rows.length) return null;

  const img = [];
  const text = [];
  const draw = [];

  for (const row of rows) {
    const layer = normalizeLayer(row.layer);
    if (layer === "img") img.push(row.payload);
    else if (layer === "text") text.push(row.payload);
    else draw.push(row.payload);
  }

  return {
    imgLayer: { version: "7.0.0", objects: img },
    textLayer: { version: "7.0.0", objects: text },
    drawLayer: { version: "7.0.0", objects: draw },
    canvasHeight: 600,
    savedAt: new Date().toISOString(),
  };
}

export async function syncDexieCanvasObjectsWithSupabase() {
  const dirtyRows = await db.canvas_objects.filter((row) => row.dirty === true).toArray();
  if (!dirtyRows.length) return;

  const payload = dirtyRows.map((row) => ({
    object_id: row.objectId,
    layer: row.layer,
    payload: row.payload,
    updated_at: new Date(row.updatedAt).toISOString(),
  }));

  const { error } = await supabase.from("canvas_objects").upsert(payload, {
    onConflict: "object_id",
  });
  if (error) {
    throw error;
  }

  await db.transaction("rw", db.canvas_objects, async () => {
    for (const row of dirtyRows) {
      await db.canvas_objects.update(row.id, { dirty: false });
    }
  });
}

export async function getDirtyCanvasObjects() {
  return db.canvas_objects.filter((row) => row.dirty === true).toArray();
}

export async function markCanvasObjectsSynced(objectIds) {
  if (!Array.isArray(objectIds) || objectIds.length === 0) {
    return;
  }
  const ids = new Set(objectIds);
  await db.transaction("rw", db.canvas_objects, async () => {
    const rows = await db.canvas_objects.toArray();
    for (const row of rows) {
      if (ids.has(row.objectId)) {
        await db.canvas_objects.update(row.id, { dirty: false });
      }
    }
  });
}

export async function upsertLocalCanvasObjectFromRemote(input) {
  const objectId = input?.objectId;
  if (!objectId) {
    return;
  }
  const existing = await db.canvas_objects.where("objectId").equals(objectId).first();
  const parsedTs =
    typeof input?.updatedAt === "string"
      ? new Date(input.updatedAt).getTime()
      : Number(input?.updatedAt ?? Date.now());
  const next = {
    objectId,
    layer: normalizeLayer(input?.layer),
    payload: input?.payload ?? {},
    updatedAt: Number.isFinite(parsedTs) ? parsedTs : Date.now(),
    dirty: false,
  };
  if (existing?.id != null) {
    await db.canvas_objects.update(existing.id, next);
  } else {
    await db.canvas_objects.add(next);
  }
}
