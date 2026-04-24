import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Canvas,
  type FabricObject,
  FabricImage,
  IText,
  Path,
  util,
} from "fabric";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabaseClient";
import { STORAGE_PATH_KEY } from "../utils/imageStorage";

const BROADCAST_ADD_OBJECT = "collab-object-add";
const BROADCAST_REMOVE_OBJECT = "collab-object-remove";
const BROADCAST_CURSOR = "collab-cursor";
const ROOM_PARAM = "room";
export const MAX_ROOM_PARTICIPANTS = 10;
const COLLAB_ID_KEY = "mbCollabId";

/** Сериализация URL, crossOrigin, mbStoragePath, mbCollabId для картинок. */
const SNAPSHOT_PROPS: string[] = [STORAGE_PATH_KEY, "crossOrigin", COLLAB_ID_KEY];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addCustomProp(C: any, name: string) {
  if (!C?.customProperties) {
    C.customProperties = [];
  }
  if (!C.customProperties.includes(name)) {
    C.customProperties = [...C.customProperties, name];
  }
}

void (function registerCollabId() {
  addCustomProp(FabricImage, COLLAB_ID_KEY);
  addCustomProp(IText, COLLAB_ID_KEY);
  addCustomProp(Path, COLLAB_ID_KEY);
})();

const COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#ca8a04",
  "#4f46e5",
  "#dc2626",
];

const resolveRoomId = () => {
  if (typeof window === "undefined") {
    return "room-default";
  }
  const url = new URL(window.location.href);
  let room = url.searchParams.get(ROOM_PARAM);
  if (!room) {
    room = uuidv4();
    url.searchParams.set(ROOM_PARAM, room);
    window.history.replaceState({}, "", url.toString());
  }
  return room;
};

const displayNameKey = "myboard_display_name";
function getOrCreateDisplayName() {
  if (typeof window === "undefined") {
    return "Участник";
  }
  const stored = localStorage.getItem(displayNameKey);
  if (stored && stored.trim()) {
    return stored.slice(0, 32);
  }
  const name = `Гость ${Math.floor(1000 + Math.random() * 9000)}`;
  localStorage.setItem(displayNameKey, name);
  return name;
}

function colorForClientId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h + id.charCodeAt(i) * (i + 1)) % COLORS.length;
  }
  return COLORS[h] ?? COLORS[0];
}

type LayerId = "img" | "text" | "draw";

type ObjectAddPayload = {
  type: "collab-object-add";
  roomId: string;
  senderId: string;
  layer: LayerId;
  object: Record<string, unknown>;
};

type ObjectRemovePayload = {
  type: "collab-object-remove";
  roomId: string;
  senderId: string;
  layer: LayerId;
  collabId: string;
};

type CursorPayload = {
  type: "collab-cursor";
  roomId: string;
  senderId: string;
  name: string;
  color: string;
  xPct: number;
  yPct: number;
};

export type RemoteCursor = {
  senderId: string;
  name: string;
  color: string;
  xPct: number;
  yPct: number;
  updatedAt: number;
};

const CURSOR_TTL_MS = 8000;
const CURSOR_THROTTLE_MS = 80;
const MODIFY_DEBOUNCE_MS = 320;

function applyCrossOriginToImageData(obj: Record<string, unknown>) {
  if (obj.type === "Image" && typeof (obj as { src?: string }).src === "string") {
    const s = (obj as { src: string }).src;
    if (s.startsWith("http://") || s.startsWith("https://")) {
      (obj as { crossOrigin: string | null }).crossOrigin = "anonymous";
    }
  }
}

function ensureCollabId(obj: FabricObject): string {
  const ex = (obj as FabricObject & { get: (k: string) => unknown }).get(
    COLLAB_ID_KEY,
  ) as string | undefined;
  if (typeof ex === "string" && ex.length > 0) {
    return ex;
  }
  const id = uuidv4();
  (obj as FabricObject & { set: (k: string, v: string) => void }).set(
    COLLAB_ID_KEY,
    id,
  );
  return id;
}

const TRANSFORM_KEYS: (keyof FabricObject | string)[] = [
  "left",
  "top",
  "scaleX",
  "scaleY",
  "angle",
  "opacity",
  "flipX",
  "flipY",
  "skewX",
  "skewY",
  "originX",
  "originY",
  "globalCompositeOperation",
  "fill",
  "stroke",
  "strokeWidth",
  "strokeLineCap",
  "strokeLineJoin",
  "strokeMiterLimit",
  "path",
];

function pickTransform(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of TRANSFORM_KEYS) {
    const key = k as string;
    if (key in data && data[key] !== undefined) {
      o[key] = data[key];
    }
  }
  return o;
}

