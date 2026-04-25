import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Canvas,
  type FabricObject,
  FabricImage,
  IText,
  Path,
  Textbox,
  util,
} from "fabric";
import { decode as decodeMsgPack, encode as encodeMsgPack } from "@msgpack/msgpack";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabaseClient";
import { STORAGE_PATH_KEY } from "../utils/imageStorage";

const BROADCAST_ADD_OBJECT = "collab-object-add";
const BROADCAST_REMOVE_OBJECT = "collab-object-remove";
const BROADCAST_CURSOR = "collab-cursor";
/** Параметр URL комнаты совместной работы (`?room=…`). */
export const ROOM_PARAM = "room";
export const MAX_ROOM_PARTICIPANTS = 10;
const COLLAB_ID_KEY = "mbCollabId";

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
  addCustomProp(Textbox, COLLAB_ID_KEY);
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

export type LayerId = "img" | "text" | "draw";

type ObjectAddPayload = {
  type: "collab-object-add";
  roomId: string;
  senderId: string;
  layer: LayerId;
  object: Record<string, unknown>;
};

type EncodedPayload = {
  codec: "msgpack-base64-v1";
  data: string;
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
const DRAW_COORDS_THROTTLE_MS = 24;

type DrawEnvelope = {
  action: "draw" | "add";
  type: string;
  data: Record<string, unknown>;
};

function isFabricImageType(t: string | undefined): boolean {
  return t === "Image" || t === "image";
}

function isFabricTextType(t: string | undefined): boolean {
  return t === "IText" || t === "i-text" || t === "textbox" || t === "TextBox";
}

function applyCrossOriginToImageData(obj: Record<string, unknown>) {
  if (
    isFabricImageType(obj.type as string) &&
    typeof (obj as { src?: string }).src === "string"
  ) {
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

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    throw new Error("collab: btoa is unavailable");
  }
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof window === "undefined" || typeof window.atob !== "function") {
    throw new Error("collab: atob is unavailable");
  }
  const binary = window.atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function packPayload<T extends object>(payload: T): EncodedPayload {
  return {
    codec: "msgpack-base64-v1",
    data: bytesToBase64(encodeMsgPack(payload)),
  };
}

function unpackPayload<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const encoded = raw as Partial<EncodedPayload>;
  if (encoded.codec !== "msgpack-base64-v1" || typeof encoded.data !== "string") {
    return null;
  }
  try {
    return decodeMsgPack(base64ToBytes(encoded.data)) as T;
  } catch (e) {
    console.warn("collab: msgpack decode failed", e);
    return null;
  }
}

function findObjectByCollabId(
  canvas: Canvas,
  collabId: string,
): FabricObject | undefined {
  return canvas.getObjects().find((o) => {
    const v = (o as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY);
    return typeof v === "string" && v === collabId;
  });
}

function getRemoteImageSrc(obj: FabricObject): string | undefined {
  const getSrc = (obj as FabricImage & { getSrc?: () => string }).getSrc;
  if (typeof getSrc === "function") {
    const s = getSrc.call(obj);
    if (typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"))) {
      return s;
    }
  }
  const el = (obj as FabricImage & { getElement?: () => unknown }).getElement?.();
  if (el instanceof HTMLImageElement && el.src) {
    if (el.src.startsWith("http://") || el.src.startsWith("https://")) {
      return el.src;
    }
  }
  return undefined;
}

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

function wrapDrawEvent(
  action: DrawEnvelope["action"],
  objectType: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    action,
    type: objectType,
    data,
  };
}

function unwrapDrawEvent(payload: Record<string, unknown>): Record<string, unknown> {
  const action = payload.action;
  const t = payload.type;
  const data = payload.data;
  if (
    (action === "draw" || action === "add") &&
    typeof t === "string" &&
    data &&
    typeof data === "object"
  ) {
    return {
      ...(data as Record<string, unknown>),
      type: t,
    };
  }
  return payload;
}

