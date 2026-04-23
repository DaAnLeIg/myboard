"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as fabric from "fabric";
import { supabase } from "../utils/supabaseClient";
import {
  type CanvasSnapshot,
  createDrawing,
  getDrawingById,
} from "../utils/drawingsApi";

type Tool = "pencil" | "eraser" | "text";
type FabricWithEraser = typeof fabric & {
  EraserBrush?: new (canvas: fabric.Canvas) => fabric.BaseBrush;
};

const TEXT_FONT_SIZE = 14;
const TEXT_HORIZONTAL_PADDING = 14;
const A4_WIDTH_MM = 210;
const A5_HEIGHT_MM = 210;
const DOCUMENT_BOTTOM_PADDING = 24;
const MIN_IMAGE_WIDTH_RATIO = 0.3;
const TOOLBAR_HEIGHT_PX = 72;
const SUPABASE_CANVAS_TABLE = "canvas_documents";
const SUPABASE_DOCUMENT_ID = "default";
const SAVE_DEBOUNCE_MS = 800;

type CanvasProps = {
  selectedDrawingId?: string | null;
};

export default function Canvas({ selectedDrawingId = null }: CanvasProps) {
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const imgCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const textCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const imgCanvasRef = useRef<fabric.Canvas | null>(null);
  const textCanvasRef = useRef<fabric.Canvas | null>(null);
  const drawCanvasRef = useRef<fabric.Canvas | null>(null);
  const lastTextObjectRef = useRef<fabric.IText | null>(null);
  const lastInsertedImageRef = useRef<fabric.FabricImage | null>(null);
  const recalcDocumentHeightRef = useRef<(() => void) | null>(null);
  const requestSaveRef = useRef<(() => void) | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const isLoadingDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeToolRef = useRef<Tool>("pencil");
  const isImageDeleteModeRef = useRef(false);
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [isImageActionsOpen, setIsImageActionsOpen] = useState(false);
  const [isImageDeleteMode, setIsImageDeleteMode] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [isSavingToDrawings, setIsSavingToDrawings] = useState(false);

  const buildDocumentSnapshot = (
    imgCanvas: fabric.Canvas,
    textCanvas: fabric.Canvas,
    drawCanvas: fabric.Canvas,
  ): CanvasSnapshot => {
    const width = drawCanvas.getWidth();
    const height = drawCanvas.getHeight();
    return {
      imgLayer: imgCanvas.toJSON(),
      textLayer: textCanvas.toJSON(),
      drawLayer: drawCanvas.toJSON(),
      canvasWidth: width,
      canvasHeight: height,
      savedAt: new Date().toISOString(),
    };
  };

  const setTextEditingVisuals = (text: fabric.IText) => {
    text.set({
      fontFamily: "Arial",
      fontSize: TEXT_FONT_SIZE,
      fill: "#000000",
      backgroundColor: "rgba(255,255,255,0.25)",
      padding: TEXT_HORIZONTAL_PADDING,
      borderColor: "rgba(255, 80, 80, 0.35)",
      editingBorderColor: "rgba(255, 80, 80, 0.55)",
      cursorColor: "#000000",
      selectionColor: "rgba(255, 80, 80, 0.15)",
      shadow: new fabric.Shadow({
        color: "rgba(255,255,255,0.8)",
        blur: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    });
  };

  const setTextIdleVisuals = (text: fabric.IText) => {
    text.set({
      fontFamily: "Arial",
      fontSize: TEXT_FONT_SIZE,
      fill: "#000000",
      backgroundColor: "rgba(255,255,255,0.25)",
      padding: TEXT_HORIZONTAL_PADDING,
      borderColor: "rgba(0,0,0,0)",
      editingBorderColor: "rgba(0,0,0,0)",
      shadow: null,
    });
  };

  const clearTextEditingVisuals = () => {
    const textCanvas = textCanvasRef.current;
    if (!textCanvas) {
      return;
    }

    const textObjects = textCanvas
      .getObjects()
      .filter((obj): obj is fabric.IText => obj instanceof fabric.IText);

    textObjects.forEach((text) => {
      if (text.isEditing) {
        text.exitEditing();
      }
      setTextIdleVisuals(text);
    });

    textCanvas.discardActiveObject();
    textCanvas.requestRenderAll();
  };

  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id") ?? searchParams.get("drawing");
  /** Сначала выбор из списка, иначе — открытие по ссылке `?id=` / `?drawing=`. */
  const drawingIdToLoad = selectedDrawingId ?? idFromUrl ?? null;

  /**
   * Восстанавливает три слоя из сохранённого JSON: изображения, текст, штрихи.
   */
  const loadDrawing = useCallback(
    async (data: CanvasSnapshot, opts?: { isCancelled?: () => boolean }) => {
      const isCancelled = opts?.isCancelled ?? (() => false);
      const imgCanvas = imgCanvasRef.current;
      const textCanvas = textCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!imgCanvas || !textCanvas || !drawCanvas) {
        return;
      }

      const snapshot = data;
      const currentWidth = drawCanvas.getWidth();
      const restoredWidth =
        typeof snapshot.canvasWidth === "number" ? snapshot.canvasWidth : currentWidth;
      const restoredHeight =
        typeof snapshot.canvasHeight === "number"
          ? snapshot.canvasHeight
          : drawCanvas.getHeight();

      imgCanvas.setDimensions({ width: restoredWidth, height: restoredHeight });
      textCanvas.setDimensions({ width: restoredWidth, height: restoredHeight });
      drawCanvas.setDimensions({ width: restoredWidth, height: restoredHeight });
      setCanvasHeight(restoredHeight);

      if (isCancelled()) {
        return;
      }

      await Promise.resolve(
        imgCanvas.loadFromJSON((snapshot.imgLayer ?? { objects: [] }) as never),
      );
      if (isCancelled()) {
        return;
      }
      await Promise.resolve(
        textCanvas.loadFromJSON((snapshot.textLayer ?? { objects: [] }) as never),
      );
      if (isCancelled()) {
        return;
      }
      await Promise.resolve(
        drawCanvas.loadFromJSON((snapshot.drawLayer ?? { objects: [] }) as never),
      );
      if (isCancelled()) {
        return;
      }

      imgCanvas.renderAll();
      textCanvas.renderAll();
      drawCanvas.renderAll();

      const images = imgCanvas
        .getObjects()
        .filter((obj): obj is fabric.FabricImage => obj instanceof fabric.FabricImage);
      const texts = textCanvas
        .getObjects()
        .filter((obj): obj is fabric.IText => obj instanceof fabric.IText);
      const lastImage = images.length > 0 ? images[images.length - 1] : null;
      const lastText = texts.length > 0 ? texts[texts.length - 1] : null;

      lastInsertedImageRef.current = lastImage;
      lastTextObjectRef.current = lastText;
      recalcDocumentHeightRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (
      !imgCanvasElementRef.current ||
      !textCanvasElementRef.current ||
      !drawCanvasElementRef.current
    ) {
      return;
    }

    const imgCanvas = new fabric.Canvas(imgCanvasElementRef.current, {
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: false,
    });
    const textCanvas = new fabric.Canvas(textCanvasElementRef.current, {
      backgroundColor: "rgba(0,0,0,0)",
      preserveObjectStacking: true,
    });
    const drawCanvas = new fabric.Canvas(drawCanvasElementRef.current, {
      backgroundColor: "rgba(0,0,0,0)",
      preserveObjectStacking: true,
      isDrawingMode: true,
      selection: false,
    });

    imgCanvasRef.current = imgCanvas;
    textCanvasRef.current = textCanvas;
    drawCanvasRef.current = drawCanvas;

    const queueSaveDocument = () => {
      if (isLoadingDrawingRef.current) {
        return;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (isSavingRef.current) {
          return;
        }

        isSavingRef.current = true;
        try {
          const imgLayer = imgCanvas.toJSON();
          const textLayer = textCanvas.toJSON();
          const drawLayer = drawCanvas.toJSON();
          const { error } = await supabase
            .from(SUPABASE_CANVAS_TABLE)
            .upsert(
              {
                id: SUPABASE_DOCUMENT_ID,
                img_layer: imgLayer,
                text_layer: textLayer,
                draw_layer: drawLayer,
                canvas_height: drawCanvas.getHeight(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            );

          if (error) {
            console.warn("Supabase save failed:", error.message);
          }
        } finally {
          isSavingRef.current = false;
        }
      }, SAVE_DEBOUNCE_MS);
    };
    requestSaveRef.current = queueSaveDocument;

    imgCanvas.wrapperEl.style.position = "absolute";
    imgCanvas.wrapperEl.style.inset = "0";
    imgCanvas.wrapperEl.style.left = "0";
    imgCanvas.wrapperEl.style.top = "0";
    imgCanvas.wrapperEl.style.width = "100%";
    imgCanvas.wrapperEl.style.height = "100%";
    imgCanvas.wrapperEl.style.zIndex = "1";
    textCanvas.wrapperEl.style.position = "absolute";
    textCanvas.wrapperEl.style.inset = "0";
    textCanvas.wrapperEl.style.left = "0";
    textCanvas.wrapperEl.style.top = "0";
    textCanvas.wrapperEl.style.width = "100%";
    textCanvas.wrapperEl.style.height = "100%";
    textCanvas.wrapperEl.style.zIndex = "2";
    drawCanvas.wrapperEl.style.position = "absolute";
    drawCanvas.wrapperEl.style.inset = "0";
    drawCanvas.wrapperEl.style.left = "0";
    drawCanvas.wrapperEl.style.top = "0";
    drawCanvas.wrapperEl.style.width = "100%";
    drawCanvas.wrapperEl.style.height = "100%";
    drawCanvas.wrapperEl.style.zIndex = "3";
    textCanvas.upperCanvasEl.style.pointerEvents = "auto";
    drawCanvas.upperCanvasEl.style.pointerEvents = "auto";

    const getMinDocumentHeight = (width: number) =>
      Math.max(320, Math.ceil((width / A4_WIDTH_MM) * A5_HEIGHT_MM));

    const syncCanvasDimensions = (width: number, height: number) => {
      imgCanvas.setDimensions({ width, height });
      textCanvas.setDimensions({ width, height });
      drawCanvas.setDimensions({ width, height });
    };

    const getLowestContentBottom = () => {
      let maxBottom = 0;
      [imgCanvas, textCanvas, drawCanvas].forEach((canvas) => {
        canvas.getObjects().forEach((obj) => {
          if (!obj.visible) {
            return;
          }
          const rect = obj.getBoundingRect();
          maxBottom = Math.max(maxBottom, rect.top + rect.height);
        });
      });
      return maxBottom;
    };

    const recalcDocumentHeight = (forcedWidth?: number) => {
      const measuredWidth = boardContainerRef.current?.clientWidth ?? 0;
      const preferredWidth = forcedWidth ?? measuredWidth;
      const width = Math.max(
        320,
        Math.floor(preferredWidth > 0 ? preferredWidth : window.innerWidth * 0.8),
      );
      const minHeight = getMinDocumentHeight(width);
      const contentBottom = getLowestContentBottom();
      const nextHeight = Math.max(
        minHeight,
        Math.ceil(contentBottom + DOCUMENT_BOTTOM_PADDING),
      );

      syncCanvasDimensions(width, nextHeight);
      imgCanvas.renderAll();
      textCanvas.renderAll();
      drawCanvas.renderAll();
      setCanvasHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const scheduleRecalc = () => {
      window.requestAnimationFrame(() => recalcDocumentHeight());
    };

    recalcDocumentHeight();
    recalcDocumentHeightRef.current = () => recalcDocumentHeight();
    window.addEventListener("resize", scheduleRecalc);

    drawCanvas.on("path:created", (event) => {
      if (!event.path) {
        return;
      }
      event.path.globalCompositeOperation =
        activeToolRef.current === "eraser" ? "destination-out" : "source-over";
      drawCanvas.renderAll();
      scheduleRecalc();
      queueSaveDocument();
    });

    const handleTextPointer = (event: fabric.TPointerEventInfo) => {
      if (isImageDeleteModeRef.current) {
        return;
      }

      if (event.target instanceof fabric.IText) {
        lastTextObjectRef.current = event.target;
        setTextEditingVisuals(event.target);
        textCanvas.setActiveObject(event.target);
        event.target.enterEditing();
        event.target.selectAll();
        event.target.hiddenTextarea?.focus();
        textCanvas.requestRenderAll();
        queueSaveDocument();
        return;
      }
    };

    drawCanvas.on("mouse:down", handleTextPointer);
    textCanvas.on("mouse:down", handleTextPointer);

    textCanvas.on("mouse:dblclick", (event) => {
      if (!(event.target instanceof fabric.IText)) {
        return;
      }
      lastTextObjectRef.current = event.target;
      setTextEditingVisuals(event.target);
      textCanvas.setActiveObject(event.target);
      event.target.enterEditing();
      event.target.selectAll();
      event.target.hiddenTextarea?.focus();
      textCanvas.requestRenderAll();
      queueSaveDocument();
    });

    imgCanvas.on("mouse:down", (event) => {
      if (!isImageDeleteModeRef.current) {
        return;
      }
      const target = event.target ?? imgCanvas.getActiveObject();
      if (!(target instanceof fabric.FabricImage)) {
        return;
      }
      if (lastInsertedImageRef.current === target) {
        lastInsertedImageRef.current = null;
      }
      imgCanvas.remove(target);
      imgCanvas.discardActiveObject();
      imgCanvas.renderAll();
      scheduleRecalc();
      queueSaveDocument();
    });

    [imgCanvas, textCanvas, drawCanvas].forEach((canvas) => {
      canvas.on("object:added", scheduleRecalc);
      canvas.on("object:removed", scheduleRecalc);
      canvas.on("object:modified", scheduleRecalc);
      canvas.on("object:added", queueSaveDocument);
      canvas.on("object:removed", queueSaveDocument);
      canvas.on("object:modified", queueSaveDocument);
    });

    return () => {
      window.removeEventListener("resize", scheduleRecalc);
      recalcDocumentHeightRef.current = null;
      requestSaveRef.current = null;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      imgCanvas.dispose();
      textCanvas.dispose();
      drawCanvas.dispose();
      imgCanvasRef.current = null;
      textCanvasRef.current = null;
      drawCanvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!drawingIdToLoad) {
      return;
    }

    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }

    let isCancelled = false;
    const run = async () => {
      try {
        isLoadingDrawingRef.current = true;
        const drawing = await getDrawingById(drawingIdToLoad);
        if (isCancelled) {
          return;
        }
        const snapshot = drawing.content;
        if (!snapshot) {
          return;
        }
        await loadDrawing(snapshot, { isCancelled: () => isCancelled });
      } catch (error) {
        console.warn("Failed to load drawing:", error);
      } finally {
        isLoadingDrawingRef.current = false;
      }
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, [drawingIdToLoad, loadDrawing]);

  useEffect(() => {
    isImageDeleteModeRef.current = isImageDeleteMode;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas || !textCanvas) {
      return;
    }

    const isTextMode = activeTool === "text";
    const textPointerEvents = isImageDeleteMode ? "none" : "auto";
    const drawPointerEvents = isImageDeleteMode || isTextMode ? "none" : "auto";

    textCanvas.wrapperEl.style.pointerEvents = textPointerEvents;
    drawCanvas.wrapperEl.style.pointerEvents = drawPointerEvents;
    textCanvas.upperCanvasEl.style.pointerEvents = textPointerEvents;
    drawCanvas.upperCanvasEl.style.pointerEvents = drawPointerEvents;
  }, [activeTool, isImageDeleteMode]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    const drawCanvas = drawCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    if (!drawCanvas || !textCanvas) {
      return;
    }

    if (activeTool === "eraser") {
      const EraserBrush = (fabric as FabricWithEraser).EraserBrush;
      if (EraserBrush) {
        drawCanvas.freeDrawingBrush = new EraserBrush(drawCanvas);
      } else {
        const brush = new fabric.PencilBrush(drawCanvas);
        brush.width = 24;
        brush.color = "#000000";
        drawCanvas.freeDrawingBrush = brush;
      }
    } else {
      const brush = new fabric.PencilBrush(drawCanvas);
      brush.width = 4;
      brush.color = "#000000";
      drawCanvas.freeDrawingBrush = brush;
    }
    drawCanvas.isDrawingMode =
      !isImageDeleteMode && (activeTool === "pencil" || activeTool === "eraser");
    textCanvas.defaultCursor = activeTool === "text" ? "text" : "default";
  }, [activeTool, isImageDeleteMode]);

  const addText = () => {
    setIsImageActionsOpen(false);
    setIsImageDeleteMode(false);
    isImageDeleteModeRef.current = false;
    activeToolRef.current = "text";
    setActiveTool("text");
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (textCanvas && drawCanvas) {
      textCanvas.wrapperEl.style.pointerEvents = "auto";
      textCanvas.upperCanvasEl.style.pointerEvents = "auto";
      drawCanvas.wrapperEl.style.pointerEvents = "none";
      drawCanvas.upperCanvasEl.style.pointerEvents = "none";
      drawCanvas.isDrawingMode = false;
      textCanvas.defaultCursor = "text";

      const existingText = lastTextObjectRef.current;
      const hasExistingText =
        existingText && textCanvas.getObjects().includes(existingText);
      const canvasWidth = textCanvas.getWidth();
      const baseLeft = Math.max(20, canvasWidth * 0.1);
      const baseTop = 48;
      const nextTop =
        hasExistingText && existingText
          ? (existingText.top ?? baseTop) + existingText.getScaledHeight() + 20
          : baseTop;

      const newText = new fabric.IText(" ", {
        left: baseLeft,
        top: nextTop,
        fontFamily: "Arial",
        fontSize: TEXT_FONT_SIZE,
        fill: "#000000",
        editable: true,
        backgroundColor: "rgba(255,255,255,0.25)",
        padding: TEXT_HORIZONTAL_PADDING,
        borderColor: "rgba(255, 80, 80, 0.35)",
        editingBorderColor: "rgba(255, 80, 80, 0.55)",
        cursorColor: "#000000",
        selectionColor: "rgba(255, 80, 80, 0.15)",
      });
      setTextIdleVisuals(newText);
      newText.on("editing:entered", () => {
        setTextEditingVisuals(newText);
        textCanvas.requestRenderAll();
        recalcDocumentHeightRef.current?.();
        requestSaveRef.current?.();
      });
      newText.on("editing:exited", () => {
        setTextIdleVisuals(newText);
        textCanvas.requestRenderAll();
        recalcDocumentHeightRef.current?.();
        requestSaveRef.current?.();
      });
      newText.on("changed", () => {
        textCanvas.requestRenderAll();
        recalcDocumentHeightRef.current?.();
        requestSaveRef.current?.();
      });

      lastTextObjectRef.current = newText;
      textCanvas.add(newText);
      textCanvas.setActiveObject(newText);
      textCanvas.setActiveObject(newText);
      newText.enterEditing();
      textCanvas.requestRenderAll();
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const saveToSupabase = async () => {
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }

    setIsSavingToDrawings(true);
    try {
      const content = buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
      await createDrawing({
        name: "MyBoard",
        content,
        roomId: "room-1",
      });
      console.log("Работа сохранена в базу!");
      alert("Работа сохранена в базу!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.warn("saveToSupabase failed:", error);
      alert(`Ошибка сохранения: ${message}`);
    } finally {
      setIsSavingToDrawings(false);
    }
  };

  const exportToPng = () => {
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }

    const width = drawCanvas.getWidth();
    const height = drawCanvas.getHeight();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;

    const context = exportCanvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(imgCanvas.lowerCanvasEl, 0, 0);
    context.drawImage(textCanvas.lowerCanvasEl, 0, 0);
    context.drawImage(drawCanvas.lowerCanvasEl, 0, 0);

    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `myboard-${Date.now()}.png`;
    link.click();
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const imgCanvas = imgCanvasRef.current;
    if (!file || !imgCanvas) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    try {
      // Ensure layer dimensions are initialized before first insert.
      recalcDocumentHeightRef.current?.();

      let canvasWidth = imgCanvas.getWidth();
      let canvasHeightCurrent = imgCanvas.getHeight();
      if (canvasWidth <= 1 || canvasHeightCurrent <= 1) {
        const measuredWidth =
          boardContainerRef.current?.clientWidth ?? Math.floor(window.innerWidth * 0.8);
        const minHeight = Math.max(320, Math.ceil((measuredWidth / A4_WIDTH_MM) * A5_HEIGHT_MM));
        imgCanvas.setDimensions({ width: measuredWidth, height: minHeight });
        canvasWidth = imgCanvas.getWidth();
        canvasHeightCurrent = imgCanvas.getHeight();
      }

      const image = await fabric.FabricImage.fromURL(imageUrl);
      const sourceWidth = image.width ?? canvasWidth;
      const minImageWidth = MIN_IMAGE_WIDTH_RATIO * canvasWidth;
      const IMAGE_GAP = 20;

      // scale=max((0.3*Wcanvas)/Wimg, min(1, Wcanvas/Wimg))
      // - larger images scale down to canvas width
      // - too small images scale up to at least 30% width
      // - medium images keep original size
      const scaleDownToFit = Math.min(1, canvasWidth / sourceWidth);
      const scaleUpToMinimum = minImageWidth / sourceWidth;
      const nextScale = Math.max(scaleUpToMinimum, scaleDownToFit);
      const scaledWidth = sourceWidth * nextScale;
      image.scale(nextScale);

      const previousInsertedImage = lastInsertedImageRef.current;
      const hasPreviousInsertedImage =
        previousInsertedImage && imgCanvas.getObjects().includes(previousInsertedImage);
      const previousBottom =
        hasPreviousInsertedImage && previousInsertedImage
          ? previousInsertedImage.getBoundingRect().top +
            previousInsertedImage.getBoundingRect().height
          : imgCanvas
              .getObjects()
              .filter(
                (obj): obj is fabric.FabricImage => obj instanceof fabric.FabricImage,
              )
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
      lastInsertedImageRef.current = image;
      imgCanvas.renderAll();
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
    } finally {
      URL.revokeObjectURL(imageUrl);
      event.target.value = "";
    }
  };

  return (
    <section className="relative h-screen overflow-hidden bg-zinc-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => {
              clearTextEditingVisuals();
              setIsImageActionsOpen(false);
              setIsImageDeleteMode(false);
              isImageDeleteModeRef.current = false;
              activeToolRef.current = "pencil";
              setActiveTool("pencil");
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTool === "pencil" && !isImageDeleteMode
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
            }`}
            title="Карандаш"
            aria-label="Карандаш"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              clearTextEditingVisuals();
              setIsImageActionsOpen(false);
              setIsImageDeleteMode(false);
              isImageDeleteModeRef.current = false;
              activeToolRef.current = "eraser";
              setActiveTool("eraser");
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTool === "eraser" && !isImageDeleteMode
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
            }`}
            title="Ластик"
            aria-label="Ластик"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m7 21 10.5-10.5a2.1 2.1 0 0 0 0-3L13.5 3a2.1 2.1 0 0 0-3 0L2 11.5a2.1 2.1 0 0 0 0 3L8.5 21" />
              <path d="M22 21H8.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={addText}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTool === "text" && !isImageDeleteMode
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
            }`}
            title="Текст"
            aria-label="Текст"
          >
            <span className="text-lg font-black leading-none">T</span>
          </button>
          {!isImageActionsOpen ? (
            <button
              type="button"
              onClick={() => {
                clearTextEditingVisuals();
                setIsImageActionsOpen(true);
              }}
              className="w-28 rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-300"
              title="Изображение"
              aria-label="Изображение"
            >
              <svg
                viewBox="0 0 24 24"
                className="mx-auto h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="9" r="1.5" />
                <path d="m21 16-5-5L5 20" />
              </svg>
            </button>
          ) : (
            <div className="grid w-28 grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  clearTextEditingVisuals();
                  openFileDialog();
                }}
                className="rounded-md bg-zinc-200 px-2 py-2 text-sm font-bold text-zinc-900 transition hover:bg-zinc-300"
                title="Добавить изображение"
              >
                +
              </button>
              <button
                type="button"
                onClick={() =>
                  setIsImageDeleteMode((prev) => {
                    clearTextEditingVisuals();
                    const next = !prev;
                    isImageDeleteModeRef.current = next;
                    return next;
                  })
                }
                className={`rounded-md px-2 py-2 text-sm font-bold transition ${
                  isImageDeleteMode
                    ? "bg-red-600 text-white"
                    : "bg-zinc-200 text-zinc-900 hover:bg-zinc-300"
                }`}
                title="Удалить изображение"
              >
                🗑️
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              clearTextEditingVisuals();
              void saveToSupabase();
            }}
            disabled={isSavingToDrawings}
            className="rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            title="Сохранить"
          >
            {isSavingToDrawings ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearTextEditingVisuals();
              exportToPng();
            }}
            className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            title="Экспорт в PNG"
          >
            Экспорт в PNG
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
      />

      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: `${TOOLBAR_HEIGHT_PX}px` }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] justify-center px-3 pb-8 pt-4">
          <div
            ref={boardContainerRef}
            className="relative w-[min(92vw,980px)] overflow-hidden rounded-lg border border-zinc-300 bg-white shadow"
            style={{ height: `${canvasHeight}px` }}
          >
            <canvas ref={imgCanvasElementRef} className="absolute inset-0 z-[1]" />
            <canvas
              ref={textCanvasElementRef}
              className={`absolute inset-0 z-[2] ${isImageDeleteMode ? "pointer-events-none" : "pointer-events-auto"}`}
            />
            <canvas
              ref={drawCanvasElementRef}
              className={`absolute inset-0 z-[3] ${isImageDeleteMode ? "pointer-events-none" : "pointer-events-auto"}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
