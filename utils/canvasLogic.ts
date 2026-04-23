import * as fabric from "fabric";
import {
  dataUrlToBlob,
  STORAGE_PATH_KEY,
  tryParseStoragePathFromPublicUrl,
  uploadImageBlob,
} from "./imageStorage";

export const SNAPSHOT_IMAGE_PROPS: string[] = [STORAGE_PATH_KEY, "crossOrigin"];

const A4_WIDTH_MM = 210;
const A5_HEIGHT_MM = 210;
export const MIN_IMAGE_WIDTH_RATIO = 0.3;
const IMAGE_GAP = 20;

void (function registerImageStorageKey() {
  const C = fabric.FabricImage as unknown as { customProperties: string[] };
  if (!C.customProperties) {
    C.customProperties = [];
  }
  if (!C.customProperties.includes(STORAGE_PATH_KEY)) {
    C.customProperties = [...C.customProperties, STORAGE_PATH_KEY];
  }
})();

export function getMinDocumentHeightForWidth(width: number): number {
  return Math.max(320, Math.ceil((width / A4_WIDTH_MM) * A5_HEIGHT_MM));
}

export function assertImageJsonUsesRemoteSrcOnly(imgLayer: { objects?: unknown[] }): void {
  if (!Array.isArray(imgLayer.objects)) {
    return;
  }
  for (const o of imgLayer.objects) {
    if (!o || typeof o !== "object" || (o as { type?: string }).type !== "Image") {
      continue;
    }
    const src = (o as { src?: string }).src;
    if (
      typeof src === "string" &&
      (src.startsWith("data:") || src.startsWith("blob:") || !src.trim())
    ) {
      throw new Error(
        "Слой изображений нельзя сохранить: сначала загрузите картинки в облако (встроенные данные отсутствуют).",
      );
    }
  }
}

/** Патчит JSON для loadFromJSON: CORS, без сброса transform через setSrc. */
export function patchImageLayerForLoad(layer: unknown): Record<string, unknown> {
  if (!layer || typeof layer !== "object") {
    return { objects: [] };
  }
  const clone = JSON.parse(JSON.stringify(layer)) as Record<string, unknown>;
  const list = clone.objects;
  if (!Array.isArray(list)) {
    clone.objects = [];
    return clone;
  }
  for (const o of list) {
    if (o && typeof o === "object" && (o as { type?: string }).type === "Image") {
      const img = o as { src?: string; crossOrigin?: string | null };
      if (img.src && (img.src.startsWith("http://") || img.src.startsWith("https://"))) {
        img.crossOrigin = "anonymous";
      }
    }
  }
  return clone;
}

/**
 * Data/blob URL → Supabase, чтобы в JSON остались только публичные ссылки.
 */
export async function prepareImageLayerForSnapshot(imgCanvas: fabric.Canvas): Promise<void> {
  for (const obj of imgCanvas.getObjects()) {
    if (!(obj instanceof fabric.FabricImage)) {
      continue;
    }
    const src = obj.getSrc();
    if (!src) {
      continue;
    }
    if (src.startsWith("http://") || src.startsWith("https://")) {
      if (!obj.get(STORAGE_PATH_KEY)) {
        const p = tryParseStoragePathFromPublicUrl(src);
        if (p) {
          obj.set(STORAGE_PATH_KEY, p);
        }
      }
      continue;
    }
    if (src.startsWith("data:")) {
      const blob = dataUrlToBlob(src);
      const { publicUrl, storagePath } = await uploadImageBlob(blob, {
        contentType: blob.type,
      });
      await obj.setSrc(publicUrl, { crossOrigin: "anonymous" });
      obj.set({ [STORAGE_PATH_KEY]: storagePath, crossOrigin: "anonymous" });
      imgCanvas.requestRenderAll();
    } else if (src.startsWith("blob:")) {
      const res = await fetch(src);
      const blob = await res.blob();
      const { publicUrl, storagePath } = await uploadImageBlob(blob, {
        contentType: blob.type,
      });
      await obj.setSrc(publicUrl, { crossOrigin: "anonymous" });
      obj.set({ [STORAGE_PATH_KEY]: storagePath, crossOrigin: "anonymous" });
      imgCanvas.requestRenderAll();
    }
  }
}

