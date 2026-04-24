import { useCallback, useEffect, useRef, useState } from "react";
import { type Canvas, type FabricObject, util } from "fabric";
import { supabase } from "../utils/supabaseClient";
import {
  getDirtyCanvasObjects,
  markCanvasObjectsSynced,
  upsertLocalCanvasObjectFromRemote,
} from "../utils/db";

type LayerId = "img" | "text" | "draw";
const COLLAB_ID_KEY = "mbCollabId";

type CanvasObjectRow = {
  object_id: string;
  room_id: string;
  layer: LayerId;
  payload: Record<string, unknown>;
  last_updated_at?: string | null;
  updated_at?: string | null;
  source_client_id?: string | null;
};

type UseSyncInput = {
  enabled: boolean;
  roomId: string;
  clientId: string;
  getCanvas: (layer: LayerId) => Canvas | null;
};

function findByObjectId(canvas: Canvas, objectId: string): FabricObject | undefined {
  return canvas.getObjects().find((obj) => {
    const v = (obj as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY);
    return typeof v === "string" && v === objectId;
  });
}

async function upsertOnCanvas(
  canvas: Canvas,
  objectId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const existing = findByObjectId(canvas, objectId);
  if (existing) {
    existing.set(payload as object);
    canvas.requestRenderAll();
    return;
  }
  const [el] = await util.enlivenObjects<FabricObject>([payload], {});
  if (!el) return;
  (el as FabricObject & { set: (k: string, v: string) => void }).set(COLLAB_ID_KEY, objectId);
  canvas.add(el);
  canvas.requestRenderAll();
}

export function useSync({ enabled, roomId, clientId, getCanvas }: UseSyncInput) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const syncingRef = useRef(false);

  const syncDirtyObjects = useCallback(async () => {
    if (!enabled || !roomId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const dirtyRows = await getDirtyCanvasObjects();
      if (dirtyRows.length === 0) return;

      const objectIds = dirtyRows.map((r: { objectId: string }) => r.objectId);
      const { data: remoteRows, error: remoteErr } = await supabase
        .from("canvas_objects")
        .select("object_id,last_updated_at,updated_at")
        .eq("room_id", roomId)
        .in("object_id", objectIds);
      if (remoteErr) throw remoteErr;

      const remoteTs = new Map<string, number>();
      for (const row of (remoteRows ?? []) as CanvasObjectRow[]) {
        const tsRaw = row.last_updated_at ?? row.updated_at ?? null;
        const ts = tsRaw ? new Date(tsRaw).getTime() : 0;
        remoteTs.set(row.object_id, Number.isFinite(ts) ? ts : 0);
      }

      const toUpsert = dirtyRows
        .filter((row: { objectId: string; updatedAt: number }) => {
          const remote = remoteTs.get(row.objectId) ?? 0;
          return row.updatedAt > remote;
        })
        .map((row: { objectId: string; layer: LayerId; payload: unknown; updatedAt: number }) => ({
          object_id: row.objectId,
          room_id: roomId,
          layer: row.layer,
          payload: row.payload,
          last_updated_at: new Date(row.updatedAt).toISOString(),
          updated_at: new Date(row.updatedAt).toISOString(),
          source_client_id: clientId,
        }));

      if (toUpsert.length > 0) {
        const { error } = await supabase.from("canvas_objects").upsert(toUpsert, {
          onConflict: "object_id",
        });
        if (error) throw error;
      }

      await markCanvasObjectsSynced(objectIds);
    } catch (e) {
      console.warn("useSync: syncDirtyObjects failed", e);
    } finally {
      syncingRef.current = false;
    }
  }, [clientId, enabled, roomId]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void syncDirtyObjects();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncDirtyObjects]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = supabase.channel(`canvas_objects:${roomId}`) as any;
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "canvas_objects", filter: `room_id=eq.${roomId}` },
      (payload: { new?: CanvasObjectRow }) => {
        const row = payload.new;
        if (!row || !row.object_id) return;
        if (row.source_client_id && row.source_client_id === clientId) return;

        const layer = row.layer;
        const canvas = getCanvas(layer);
        if (!canvas) return;

        void upsertOnCanvas(canvas, row.object_id, row.payload ?? {});
        void upsertLocalCanvasObjectFromRemote({
          objectId: row.object_id,
          layer: row.layer,
          payload: row.payload ?? {},
          updatedAt: row.last_updated_at ?? row.updated_at ?? new Date().toISOString(),
        });
      },
    );

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, enabled, getCanvas, roomId]);

  return {
    isOnline,
    syncNow: syncDirtyObjects,
  };
}
