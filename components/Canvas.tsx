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
import {
  assertImageJsonUsesRemoteSrcOnly,
  getMinDocumentHeightForWidth,
  insertImageFromFile,
  patchImageLayerForLoad,
  prepareImageLayerForSnapshot,
  SNAPSHOT_IMAGE_PROPS,
} from "../utils/canvasLogic";
import { removeStorageObjects, STORAGE_PATH_KEY } from "../utils/imageStorage";
import { MAX_ROOM_PARTICIPANTS, useRoomCollaboration } from "../hooks/useCollaboration";
import Toolbar, { TOOLBAR_HEIGHT_PX, type Tool } from "./Toolbar";

type FabricWithEraser = typeof fabric & {
  EraserBrush?: new (canvas: fabric.Canvas) => fabric.BaseBrush;
};

const TEXT_FONT_SIZE = 14;
const TEXT_HORIZONTAL_PADDING = 14;
const DOCUMENT_BOTTOM_PADDING = 24;
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
  const pendingImageStorageDeletesRef = useRef<Set<string>>(new Set());
  const imageCloudSyncDepthRef = useRef(0);
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [isImageActionsOpen, setIsImageActionsOpen] = useState(false);
  const [isImageDeleteMode, setIsImageDeleteMode] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [isSavingToDrawings, setIsSavingToDrawings] = useState(false);
  const [isImageCloudSyncing, setIsImageCloudSyncing] = useState(false);
  const [canvasesReady, setCanvasesReady] = useState(false);

  const { roomId: collabRoomId, roomFull, cursors, participants: collabParticipants } =
    useRoomCollaboration({
      enabled: true,
      canvasesReady,
      isRestoringRef: isLoadingDrawingRef,
      imgCanvasRef,
      textCanvasRef,
      drawCanvasRef,
      boardContainerRef,
    });

  const beginImageCloudSync = () => {
    imageCloudSyncDepthRef.current += 1;
    setIsImageCloudSyncing(true);
  };

  const endImageCloudSync = () => {
    imageCloudSyncDepthRef.current = Math.max(0, imageCloudSyncDepthRef.current - 1);
    if (imageCloudSyncDepthRef.current === 0) {
      setIsImageCloudSyncing(false);
    }
  };

  const buildDocumentSnapshot = async (
    imgCanvas: fabric.Canvas,
    textCanvas: fabric.Canvas,
    drawCanvas: fabric.Canvas,
  ) => {
    beginImageCloudSync();
    try {
      await prepareImageLayerForSnapshot(imgCanvas);
      const width = drawCanvas.getWidth();
      const height = drawCanvas.getHeight();
      const imgLayer = imgCanvas.toObject(SNAPSHOT_IMAGE_PROPS) as {
        objects?: unknown[];
      };
      assertImageJsonUsesRemoteSrcOnly(imgLayer);
      return {
        imgLayer,
        textLayer: textCanvas.toObject(),
        drawLayer: drawCanvas.toObject(),
        canvasWidth: width,
        canvasHeight: height,
        savedAt: new Date().toISOString(),
      };
    } finally {
      endImageCloudSync();
    }
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
  const drawingIdToLoad = selectedDrawingId ?? idFromUrl ?? null;

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

      const imgJson = patchImageLayerForLoad(snapshot.imgLayer ?? { objects: [] });
      await imgCanvas.loadFromJSON(imgJson);
      if (isCancelled()) {
        return;
      }
      await textCanvas.loadFromJSON((snapshot.textLayer ?? { objects: [] }) as never);
      if (isCancelled()) {
        return;
      }
      await drawCanvas.loadFromJSON((snapshot.drawLayer ?? { objects: [] }) as never);
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
        let cloudStarted = false;
        try {
          beginImageCloudSync();
          cloudStarted = true;
          await prepareImageLayerForSnapshot(imgCanvas);
          const imgLayer = imgCanvas.toObject(SNAPSHOT_IMAGE_PROPS) as {
            objects?: unknown[];
          };
          assertImageJsonUsesRemoteSrcOnly(imgLayer);
          const textLayer = textCanvas.toObject();
          const drawLayer = drawCanvas.toObject();
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
          } else {
            const toRemove = [...pendingImageStorageDeletesRef.current];
            pendingImageStorageDeletesRef.current.clear();
            if (toRemove.length > 0) {
              await removeStorageObjects(toRemove);
            }
          }
        } finally {
          if (cloudStarted) {
            endImageCloudSync();
          }
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
      const minHeight = getMinDocumentHeightForWidth(width);
      const contentBottom = getLowestContentBottom();
      const nextHeight = Math.max(
        minHeight,
        Math.ceil(contentBottom + DOCUMENT_BOTTOM_PADDING),
      );

      imgCanvas.setDimensions({ width, height: nextHeight });
      textCanvas.setDimensions({ width, height: nextHeight });
      drawCanvas.setDimensions({ width, height: nextHeight });
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

    imgCanvas.on("object:removed", (e) => {
      if (isLoadingDrawingRef.current) {
        return;
      }
      const t = e.target;
      if (t && t instanceof fabric.FabricImage) {
        const p = t.get(STORAGE_PATH_KEY) as string | undefined;
        if (typeof p === "string" && p.length > 0) {
          pendingImageStorageDeletesRef.current.add(p);
        }
      }
    });

    [imgCanvas, textCanvas, drawCanvas].forEach((canvas) => {
      canvas.on("object:added", scheduleRecalc);
      canvas.on("object:removed", scheduleRecalc);
      canvas.on("object:modified", scheduleRecalc);
      canvas.on("object:added", queueSaveDocument);
      canvas.on("object:removed", queueSaveDocument);
      canvas.on("object:modified", queueSaveDocument);
    });

    setCanvasesReady(true);

    return () => {
      setCanvasesReady(false);
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
      const content = await buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
      await createDrawing({
        name: "MyBoard",
        content,
        roomId: "room-1",
      });
      const toRemove = [...pendingImageStorageDeletesRef.current];
      pendingImageStorageDeletesRef.current.clear();
      if (toRemove.length > 0) {
        await removeStorageObjects(toRemove);
      }
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

    beginImageCloudSync();
    try {
      await insertImageFromFile(file, imgCanvas, {
        getBoardContainerWidth: () => boardContainerRef.current?.clientWidth ?? 0,
        getFallbackCanvasWidth: () => Math.floor(window.innerWidth * 0.8),
        onRecalcHeight: () => recalcDocumentHeightRef.current?.(),
        onRequestSave: () => requestSaveRef.current?.(),
        getLastInsertedImage: () => lastInsertedImageRef.current,
        setLastInsertedImage: (im) => {
          lastInsertedImageRef.current = im;
        },
      });
    } catch (err) {
      console.warn("Не удалось вставить изображение в Storage / на холст:", err);
    } finally {
      endImageCloudSync();
      event.target.value = "";
    }
  };

  return (
    <section className="relative h-screen overflow-hidden bg-zinc-100">
      <Toolbar
        activeTool={activeTool}
        isImageDeleteMode={isImageDeleteMode}
        isImageActionsOpen={isImageActionsOpen}
        isSavingToDrawings={isSavingToDrawings}
        collabRoomId={collabRoomId}
        collabParticipants={collabParticipants}
        roomFull={roomFull}
        maxRoomParticipants={MAX_ROOM_PARTICIPANTS}
        fileInputRef={fileInputRef}
        onPencil={() => {
          clearTextEditingVisuals();
          setIsImageActionsOpen(false);
          setIsImageDeleteMode(false);
          isImageDeleteModeRef.current = false;
          activeToolRef.current = "pencil";
          setActiveTool("pencil");
        }}
        onEraser={() => {
          clearTextEditingVisuals();
          setIsImageActionsOpen(false);
          setIsImageDeleteMode(false);
          isImageDeleteModeRef.current = false;
          activeToolRef.current = "eraser";
          setActiveTool("eraser");
        }}
        onText={addText}
        onOpenImageMenu={() => {
          clearTextEditingVisuals();
          setIsImageActionsOpen(true);
        }}
        onAddImage={() => {
          clearTextEditingVisuals();
          openFileDialog();
        }}
        onToggleImageDelete={() => {
          setIsImageDeleteMode((prev) => {
            clearTextEditingVisuals();
            const next = !prev;
            isImageDeleteModeRef.current = next;
            return next;
          });
        }}
        onSave={() => {
          clearTextEditingVisuals();
          void saveToSupabase();
        }}
        onExportPng={() => {
          clearTextEditingVisuals();
          exportToPng();
        }}
        onFileChange={onFileSelected}
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
            <div
              className="pointer-events-none absolute inset-0 z-[25]"
              aria-hidden
            >
              {cursors.map((c) => (
                <div
                  key={c.senderId}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${c.xPct * 100}%`, top: `${c.yPct * 100}%` }}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: c.color }}
                  />
                  <div
                    className="mt-0.5 max-w-[7rem] truncate rounded px-1 py-0.5 text-[10px] text-white shadow"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isImageCloudSyncing ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/35 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-5 shadow-lg">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600"
              aria-hidden
            />
            <p className="text-sm font-medium text-zinc-800">Загрузка в облако…</p>
            <p className="max-w-xs text-center text-xs text-zinc-500">
              Сохраняем изображения в хранилище, подождите
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
