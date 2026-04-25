import type { CanvasSnapshot } from "./drawingsApi";

/**
 * Куда класть fabric-объект по полю `type` (и при сомнении — по `layer` из БД/снапшота).
 * Image → img; IText / textbox / text → text; path и прочий рисунок → draw.
 */
export function classifyLayerFromFabricType(
  o: Record<string, unknown>,
  dbLayer: string | undefined,
): "img" | "text" | "draw" {
  const t = String(o.type ?? "")
    .trim()
    .toLowerCase();
  if (t === "image" || t === "fabricimage") {
    return "img";
  }
  if (t === "itext" || t === "i-text" || t === "textbox" || t === "text") {
    return "text";
  }
  if (
    t === "path" ||
    t === "line" ||
    t === "polyline" ||
    t === "polygon" ||
    t === "rect" ||
    t === "circle" ||
    t === "ellipse" ||
    t === "triangle"
  ) {
    return "draw";
  }
  if (t === "group" || t === "activeselection" || t === "active selection") {
    return "draw";
  }
  if (dbLayer === "img" || dbLayer === "text" || dbLayer === "draw") {
    return dbLayer;
  }
  return "draw";
}

function layerObjectsFromSnapshotLayer(layer: unknown): unknown[] {
  if (Array.isArray(layer)) {
    return layer;
  }
  if (layer && typeof layer === "object" && "objects" in layer) {
    const o = (layer as { objects?: unknown[] }).objects;
    return Array.isArray(o) ? o : [];
  }
  return [];
}

function wrapLayer(legacy: unknown, objects: unknown[]): Record<string, unknown> {
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    return { ...(legacy as Record<string, unknown>), objects };
  }
  return { version: "7.0.0" as const, objects };
}

/**
 * Перекладывает объекты из content по фактическому `type` (после импорта/ошибок слоёв).
 */
export function normalizeSnapshotByFabricType(snapshot: CanvasSnapshot): CanvasSnapshot {
  const imgOut: unknown[] = [];
  const textOut: unknown[] = [];
  const drawOut: unknown[] = [];

  const processList = (list: unknown[], defaultDbLayer: "img" | "text" | "draw") => {
    for (const item of list) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const o = item as Record<string, unknown>;
      const L = classifyLayerFromFabricType(o, defaultDbLayer);
      if (L === "img") {
        imgOut.push(item);
      } else if (L === "text") {
        textOut.push(item);
      } else {
        drawOut.push(item);
      }
    }
  };

  processList(layerObjectsFromSnapshotLayer(snapshot.imgLayer), "img");
  processList(layerObjectsFromSnapshotLayer(snapshot.textLayer), "text");
  processList(layerObjectsFromSnapshotLayer(snapshot.drawLayer), "draw");

  return {
    ...snapshot,
    imgLayer: wrapLayer(snapshot.imgLayer, imgOut),
    textLayer: wrapLayer(snapshot.textLayer, textOut),
    drawLayer: wrapLayer(snapshot.drawLayer, drawOut),
  };
}

type ObjectRow = {
  object_id: string;
  layer: "img" | "text" | "draw";
  fabric_json: Record<string, unknown>;
  last_updated: number;
};

/**
 * Собирает `CanvasSnapshot` из строк `canvas_objects` (Dexie/Supabase), с маршрутизацией по `type`.
 */
export function buildSnapshotFromObjectRows(
  rows: ObjectRow[],
  base: CanvasSnapshot,
): CanvasSnapshot {
  const img: unknown[] = [];
  const text: unknown[] = [];
  const draw: unknown[] = [];
  const latest = new Map<
    string,
    { t: number; L: "img" | "text" | "draw"; json: Record<string, unknown> }
  >();
  for (const row of rows) {
    const t = row.last_updated;
    const p = { ...row.fabric_json };
    const L = classifyLayerFromFabricType(p, row.layer);
    const ex = latest.get(row.object_id);
    if (ex && t < ex.t) {
      continue;
    }
    latest.set(row.object_id, { t, L, json: p });
  }
  for (const { L, json } of latest.values()) {
    if (L === "img") {
      img.push(json);
    } else if (L === "text") {
      text.push(json);
    } else {
      draw.push(json);
    }
  }
  return {
    ...base,
    imgLayer: { version: "7.0.0" as const, objects: img },
    textLayer: { version: "7.0.0" as const, objects: text },
    drawLayer: { version: "7.0.0" as const, objects: draw },
  };
}
