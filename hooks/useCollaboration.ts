import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas as FabricCanvas, type FabricObject, util } from "fabric";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabaseClient";
import { STORAGE_PATH_KEY } from "../utils/imageStorage";

const BROADCAST_ADD_OBJECT = "collab-object-add";
const BROADCAST_CURSOR = "collab-cursor";
const ROOM_PARAM = "room";
export const MAX_ROOM_PARTICIPANTS = 10;
const SNAPSHOT_PROPS: string[] = [STORAGE_PATH_KEY, "crossOrigin"];
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

function applyCrossOriginToImageData(obj: Record<string, unknown>) {
  if (obj.type === "Image" && typeof (obj as { src?: string }).src === "string") {
    const s = (obj as { src: string }).src;
    if (s.startsWith("http://") || s.startsWith("https://")) {
      (obj as { crossOrigin: string | null }).crossOrigin = "anonymous";
    }
  }
}

export type UseRoomCollabInput = {
  enabled: boolean;
  canvasesReady: boolean;
  isRestoringRef: React.MutableRefObject<boolean>;
  imgCanvasRef: React.RefObject<FabricCanvas | null>;
  textCanvasRef: React.RefObject<FabricCanvas | null>;
  drawCanvasRef: React.RefObject<FabricCanvas | null>;
  boardContainerRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Realtime: remote JSON → util.enlivenObjects + canvas.add, чужие курсоры, max 10 presence.
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

  const addObjectToCanvas = useCallback(
    async (layer: LayerId, data: Record<string, unknown>) => {
      const canvas = getCanvas(layer);
      if (!canvas) {
        return;
      }
      applyCrossOriginToImageData(data);
      isApplyingRemoteRef.current = true;
      try {
        const [el] = await util.enlivenObjects<FabricObject>([data], {});
        if (!el) {
          return;
        }
        canvas.add(el);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      } catch (e) {
        console.warn("collab: util.enlivenObjects failed", e);
      } finally {
        isApplyingRemoteRef.current = false;
      }
    },
    [getCanvas],
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

    const onObject = (message: { payload?: ObjectAddPayload }) => {
      const p = message.payload;
      if (!p || p.type !== "collab-object-add" || p.roomId !== roomId) {
        return;
      }
      if (p.senderId === clientIdRef.current) {
        return;
      }
      if (p.object) {
        void addObjectToCanvas(p.layer, p.object);
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
      .on("broadcast", { event: BROADCAST_ADD_OBJECT }, onObject)
      .on("broadcast", { event: BROADCAST_CURSOR }, onCur);

    const sendAdd = (payload: ObjectAddPayload) => {
      if (isApplyingRemoteRef.current || isRestoringRef.current || roomFullRef.current) {
        return;
      }
      void channel
        .send({ type: "broadcast", event: BROADCAST_ADD_OBJECT, payload })
        .catch((e: unknown) => console.warn("collab send", e));
    };

    const sendC = (cursorPayload: CursorPayload) => {
      if (roomFullRef.current) {
        return;
      }
      void channel
        .send({ type: "broadcast", event: BROADCAST_CURSOR, payload: cursorPayload })
        .catch((e: unknown) => console.warn("collab cursor", e));
    };

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

    const onPath = (e: { path?: unknown }) => {
      const p = e.path;
      if (!p || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      const o = p as FabricObject;
      if (!o.toObject) {
        return;
      }
      const d = o.toObject() as Record<string, unknown>;
      if (d.type) {
        sendAdd({
          type: "collab-object-add",
          roomId,
          senderId: clientIdRef.current,
          layer: "draw",
          object: d,
        });
      }
    };

    const onText = (e: { target: unknown }) => {
      const t = e.target as { get?: (k: string) => string; toObject?: () => object; type?: string } | null;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "IText" && t.get?.("type") !== "IText") {
        return;
      }
      const d = t.toObject?.() as Record<string, unknown> | undefined;
      if (d?.type) {
        sendAdd({
          type: "collab-object-add",
          roomId,
          senderId: clientIdRef.current,
          layer: "text",
          object: d,
        });
      }
    };

    const onImg = (e: { target: unknown }) => {
      const t = e.target as {
        toObject: (a?: string[]) => object;
        get?: (k: string) => string;
        type?: string;
      } | null;
      if (!t || isRestoringRef.current || isApplyingRemoteRef.current) {
        return;
      }
      if (t.type !== "Image" && t.get?.("type") !== "Image") {
        return;
      }
      const d = t.toObject(SNAPSHOT_PROPS) as Record<string, unknown>;
      if (d.type) {
        sendAdd({
          type: "collab-object-add",
          roomId,
          senderId: clientIdRef.current,
          layer: "img",
          object: d,
        });
      }
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
    imgC.on("object:added", onImg);
    const iv = setInterval(() => {
      setCursors((x) => x.filter((c) => Date.now() - c.updatedAt < CURSOR_TTL_MS));
    }, 2000);

    return () => {
      clearInterval(iv);
      b?.removeEventListener("pointermove", onPointer);
      drawC.off("path:created", onPath);
      textC.off("object:added", onText);
      imgC.off("object:added", onImg);
      void supabase.removeChannel(channel);
    };
  }, [enabled, canvasesReady, roomId, roomFull, addObjectToCanvas, isRestoringRef, imgCanvasRef, textCanvasRef, drawCanvasRef, boardContainerRef]);

  return {
    roomId,
    shareUrl,
    roomFull,
    cursors,
    participants: Math.max(participants, 1),
  };
}
