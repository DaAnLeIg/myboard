import { supabase } from "./supabaseClient";
import { getOrCreateOwnerToken } from "./ownerToken";

export type CanvasSnapshot = {
  imgLayer: unknown;
  textLayer: unknown;
  drawLayer: unknown;
  /** Ширина холста при сохранении (все три слоя совпадают). Опционально для старых записей. */
  canvasWidth?: number;
  canvasHeight: number;
  savedAt: string;
};

export type DrawingRow = {
  id: string;
  created_at: string;
  name: string;
  content: CanvasSnapshot;
  preview_url: string | null;
  room_id: string | null;
};

type CreateDrawingInput = {
  name: string;
  content: CanvasSnapshot;
  previewUrl?: string | null;
  roomId?: string | null;
};

type UpdateDrawingInput = {
  id: string;
  name?: string;
  content?: CanvasSnapshot;
  previewUrl?: string | null;
  roomId?: string | null;
};

export async function createDrawing(input: CreateDrawingInput) {
  const ownerToken = getOrCreateOwnerToken();
  const { data, error } = await supabase
    .from("drawings")
    .insert({
      name: input.name,
      content: input.content,
      preview_url: input.previewUrl ?? null,
      room_id: input.roomId ?? null,
      owner_token: ownerToken,
    })
    .select("id, created_at, name, content, preview_url, room_id")
    .single();

  if (error) {
    throw error;
  }

  return data as DrawingRow;
}

export async function listDrawings(limit = 30) {
  const ownerToken = getOrCreateOwnerToken();
  let { data, error } = await supabase
    .from("drawings")
    .select("id, created_at, name, content, preview_url, room_id")
    .eq("owner_token", ownerToken)
    .order("created_at", { ascending: false })
    .limit(limit);

  const errCode =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;
  const errMessage = error?.message ?? "";
  const shouldFallbackToLegacyQuery =
    errCode === "42703" || /owner_token/i.test(errMessage);

  // Backward compatibility: in databases where owner_token migration
  // has not been applied yet, fall back to a legacy read query.
  if (shouldFallbackToLegacyQuery) {
    const fallback = await supabase
      .from("drawings")
      .select("id, created_at, name, content, preview_url, room_id")
      .order("created_at", { ascending: false })
      .limit(limit);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as DrawingRow[];
}

export async function getDrawingById(id: string) {
  const ownerToken = getOrCreateOwnerToken();
  const { data, error } = await supabase
    .from("drawings")
    .select("id, created_at, name, content, preview_url, room_id")
    .eq("id", id)
    .eq("owner_token", ownerToken)
    .single();

  if (error) {
    throw error;
  }

  return data as DrawingRow;
}

export async function getLatestDrawingByRoom(roomId: string) {
  const ownerToken = getOrCreateOwnerToken();
  const { data, error } = await supabase
    .from("drawings")
    .select("id, created_at, name, content, preview_url, room_id")
    .eq("room_id", roomId)
    .eq("owner_token", ownerToken)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as DrawingRow | null;
}

export async function updateDrawing(input: UpdateDrawingInput) {
  const ownerToken = getOrCreateOwnerToken();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.content !== undefined) {
    patch.content = input.content;
  }
  if (input.previewUrl !== undefined) {
    patch.preview_url = input.previewUrl;
  }
  if (input.roomId !== undefined) {
    patch.room_id = input.roomId;
  }

  const { data, error } = await supabase
    .from("drawings")
    .update(patch)
    .eq("id", input.id)
    .eq("owner_token", ownerToken)
    .select("id, created_at, name, content, preview_url, room_id")
    .single();

  if (error) {
    throw error;
  }

  return data as DrawingRow;
}

export async function deleteDrawingById(id: string) {
  const ownerToken = getOrCreateOwnerToken();
  const { error } = await supabase
    .from("drawings")
    .delete()
    .eq("id", id)
    .eq("owner_token", ownerToken);
  if (error) {
    throw error;
  }
}
