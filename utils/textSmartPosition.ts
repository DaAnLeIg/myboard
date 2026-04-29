import type { Canvas, IText, Textbox } from "fabric";
import * as fabric from "fabric";

export type SmartTextPosition = { left: number; top: number };

const DEFAULT_GAP_PX = 20;
const DEFAULT_LEFT_MARGIN_PX = 16;
const DEFAULT_TOP_ANCHOR_PX = 48;
const DEFAULT_RIGHT_MARGIN_PX = 16;

export function getSmartPosition(
  textCanvas: Canvas,
  newObject: IText | Textbox,
  opts?: {
    gapPx?: number;
    leftMarginPx?: number;
    topAnchorPx?: number;
    rightMarginPx?: number;
  },
): SmartTextPosition {
  // Простой алгоритм из ТЗ:
  // 1) берём последний текстовый объект на textCanvas
  // 2) пробуем разместить справа
  // 3) если не влезает — переносим ниже.
  const gapPx = opts?.gapPx ?? DEFAULT_GAP_PX;
  const leftMarginPx = opts?.leftMarginPx ?? DEFAULT_LEFT_MARGIN_PX;
  const topAnchorPx = opts?.topAnchorPx ?? DEFAULT_TOP_ANCHOR_PX;

  const canvasWidth = textCanvas.getWidth();

  const textObjects = textCanvas
    .getObjects()
    .filter(
      (o): o is IText | Textbox =>
        o instanceof fabric.IText ||
        o instanceof fabric.Textbox ||
        o.type === "i-text" ||
        o.type === "IText" ||
        o.type === "textbox" ||
        o.type === "TextBox",
    )
    .filter((o) => o.visible !== false);

  if (textObjects.length === 0) {
    return { left: 50, top: 50 };
  }

  const lastObj = textObjects[textObjects.length - 1];

  // Важно вызвать initDimensions до измерений (особенно для пустого текста).
  const baseLeft = typeof newObject.left === "number" ? newObject.left : leftMarginPx;
  const baseTop = typeof newObject.top === "number" ? newObject.top : topAnchorPx;
  newObject.set({ left: baseLeft, top: baseTop });
  newObject.initDimensions();

  const newW = newObject.getScaledWidth();
  const lastLeft = typeof lastObj.left === "number" ? lastObj.left : 0;
  const lastTop = typeof lastObj.top === "number" ? lastObj.top : 0;
  const lastW = lastObj.getScaledWidth();
  const lastH = lastObj.getScaledHeight();

  const candidateLeft = lastLeft + lastW + gapPx;
  const canFitRight = candidateLeft + newW <= canvasWidth - DEFAULT_RIGHT_MARGIN_PX;

  if (canFitRight) {
    return { left: candidateLeft, top: lastTop };
  }

  return { left: leftMarginPx, top: lastTop + lastH + gapPx };
}