export type InsertImageFromFileContext = {
  getBoardContainerWidth: () => number;
  getFallbackCanvasWidth: () => number;
  onRecalcHeight: () => void;
  onRequestSave: () => void;
  getLastInsertedImage: () => fabric.FabricImage | null;
  setLastInsertedImage: (image: fabric.FabricImage | null) => void;
};

/**
 * Загрузка файла в Storage, вставка на холст с подбором масштаба и позиции.
 */
export async function insertImageFromFile(
  file: File,
  imgCanvas: fabric.Canvas,
  ctx: InsertImageFromFileContext,
): Promise<void> {
  ctx.onRecalcHeight();

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1)
    : "png";
  const { publicUrl, storagePath } = await uploadImageBlob(file, {
    contentType: file.type || "image/png",
    extension: ext,
  });

  let canvasWidth = imgCanvas.getWidth();
  let canvasHeightCurrent = imgCanvas.getHeight();
  if (canvasWidth <= 1 || canvasHeightCurrent <= 1) {
    const measuredWidth = ctx.getBoardContainerWidth() || ctx.getFallbackCanvasWidth();
    const minHeight = getMinDocumentHeightForWidth(measuredWidth);
    imgCanvas.setDimensions({ width: measuredWidth, height: minHeight });
    canvasWidth = imgCanvas.getWidth();
    canvasHeightCurrent = imgCanvas.getHeight();
  }

  const image = await fabric.FabricImage.fromURL(publicUrl, {
    crossOrigin: "anonymous",
  });
  image.set({ [STORAGE_PATH_KEY]: storagePath, crossOrigin: "anonymous" });
  const sourceWidth = image.width ?? canvasWidth;
  const minImageWidth = MIN_IMAGE_WIDTH_RATIO * canvasWidth;

  const scaleDownToFit = Math.min(1, canvasWidth / sourceWidth);
  const scaleUpToMinimum = minImageWidth / sourceWidth;
  const nextScale = Math.max(scaleUpToMinimum, scaleDownToFit);
  const scaledWidth = sourceWidth * nextScale;
  image.scale(nextScale);

  const previousInsertedImage = ctx.getLastInsertedImage();
  const hasPreviousInsertedImage =
    previousInsertedImage && imgCanvas.getObjects().includes(previousInsertedImage);
  const previousBottom =
    hasPreviousInsertedImage && previousInsertedImage
      ? previousInsertedImage.getBoundingRect().top + previousInsertedImage.getBoundingRect().height
      : imgCanvas
          .getObjects()
          .filter((obj): obj is fabric.FabricImage => obj instanceof fabric.FabricImage)
          .reduce((maxBottom, imgObj) => {
            const rect = imgObj.getBoundingRect();
            return Math.max(maxBottom, rect.top + rect.height);
          }, 0);
  const nextTop = previousBottom > 0 ? previousBottom + IMAGE_GAP : 50;

  const clampImageScaleToBounds = () => {
    const maxWidth = imgCanvas.getWidth();
    const minWidth = MIN_IMAGE_WIDTH_RATIO * maxWidth;
    const currentWidth = image.getScaledWidth();
    if (currentWidth > maxWidth) {
      image.scaleToWidth(maxWidth);
    } else if (currentWidth < minWidth) {
      image.scaleToWidth(minWidth);
    }
  };

  image.on("scaling", () => {
    const uniformScale = Math.max(image.scaleX ?? 1, image.scaleY ?? 1);
    image.set({
      scaleX: uniformScale,
      scaleY: uniformScale,
    });
    clampImageScaleToBounds();
  });

  image.set({
    originX: "left",
    originY: "top",
    left: (canvasWidth - scaledWidth) / 2,
    top: nextTop,
    selectable: true,
    evented: true,
  });
  clampImageScaleToBounds();
  imgCanvas.add(image);
  imgCanvas.sendObjectToBack(image);
  imgCanvas.setActiveObject(image);
  ctx.setLastInsertedImage(image);
  imgCanvas.renderAll();
  ctx.onRecalcHeight();
  ctx.onRequestSave();
}