/** Применение сериализованного объекта (broadcast / Supabase) к слою. */
export async function upsertObjectOnCanvas(
  layer: LayerId,
  raw: Record<string, unknown>,
  getCanvas: (layer: LayerId) => Canvas | null,
  isApplyingRemoteRef: { current: boolean },
): Promise<void> {
  const data = unwrapDrawEvent(raw);
  const canvas = getCanvas(layer);
  if (!canvas) {
    return;
  }

  const collabId = data[COLLAB_ID_KEY] as string | undefined;
  const existing =
    collabId && collabId.length > 0 ? findObjectByCollabId(canvas, collabId) : undefined;

  isApplyingRemoteRef.current = true;
  try {
    if (isFabricImageType(data.type as string) && typeof (data as { src?: string }).src === "string") {
      const src = (data as { src: string }).src;
      const isRemote = src.startsWith("http://") || src.startsWith("https://");
      if (!isRemote) {
        return;
      }

      if (existing && isFabricImageType(existing.type)) {
        const prevSrc = getRemoteImageSrc(existing);
        const tr = pickTransform(data);
        if (typeof prevSrc === "string" && prevSrc !== src) {
          canvas.remove(existing);
          const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
          img.set(tr);
          if (data[STORAGE_PATH_KEY] != null) {
            (img as FabricObject & { set: (a: object) => void }).set({
              [STORAGE_PATH_KEY]: data[STORAGE_PATH_KEY],
              crossOrigin: (data as { crossOrigin?: string | null }).crossOrigin ?? "anonymous",
            });
          } else {
            (img as FabricObject & { set: (a: object) => void }).set({ crossOrigin: "anonymous" });
          }
          if (collabId) {
            (img as FabricObject & { set: (k: string, v: string) => void }).set(COLLAB_ID_KEY, collabId);
          }
          canvas.add(img);
        } else {
          existing.set({
            ...tr,
            crossOrigin: (data as { crossOrigin?: string | null }).crossOrigin ?? "anonymous",
          });
          if (data[STORAGE_PATH_KEY] != null) {
            (existing as FabricObject & { set: (a: object) => void }).set({
              [STORAGE_PATH_KEY]: data[STORAGE_PATH_KEY],
            });
          }
        }
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }

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
        (img as FabricObject & { set: (k: string, v: string) => void }).set(COLLAB_ID_KEY, collabId);
      }
      canvas.add(img);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }

    if (existing && collabId) {
      const incomingPath =
        data.type === "path" || data.type === "Path";
      const isPathObj = existing.type === "path" || existing.type === "Path";
      if (incomingPath && isPathObj) {
        const nextPath = (data as { path?: unknown }).path;
        existing.set({
          ...pickTransform(data),
          ...(Array.isArray(nextPath) ? { path: nextPath } : {}),
          fill: (data as { fill?: unknown }).fill,
          stroke: (data as { stroke?: unknown }).stroke,
          strokeWidth: (data as { strokeWidth?: unknown }).strokeWidth,
          globalCompositeOperation: (data as { globalCompositeOperation?: unknown })
            .globalCompositeOperation,
        } as object);
        canvas.requestRenderAll();
        return;
      }
      const incomingText = isFabricTextType(data.type as string | undefined);
      const isTextObj = isFabricTextType(existing.type as string | undefined);
      if (incomingText && isTextObj) {
        existing.set({
          ...pickTransform(data),
          text: (data as { text?: string }).text,
          fontSize: (data as { fontSize?: number }).fontSize,
          fontFamily: (data as { fontFamily?: string }).fontFamily,
          fill: (data as { fill?: unknown }).fill,
          width: (data as { width?: number }).width,
        } as object);
        canvas.requestRenderAll();
        return;
      }
    }

    if (isFabricTextType(data.type as string | undefined)) {
      const text = typeof (data as { text?: unknown }).text === "string" ? (data as { text: string }).text : "";
      const box = new Textbox(text, {
        ...pickTransform(data),
        width: (data as { width?: number }).width ?? 320,
        fontSize: (data as { fontSize?: number }).fontSize,
        fontFamily: (data as { fontFamily?: string }).fontFamily,
        fill: (data as { fill?: unknown }).fill as string | undefined,
      });
      if (collabId) {
        (box as FabricObject & { set: (k: string, v: string) => void }).set(COLLAB_ID_KEY, collabId);
      }
      canvas.add(box);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;
    }

    const copy = { ...data };
    applyCrossOriginToImageData(copy);
    const [el] = await util.enlivenObjects<FabricObject>([copy], {});
    if (!el) {
      return;
    }
    if (collabId) {
      (el as FabricObject & { set: (k: string, v: string) => void }).set(COLLAB_ID_KEY, collabId);
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

export function removeObjectByCollabId(
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
  const drawLastSentAtRef = useRef(0);
  const lastPathSendRef = useRef<{ collabId: string; at: number } | null>(null);

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
      const p = unpackPayload<ObjectAddPayload>(message.payload);
      if (!p || p.type !== "collab-object-add" || p.roomId !== roomId) {
        return;
      }
      if (p.senderId === clientIdRef.current) {
        return;
      }
      console.log("Получено:", p);
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
      const p = unpackPayload<ObjectRemovePayload>(message.payload);
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
      const p = unpackPayload<CursorPayload>(message.payload);
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
      const data = {
        type: "broadcast",
        event: BROADCAST_ADD_OBJECT,
        payload: packPayload(payload),
      };
      console.log("Отправлено:", data);
      void channel.send(data).catch((e: unknown) => console.warn("collab send", e));
    };

    const sendRemove = (payload: ObjectRemovePayload) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current || roomFullRef.current) {
        return;
      }
      void channel
        .send({
          type: "broadcast",
          event: BROADCAST_REMOVE_OBJECT,
          payload: packPayload(payload),
        })
        .catch((e: unknown) => console.warn("collab send remove", e));
    };

    const sendC = (cursorPayload: CursorPayload) => {
      if (roomFullRef.current) {
        return;
      }
      void channel
        .send({
          type: "broadcast",
          event: BROADCAST_CURSOR,
          payload: packPayload(cursorPayload),
        })
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

    const sendTextUpsert = (o: FabricObject) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      if (!isFabricTextType(o.type as string | undefined)) {
        return;
      }
      ensureCollabId(o);
      const textObj = o as IText | Textbox;
      const d: Record<string, unknown> = {
        type: "textbox",
        left: textObj.left,
        top: textObj.top,
        scaleX: textObj.scaleX,
        scaleY: textObj.scaleY,
        angle: textObj.angle,
        opacity: textObj.opacity,
        originX: textObj.originX,
        originY: textObj.originY,
        text: textObj.text,
        width: (textObj as Textbox).width,
        fontSize: textObj.fontSize,
        fontFamily: textObj.fontFamily,
        fill: textObj.fill,
      };
      d[COLLAB_ID_KEY] = (textObj as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY);
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "text",
        object: wrapDrawEvent("add", "textbox", d),
      });
    };

    const sendImageUpsert = (obj: FabricObject) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current) {
        return;
      }
      if (!isFabricImageType(obj.type)) {
        return;
      }
      ensureCollabId(obj);
      const src = getRemoteImageSrc(obj);
      if (!src) {
        return;
      }
      const storagePath = (obj as FabricObject & { get: (k: string) => unknown }).get(
        STORAGE_PATH_KEY,
      );
      const d: Record<string, unknown> = {
        type: "image",
        src,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        opacity: obj.opacity,
        originX: obj.originX,
        originY: obj.originY,
      };
      d[COLLAB_ID_KEY] = (obj as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      );
      if (storagePath != null) {
        d[STORAGE_PATH_KEY] = storagePath;
      }
      const co = (obj as FabricObject & { get: (k: string) => unknown }).get("crossOrigin");
      if (co != null) {
        d.crossOrigin = co;
      }
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "img",
        object: wrapDrawEvent("add", "image", d),
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
      const pathObj = o as Path;
      const d: Record<string, unknown> = {
        type: "path",
        left: o.left,
        top: o.top,
        scaleX: o.scaleX,
        scaleY: o.scaleY,
        angle: o.angle,
        opacity: o.opacity,
        originX: o.originX,
        originY: o.originY,
        stroke: o.stroke,
        strokeWidth: o.strokeWidth,
        strokeLineCap: o.strokeLineCap,
        strokeLineJoin: o.strokeLineJoin,
        globalCompositeOperation: o.globalCompositeOperation,
        path: pathObj.path,
      };
      d[COLLAB_ID_KEY] = (o as FabricObject & { get: (k: string) => unknown }).get(COLLAB_ID_KEY);
      sendAdd({
        type: "collab-object-add",
        roomId,
        senderId: clientIdRef.current,
        layer: "draw",
        object: wrapDrawEvent("draw", "path", d),
      });
    };

    const broadcastFinishedDrawPath = (t: FabricObject | null | undefined) => {
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "Path" && t.type !== "path") {
        return;
      }
      ensureCollabId(t);
      const collabId = (t as FabricObject & { get: (k: string) => unknown }).get(
        COLLAB_ID_KEY,
      ) as string;
      const now = Date.now();
      const prev = lastPathSendRef.current;
      if (prev && prev.collabId === collabId && now - prev.at < 150) {
        return;
      }
      lastPathSendRef.current = { collabId, at: now };
      sendPathUpsert(t);
    };

    const onDrawMouseUp = (e: { target?: FabricObject | null }) => {
      broadcastFinishedDrawPath(e.target ?? null);
    };

    const onPathCreatedCollab = (e: { path?: FabricObject | null }) => {
      broadcastFinishedDrawPath(e.path ?? null);
    };

    const onText = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (!isFabricTextType(t.type as string | undefined)) {
        return;
      }
      sendTextUpsert(t);
    };

    const onTextModified = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (!isFabricTextType(t.type as string | undefined)) {
        return;
      }
      if (textModTimer.current) {
        clearTimeout(textModTimer.current);
      }
      textModTimer.current = setTimeout(() => {
        textModTimer.current = null;
        sendTextUpsert(t);
      }, MODIFY_DEBOUNCE_MS);
    };

    const onImg = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (!isFabricImageType(t.type)) {
        return;
      }
      sendImageUpsert(t);
    };

    const onImgModified = (e: { target: FabricObject | null }) => {
      const t = e.target;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (!isFabricImageType(t.type)) {
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
      const now = performance.now();
      if (now - drawLastSentAtRef.current < DRAW_COORDS_THROTTLE_MS) {
        return;
      }
      drawLastSentAtRef.current = now;
      sendPathUpsert(t);
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
    drawC.on("mouse:up", onDrawMouseUp);
    drawC.on("path:created", onPathCreatedCollab);
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
      b?.removeEventListener("pointermove", onPointer);
      drawC.off("mouse:up", onDrawMouseUp);
      drawC.off("path:created", onPathCreatedCollab);
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
