import { useEffect, useMemo, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { v4 as uuidv4 } from "uuid";

import { supabase } from "../utils/supabaseClient";

const CHANNEL_NAME = "room-1";
const BROADCAST_EVENT = "canvas-sync";
const ROOM_QUERY_PARAM = "room";

type BroadcastPayload = {
  roomId: string;
  snapshot: unknown;
  senderId: string;
};

type RoomContext = {
  roomId: string;
  shareUrl: string;
};

const applySnapshot = async (canvas: Canvas, snapshot: unknown) => {
  await Promise.resolve(canvas.loadFromJSON(snapshot as never));
  canvas.renderAll();
};

const resolveRoomContext = (): RoomContext => {
  if (typeof window === "undefined") {
    return { roomId: "room-1", shareUrl: "" };
  }

  const url = new URL(window.location.href);
  const roomFromUrl = url.searchParams.get(ROOM_QUERY_PARAM);
  const resolvedRoomId = roomFromUrl || uuidv4();

  if (!roomFromUrl) {
    url.searchParams.set(ROOM_QUERY_PARAM, resolvedRoomId);
    window.history.replaceState({}, "", url.toString());
  }

  return {
    roomId: resolvedRoomId,
    shareUrl: url.toString(),
  };
};

export const useCollaboration = (mainCanvas: Canvas | null) => {
  const [roomContext] = useState<RoomContext>(() => resolveRoomContext());
  const clientIdRef = useRef(uuidv4());
  const isApplyingRemoteRef = useRef(false);
  const roomId = roomContext.roomId;
  const shareUrl = roomContext.shareUrl;

  useEffect(() => {
    if (!mainCanvas || !roomId) {
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME);

    const publishSnapshot = async () => {
      if (isApplyingRemoteRef.current) {
        return;
      }

      const payload: BroadcastPayload = {
        roomId,
        snapshot: mainCanvas.toJSON(),
        senderId: clientIdRef.current,
      };

      await channel.send({
        type: "broadcast",
        event: BROADCAST_EVENT,
        payload,
      });
    };

    const onCanvasChanged = () => {
      void publishSnapshot();
    };

    const onRemoteMessage = async (message: { payload?: BroadcastPayload }) => {
      const payload = message.payload;
      if (!payload || payload.roomId !== roomId) {
        return;
      }
      if (payload.senderId === clientIdRef.current) {
        return;
      }

      isApplyingRemoteRef.current = true;
      try {
        await applySnapshot(mainCanvas, payload.snapshot);
      } finally {
        isApplyingRemoteRef.current = false;
      }
    };

    channel.on("broadcast", { event: BROADCAST_EVENT }, (message) => {
      void onRemoteMessage(message as { payload?: BroadcastPayload });
    });
    void channel.subscribe();

    mainCanvas.on("path:created", onCanvasChanged);
    mainCanvas.on("object:added", onCanvasChanged);
    mainCanvas.on("object:modified", onCanvasChanged);
    mainCanvas.on("object:removed", onCanvasChanged);

    return () => {
      mainCanvas.off("path:created", onCanvasChanged);
      mainCanvas.off("object:added", onCanvasChanged);
      mainCanvas.off("object:modified", onCanvasChanged);
      mainCanvas.off("object:removed", onCanvasChanged);
      void supabase.removeChannel(channel);
    };
  }, [mainCanvas, roomId]);

  return useMemo(
    () => ({
      roomId,
      shareUrl,
    }),
    [roomId, shareUrl],
  );
};