async function upsertObjectOnCanvas(
  layer: LayerId,
  data: Record<string, unknown>,
  getCanvas: (layer: LayerId) => Canvas | null,
  isApplyingRemoteRef: { current: boolean },
): Promise<void> {
  const canvas = getCanvas(layer);
  if (!canvas) {
    return;
  }

  const collabId = data[COLLAB_ID_KEY] as string | undefined;
  if (collabId) {
    const toRemove = canvas
      .getObjects()
      .filter((o) => (o as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY) === collabId);
    for (const o of toRemove) {
      canvas.remove(o);
    }
  }

  isApplyingRemoteRef.current = true;
  try {
    if (data.type === "Image" && typeof (data as { src?: string }).src === "string") {
      const src = (data as { src: string }).src;
      const isRemote = src.startsWith("http://") || src.startsWith("https://");
      if (isRemote) {
        const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
        img.set(pickTransform(data));
        applyCrossOriginToImageData({ ...data, type: "Image" } as Record<string, unknown>);
        if (data[STORAGE_PATH_KEY] != null) {
          (img as FabricObject & { set: (a: object) => void }).set({
            [STORAGE_PATH_KEY]: data[STORAGE_PATH_KEY],
            crossOrigin: (data as { crossOrigin?: string | null }).crossOrigin ?? "anonymous",
          });
        } else {
          (img as FabricObject & { set: (a: object) => void }).set({
            crossOrigin: "anonymous",
          });
        }
        if (collabId) {
          (img as FabricObject & { set: (k: string, v: string) => void }).set(
            COLLAB_ID_KEY,
            collabId,
          );
        }
        canvas.add(img);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
    }

    const copy = { ...data };
    applyCrossOriginToImageData(copy);
    const [el] = await util.enlivenObjects<FabricObject>([copy], {});
    if (!el) {
      return;
    }
    if (collabId) {
      (el as FabricObject & { set: (k: string, v: string) => void }).set(
        COLLAB_ID_KEY,
        collabId,
      );
    }
    canvas.add(el);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  } catch (e) {
    console.warn("collab: upsertObjectOnCanvas failed", e);
  } finally {
    isApplyingRemoteRef.current = false;
  }
}

function removeObjectByCollabId(
  layer: LayerId,
  collabId: string,
  getCanvas: (l: LayerId) => Canvas | null,
  isApplyingRemoteRef: { current: boolean },
): void {
  const canvas = getCanvas(layer);
  if (!canvas) {
    return;
  }
  isApplyingRemoteRef.current = true;
  try {
    const obj = canvas.getObjects().find(
      (o) =>
        (o as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY) ===
        collabId,
    );
    if (obj) {
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  } finally {
    isApplyingRemoteRef.current = false;
  }
}

export type UseRoomCollabInput = {
  enabled: boolean;
  canvasesReady: boolean;
  isRestoringRef: React.MutableRefObject<boolean>;
  imgCanvasRef: React.RefObject<Canvas | null>;
  textCanvasRef: React.RefObject<Canvas | null>;
  drawCanvasRef: React.RefObject<Canvas | null>;
  boardContainerRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Realtime: JSON / FabricImage.fromURL, delete по mbCollabId, курсоры, max 10 presence.
 */
export function useRoomCollaboration({
  enabled,
  canvasesReady,
  isRestoringRef,
  imgCanvasRef,
  textCanvasRef,
  drawCanvasRef,
  boardContainerRef,
}: UseRoomCollabInput) {
  const [roomId] = useState(() => resolveRoomId());
  const [shareUrl, setShareUrl] = useState("");
  const clientIdRef = useRef(uuidv4());
  const nameRef = useRef(getOrCreateDisplayName());
  const colorRef = useRef(colorForClientId(clientIdRef.current));
  const isApplyingRemoteRef = useRef(false);
  const [roomFull, setRoomFull] = useState(false);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const [participants, setParticipants] = useState(0);
  const lastCursorAtRef = useRef(0);
  const roomFullRef = useRef(false);
  roomFullRef.current = roomFull;
  const textModTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgModTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawModTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const share = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}${window.location.pathname}?${ROOM_PARAM}=${roomId}`;
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setShareUrl(share);
  }, [share]);

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
    if (!enabled || !canvasesReady || roomFull) {
      return;
    }
    const imgC = imgCanvasRef.current;
    const textC = textCanvasRef.current;
    const drawC = drawCanvasRef.current;
    if (!imgC || !textC || !drawC) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = supabase.channel(`board:${roomId}`) as any;

    const onObjectAdd = (message: { payload?: ObjectAddPayload }) => {
      const p = message.payload;
      if (!p || p.type !== "collab-object-add" || p.roomId !== roomId) {
        return;
      }
      if (p.senderId === clientIdRef.current) {
        return;
      }
      if (p.object) {
        void upsertObjectOnCanvas(
          p.layer,
          p.object,
          getCanvas,
          isApplyingRemoteRef,
        );
      }
    };

    const onObjectRemove = (message: { payload?: ObjectRemovePayload }) => {
      const p = message.payload;
      if (!p || p.type !== "collab-object-remove" || p.roomId !== roomId) {
        return;
      }
      if (p.senderId === clientIdRef.current) {
        return;
      }
      if (p.collabId) {
        removeObjectByCollabId(
          p.layer,
          p.collabId,
          getCanvas,
          isApplyingRemoteRef,
        );
      }
    };

    const onCur = (message: { payload?: CursorPayload }) => {
      const p = message.payload;
      if (!p || p.type !== "collab-cursor" || p.roomId !== roomId) {
        return;
      }
      if (p.senderId === clientIdRef.current) {
        return;
      }
      if (p.xPct < 0 || p.xPct > 1 || p.yPct < 0 || p.yPct > 1) {
        return;
      }
      setCursors((prev) => {
        const o = prev.filter((c) => c.senderId !== p.senderId);
        return [
          ...o,
          {
            senderId: p.senderId,
            name: p.name,
            color: p.color,
            xPct: p.xPct,
            yPct: p.yPct,
            updatedAt: Date.now(),
          },
        ];
      });
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as Record<string, unknown[]>;
        const n = Object.keys(st).length;
        setParticipants(n);
        if (n > MAX_ROOM_PARTICIPANTS) {
          setRoomFull(true);
          void channel.untrack();
        }
      })
      .on("broadcast", { event: BROADCAST_ADD_OBJECT }, onObjectAdd)
      .on("broadcast", { event: BROADCAST_REMOVE_OBJECT }, onObjectRemove)
      .on("broadcast", { event: BROADCAST_CURSOR }, onCur);

    const sendAdd = (payload: ObjectAddPayload) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current || roomFullRef.current) {
        return;
      }
      void channel
        .send({ type: "broadcast", event: BROADCAST_ADD_OBJECT, payload })
        .catch((e: unknown) => console.warn("collab send", e));
    };

    const sendRemove = (payload: ObjectRemovePayload) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current || roomFullRef.current) {
        return;
      }
      void channel
        .send({ type: "broadcast", event: BROADCAST_REMOVE_OBJECT, payload })
        .catch((e: unknown) => console.warn("collab send remove", e));
    };

    const sendC = (cursorPayload: CursorPayload) => {
      if (roomFullRef.current) {
        return;
      }
      void channel
        .send({ type: "broadcast", event: BROADCAST_CURSOR, payload: cursorPayload })
        .catch((e: unknown) => console.warn("collab cursor", e));
    };

    const emitRemove = (layer: LayerId, target: FabricObject) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      const raw = (target as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      ) as string | undefined;
      if (typeof raw !== "string" || !raw) {
        return;
      }
      sendRemove({
        type: "collab-object-remove",
        roomId,
        senderId: clientIdRef.current,
        layer,
        collabId: raw,
      });
    };

    const sendTextUpsert = (o: IText) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      ensureCollabId(o);
      const d = o.toObject() as unknown as Record<string, unknown>;
      d[COLLAB_ID_KEY] = (o as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      );
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "text",
        object: d,
      });
    };

    const sendImageUpsert = (obj: FabricObject) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      if (!(obj.type === "Image" || (obj as FabricObject & { get: (k: string) => unknown }).get("type") === "Image")) {
        return;
      }
      ensureCollabId(obj);
      const d = (obj as FabricObject & { toObject: (props?: string[]) => object }).toObject(
        SNAPSHOT_PROPS,
      ) as unknown as Record<string, unknown>;
      d[COLLAB_ID_KEY] = (obj as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      );
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "img",
        object: d,
      });
    };

    const sendPathUpsert = (o: FabricObject) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      if (o.type !== "Path" && o.type !== "path") {
        return;
      }
      ensureCollabId(o);
      const d = o.toObject() as unknown as Record<string, unknown>;
      d[COLLAB_ID_KEY] = (o as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      );
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "draw",
        object: d,
      });
    };

    const onPath = (e: { path?: FabricObject | null }) => {
      const p = e.path;
      if (!p || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (!p.toObject) {
        return;
      }
      sendPathUpsert(p);
    };

    const onText = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "IText" && (t as IText & { get?: (k: string) => string }).get?.("type") !== "IText") {
        return;
      }
      sendTextUpsert(t as IText);
    };

    const onTextModified = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "IText" && (t as IText & { get?: (k: string) => string }).get?.("type") !== "IText") {
        return;
      }
      if (textModTimer.current) {
        clearTimeout(textModTimer.current);
      }
      textModTimer.current = setTimeout(() => {
        textModTimer.current = null;
        sendTextUpsert(t as IText);
      }, MODIFY_DEBOUNCE_MS);
    };

    const onImg = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "Image" && (t as FabricObject & { get?: (k: string) => string }).get?.("type") !== "Image") {
        return;
      }
      sendImageUpsert(t);
    };

    const onImgModified = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "Image" && (t as FabricObject & { get?: (k: string) => string }).get?.("type") !== "Image") {
        return;
      }
      if (imgModTimer.current) {
        clearTimeout(imgModTimer.current);
      }
      imgModTimer.current = setTimeout(() => {
        imgModTimer.current = null;
        sendImageUpsert(t);
      }, MODIFY_DEBOUNCE_MS);
    };

    const onDrawModified = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "Path" && t.type !== "path") {
        return;
      }
      if (drawModTimer.current) {
        clearTimeout(drawModTimer.current);
      }
      drawModTimer.current = setTimeout(() => {
        drawModTimer.current = null;
        sendPathUpsert(t);
      }, MODIFY_DEBOUNCE_MS);
    };

    const onPointer = (ev: PointerEvent) => {
      if (isRestoringRef.current || roomFullRef.current) {
        return;
      }
      if (performance.now() - lastCursorAtRef.current < CURSOR_THROTTLE_MS) {
        return;
      }
      lastCursorAtRef.current = performance.now();
      const b = boardContainerRef.current;
      if (!b) {
        return;
      }
      const r = b.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return;
      }
      const xPct = (ev.clientX - r.left) / r.width;
      const yPct = (ev.clientY - r.top) / r.height;
      if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) {
        return;
      }
      sendC({
        type: "collab-cursor",
        roomId,
        senderId: clientIdRef.current,
        name: nameRef.current,
        color: colorRef.current,
        xPct,
        yPct,
      });
    };

    const b = boardContainerRef.current;
    b?.addEventListener("pointermove", onPointer, { passive: true });
    drawC.on("path:created", onPath);
    textC.on("object:added", onText);
    textC.on("object:modified", onTextModified);
    imgC.on("object:added", onImg);
    imgC.on("object:modified", onImgModified);
    drawC.on("object:modified", onDrawModified);
    const onImgLayerRemoved = (e: { target?: FabricObject | null }) => {
      if (e.target) {
        emitRemove("img", e.target);
      }
    };
    const onTextLayerRemoved = (e: { target?: FabricObject | null }) => {
      if (e.target) {
        emitRemove("text", e.target);
      }
    };
    const onDrawLayerRemoved = (e: { target?: FabricObject | null }) => {
      if (e.target) {
        emitRemove("draw", e.target);
      }
    };
    imgC.on("object:removed", onImgLayerRemoved);
    textC.on("object:removed", onTextLayerRemoved);
    drawC.on("object:removed", onDrawLayerRemoved);
    const iv = setInterval(() => {
      setCursors((x) => x.filter((c) => Date.now() - c.updatedAt < CURSOR_TTL_MS));
    }, 2000);

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        void (async () => {
          const n0 = Object.keys(channel.presenceState()).length;
          if (n0 >= MAX_ROOM_PARTICIPANTS) {
            setRoomFull(true);
            return;
          }
          try {
            await channel.track({
              clientId: clientIdRef.current,
              name: nameRef.current,
              color: colorRef.current,
              at: new Date().toISOString(),
            });
          } catch {
            setRoomFull(true);
          }
        })();
      }
    });

    return () => {
      clearInterval(iv);
      if (textModTimer.current) {
        clearTimeout(textModTimer.current);
      }
      if (imgModTimer.current) {
        clearTimeout(imgModTimer.current);
      }
      if (drawModTimer.current) {
        clearTimeout(drawModTimer.current);
      }
      b?.removeEventListener("pointermove", onPointer);
      drawC.off("path:created", onPath);
      textC.off("object:added", onText);
      textC.off("object:modified", onTextModified);
      imgC.off("object:added", onImg);
      imgC.off("object:modified", onImgModified);
      drawC.off("object:modified", onDrawModified);
      imgC.off("object:removed", onImgLayerRemoved);
      textC.off("object:removed", onTextLayerRemoved);
      drawC.off("object:removed", onDrawLayerRemoved);
      void supabase.removeChannel(channel);
    };
  }, [enabled, canvasesReady, roomId, roomFull, getCanvas, isRestoringRef, imgCanvasRef, textCanvasRef, drawCanvasRef, boardContainerRef]);

  return {
    roomId,
    shareUrl,
    roomFull,
    cursors,
    participants: Math.max(participants, 1),
  };
}
