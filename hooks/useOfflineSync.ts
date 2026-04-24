import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Canvas } from "fabric";
import { supabase } from "../utils/supabaseClient";
import { db, pushChanges, supabaseRowToCanvasObject, upsertCanvasObjectLocal } from "../lib/db";
import { removeObjectByCollabId, type LayerId, upsertObjectOnCanvas } from "./useCollaboration";

type ServerRow = {
  id: string;
  drawing_id: string;
  object_id: string;
  layer: string;
  payload: Record<string, unknown> | null;
  updated_at: string;
};

function isLayerId(s: string): s is LayerId {
  return s === "img" || s === "text" || s === "draw";
}

function toServerRow(r: unknown): ServerRow | null {
  if (!r || typeof r !== "object") {
    return null;
  }
  const o = r as Record<string, unknown>;
  const id = o.id;
  if (typeof id !== "string" && typeof id !== "number") {
    return null;
  }
  return {
    id: String(id),
    drawing_id: String(o.drawing_id ?? ""),
    object_id: String(o.object_id ?? ""),
    layer: String(o.layer ?? "draw"),
    payload:
      o.payload && typeof o.payload === "object" && !Array.isArray(o.payload)
        ? (o.payload as Record<string, unknown>)
        : null,
    updated_at: String(o.updated_at ?? new Date().toISOString()),
  };
}

type UseOfflineSyncInput = {
  enabled: boolean;
  syncDrawingId: string;
  canvasesReady: boolean;
  isRestoringRef: MutableRefObject<boolean>;
  imgCanvasRef: RefObject<Canvas | null>;
  textCanvasRef: RefObject<Canvas | null>;
  drawCanvasRef: RefObject<Canvas | null>;
};

/**
 * Local-First: при `online` — `pushChanges()` (все `pending` в Supabase).
 * Realtime: INSERT/UPDATE/DELETE — Dexie + Fabric.
 */
export function useOfflineSync({
  enabled,
  syncDrawingId,
  canvasesReady,
  isRestoringRef,
  imgCanvasRef,
  textCanvasRef,
  drawCanvasRef,
}: UseOfflineSyncInput) {
  const isApplyingRemoteRef = useRef(false);
  const syncDrawingIdRef = useRef(syncDrawingId);
  syncDrawingIdRef.current = syncDrawingId;

  const getCanvas = useCallback(
    (layer: LayerId) => {
      if (layer === "img") {
        return imgCanvasRef.current;
      }
      if (layer === "text") {
        return textCanvasRef.current;
      }
      return drawCanvasRef.current;
    },
    [imgCanvasRef, textCanvasRef, drawCanvasRef],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) {
      return;
    }
    const onOnline = () => {
      if (!navigator.onLine) {
        return;
      }
      void pushChanges();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !canvasesReady || !syncDrawingId) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const id = syncDrawingId;
    const table = "canvas_objects";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = supabase.channel(`canvas_objects:rt:${id}`) as any;
    ch.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `drawing_id=eq.${id}`,
      },
      (payload: { eventType: string; new: unknown; old: unknown }) => {
        if (isRestoringRef.current) {
          return;
        }
        const p = payload;
        if (p.eventType === "DELETE") {
          const oldR = toServerRow(p.old);
          if (!oldR || !oldR.object_id) {
            return;
          }
          if (oldR.drawing_id && oldR.drawing_id !== syncDrawingIdRef.current) {
            return;
          }
          const delLayer = oldR.layer;
          if (!isLayerId(delLayer)) {
            return;
          }
          void (async () => {
            if (isRestoringRef.current) {
              return;
            }
            try {
              await db.canvas_objects.delete(oldR.id);
            } catch {
              /* */
            }
            removeObjectByCollabId(delLayer, oldR.object_id, getCanvas, isApplyingRemoteRef);
          })();
          return;
        }

        if (p.eventType !== "INSERT" && p.eventType !== "UPDATE") {
          return;
        }
        const row = toServerRow(p.new);
        if (!row || !row.object_id) {
          return;
        }
        if (row.drawing_id && row.drawing_id !== syncDrawingIdRef.current) {
          return;
        }
        if (!isLayerId(row.layer) || !row.payload) {
          return;
        }
        const pl = row.payload;
        const layer: LayerId = row.layer;
        const local = supabaseRowToCanvasObject({
          id: row.id,
          drawing_id: row.drawing_id,
          object_id: row.object_id,
          layer: row.layer,
          payload: pl,
          updated_at: row.updated_at,
        });

        void (async () => {
          if (isRestoringRef.current) {
            return;
          }
          try {
            await upsertCanvasObjectLocal(local);
          } catch (e) {
            console.warn("useOfflineSync: Dexie put failed", e);
            return;
          }
          if (isRestoringRef.current) {
            return;
          }
          await upsertObjectOnCanvas(layer, pl, getCanvas, isApplyingRemoteRef);
        })();
      },
    );
    ch.subscribe((status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("useOfflineSync: Realtime", status, "(проверь RLS/Realtime для", table, ")");
      }
    });

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [enabled, canvasesReady, getCanvas, isRestoringRef, syncDrawingId]);
}
