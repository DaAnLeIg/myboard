import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabaseClient";

export const IMAGES_BUCKET = "images";
/** Сериализуем в JSON рядом с `src` для путей удаления из Storage. */
export const STORAGE_PATH_KEY = "mbStoragePath";

const PUBLIC_SEGMENT = "/object/public/";

/**
 * Путь в бакете по публичной ссылке Supabase Storage, если URL наш.
 */
export function tryParseStoragePathFromPublicUrl(
  publicUrl: string,
  bucket: string = IMAGES_BUCKET,
): string | null {
  if (!publicUrl.startsWith("http://") && !publicUrl.startsWith("https://")) {
    return null;
  }
  const marker = `${PUBLIC_SEGMENT}${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  return publicUrl.slice(idx + marker.length) || null;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) {
    throw new Error("Некорректный data URL");
  }
  const binary = atob(m[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: m[1] || "image/png" });
}

function extensionFromMime(mime: string, fallback: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mime] ?? fallback;
}

export type UploadResult = { publicUrl: string; storagePath: string };
const A4_MAX_WIDTH_PX = 2480;
const A4_JPEG_QUALITY = 0.8;

async function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image for compression"));
    };
    img.src = objectUrl;
  });
}

async function compressImageForA4(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/")) {
    return blob;
  }
  const img = await blobToImageElement(blob);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (width <= 0 || height <= 0) {
    return blob;
  }
  if (width <= A4_MAX_WIDTH_PX) {
    return blob;
  }
  const targetWidth = A4_MAX_WIDTH_PX;
  const targetHeight = Math.max(1, Math.round((height * targetWidth) / width));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return blob;
  }
  context.drawImage(img, 0, 0, targetWidth, targetHeight);
  return await new Promise((resolve) => {
    canvas.toBlob(
      (resizedBlob) => resolve(resizedBlob ?? blob),
      "image/jpeg",
      A4_JPEG_QUALITY,
    );
  });
}

/**
 * Загружает бинарные данные в бакет `images`, возвращает публичный URL и путь в бакете.
 */
export async function uploadImageBlob(
  blob: Blob,
  opts?: { extension?: string; contentType?: string },
): Promise<UploadResult> {
  const preparedBlob = await compressImageForA4(blob);
  const ext =
    opts?.extension ??
    extensionFromMime(opts?.contentType || preparedBlob.type || blob.type || "image/png", "png");
  const storagePath = `uploads/${uuidv4()}.${ext}`;
  const contentType =
    opts?.contentType ||
    preparedBlob.type ||
    blob.type ||
    (ext === "png" ? "image/png" : "application/octet-stream");

  const { error: uploadError } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(storagePath, preparedBlob, { contentType, upsert: false, cacheControl: "3600" });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

export async function removeStorageObjects(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) {
    return;
  }
  const { error } = await supabase.storage.from(IMAGES_BUCKET).remove(unique);
  if (error) {
    console.warn("Storage remove failed:", error.message);
  }
}
