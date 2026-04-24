import Dexie, { type Table } from "dexie";

export type ProjectRow = {
  id: string;
  name?: string;
  updated_at: string;
};

export type CanvasObjectRow = {
  id: string;
  drawing_id: string;
  object_id: string;
  layer: "img" | "text" | "draw";
  payload: Record<string, unknown>;
  updated_at: string;
  dirty: boolean;
  last_sync_tstamp?: string | null;
};

export class MyBoardDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  canvas_objects!: Table<CanvasObjectRow, string>;

  constructor() {
    super("MyBoardDB");
    this.version(1).stores({
      projects: "id, updated_at",
      canvas_objects: "id, drawing_id, object_id, layer, updated_at, dirty",
    });
  }
}

export const db = new MyBoardDB();

export async function upsertProjectLocal(row: ProjectRow): Promise<void> {
  await db.projects.put(row);
}

export async function upsertCanvasObjectLocal(row: CanvasObjectRow): Promise<void> {
  await db.canvas_objects.put(row);
}

export async function markCanvasObjectSynced(id: string): Promise<void> {
  await db.canvas_objects.update(id, {
    dirty: false,
    last_sync_tstamp: new Date().toISOString(),
  });
}

export async function replaceDrawingCanvasObjectsLocal(
  drawingId: string,
  rows: CanvasObjectRow[],
): Promise<void> {
  await db.transaction("rw", db.canvas_objects, async () => {
    const existing = await db.canvas_objects.where("drawing_id").equals(drawingId).toArray();
    if (existing.length > 0) {
      await db.canvas_objects.bulkDelete(existing.map((r) => r.id));
    }
    if (rows.length > 0) {
      await db.canvas_objects.bulkPut(rows);
    }
  });
}
