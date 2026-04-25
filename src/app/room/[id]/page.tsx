"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ROOM_PARAM } from "../../../../hooks/useCollaboration";

const PLAY_STORE_FALLBACK_URL = "https://google.com";

function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function RoomDeepLinkPage() {
  const params = useParams<{ id: string }>();
  const roomId = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const drawingId = searchParams.get("id") ?? searchParams.get("drawing");
  const webUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set(ROOM_PARAM, roomId);
    if (drawingId) {
      q.set("id", drawingId);
    }
    return `/?${q.toString()}`;
  }, [drawingId, roomId]);

  useEffect(() => {
    if (!roomId) {
      router.replace("/");
      return;
    }
    if (!isMobileDevice()) {
      router.replace(webUrl);
      return;
    }
    const appUrl = `myboard://room/${encodeURIComponent(roomId)}`;
    window.location.href = appUrl;
    const redirectTimer = window.setTimeout(() => {
      window.location.href = PLAY_STORE_FALLBACK_URL;
    }, 1400);
    return () => window.clearTimeout(redirectTimer);
  }, [roomId, router, webUrl]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-5">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">MyBoard</h1>
        <p className="mt-2 text-sm text-zinc-600">Пробуем открыть приложение по ссылке комнаты.</p>
        <a
          href={PLAY_STORE_FALLBACK_URL}
          className="mt-4 inline-flex rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Открыть в приложении
        </a>
      </div>
    </main>
  );
}
