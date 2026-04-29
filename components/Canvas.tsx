"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as fabric from "fabric";
import { supabase } from "../utils/supabaseClient";
import {
  type CanvasSnapshot,
  createDrawing,
  deleteDrawingById,
  getDrawingById,
  getLatestDrawingByRoom,
  updateDrawing,
} from "../utils/drawingsApi";
import {
  assertImageJsonUsesRemoteSrcOnly,
  getMinDocumentHeightForWidth,
  insertImageFromFile,
  patchImageLayerForLoad,
  prepareImageLayerForSnapshot,
  SNAPSHOT_IMAGE_PROPS,
} from "../utils/canvasLogic";
import {
  buildSnapshotFromObjectRows,
  normalizeSnapshotByFabricType,
} from "../utils/snapshotLayerRouting";
import { resolveCanvasObjectDrawingId } from "../utils/resolveCanvasObjectDrawingId";
import { removeStorageObjects, STORAGE_PATH_KEY } from "../utils/imageStorage";
import {
  getLocalCanvasSnapshot,
  putLocalCanvasSnapshot,
} from "../utils/localCanvasStore";
import {
  loadSnapshotFromDexie,
  saveCanvasObjectsFromSnapshot,
  syncDexieCanvasObjectsWithSupabase,
} from "../utils/db";
import { v4 as uuidv4 } from "uuid";
import {
  pushChanges,
  pushChangesDebounced,
  fetchCanvasObjectsFromSupabase,
  getLocalCanvasObjectsByDrawingId,
  reconcileLocalCanvasObjectsFromSnapshot,
  replaceDrawingCanvasObjectsLocal,
  supabaseRowToCanvasObject,
  upsertCanvasObjectLocal,
  upsertProjectLocal,
} from "../lib/db";
import { MAX_ROOM_PARTICIPANTS, useRoomCollaboration } from "../hooks/useCollaboration";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { cn } from "../utils/cn";
import { getSmartPosition } from "../utils/textSmartPosition";
import { useLocale } from "../contexts/LocaleContext";
import { useAppearance } from "../contexts/AppearanceContext";
import { useSavedWorksRefresh } from "../contexts/SavedWorksRefreshContext";
import StudioConsole, {
  STUDIO_CONSOLE_HEIGHT_PX,
  STUDIO_CONSOLE_MOBILE_HEADER_PX,
  type BoardExportFormat,
  type TextSizeOption,
  type Tool,
} from "./StudioConsole";
import {
  BOARD_CONTENT_WIDTH_CLASS,
  BOARD_OUTER_MAX_CLASS,
  BOARD_WIDTH_CLASS,
} from "../lib/boardLayout";
import { boardChromeFromAppearance } from "../lib/boardTheme";

export {
  BOARD_CONTENT_WIDTH_CLASS,
  BOARD_OUTER_MAX_CLASS,
  BOARD_WIDTH_CLASS,
} from "../lib/boardLayout";

type FabricWithEraser = typeof fabric & {
  EraserBrush?: new (canvas: fabric.Canvas) => fabric.BaseBrush;
};

const TEXT_HORIZONTAL_PADDING = 14;
const DEFAULT_PENCIL_COLOR = "#000000";
const DEFAULT_PENCIL_WIDTH = 3 as const;
const DEFAULT_TEXT_SIZE: TextSizeOption = 14;
const FORCE_EDIT_KEY = "mbForceEdit";
const DOCUMENT_BOTTOM_PADDING = 24;
const SUPABASE_CANVAS_TABLE = "canvas_documents";
const SUPABASE_DOCUMENT_ID = "default";
const SAVE_DEBOUNCE_MS = 800;
const OFFLINE_AUTOSAVE_MS = 30_000;
const OBJECT_UPDATED_AT_KEY = "mbUpdatedAt";
const AUTOSAVE_DRAFT_MS = 30_000;
const PREVIEW_SNAPSHOT_MS = 5 * 60_000;
const DRAFT_GRACE_MS = 5 * 60_000;
const DRAFT_ROOM_STORAGE_KEY = "myboard_draft_room";
const DRAFT_EXPIRES_AT_KEY = "myboard_draft_expires_at";
const DRAFT_ROW_ID_KEY = "myboard_draft_row_id";
const TEXT_KEYBOARD_BOUND_ATTR = "data-myboard-text-keys";

/** Ключ, чтобы не вешать на один IText два `changed` с размером. */
const ITEXT_SIZE_LISTENER = "__myboardITextSizeRange";
const TEXT_UI_BOUND_KEY = "__myboardTextUiBound";

/**
 * В `now` — диапазон [start, end) вставки или заменённого куска относительно `lastText`
 * (содержимое до события `changed`). `selectionEnd` — позиция курсора после ввода.
 */
function findFontSizeApplyRange(
  lastText: string,
  now: string,
  selectionEnd: number,
): { start: number; end: number } | null {
  if (now === lastText) {
    return null;
  }
  if (now.length > lastText.length) {
    const d = now.length - lastText.length;
    const start = selectionEnd - d;
    if (start >= 0 && d > 0) {
      return { start, end: selectionEnd };
    }
    return null;
  }
  const pl = lastText.length;
  const nl = now.length;
  let l = 0;
  while (l < pl && l < nl && lastText[l] === now[l]) {
    l++;
  }
  let r0 = pl;
  let r1 = nl;
  while (r0 > l && r1 > l && lastText[r0 - 1] === now[r1 - 1]) {
    r0--;
    r1--;
  }
  if (l < r1) {
    return { start: l, end: r1 };
  }
  return null;
}

type CanvasProps = {
  selectedDrawingId?: string | null;
};

type EditableTextObject = fabric.IText | fabric.Textbox;

export default function Canvas({ selectedDrawingId = null }: CanvasProps) {
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const imgCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const textCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const imgCanvasRef = useRef<fabric.Canvas | null>(null);
  const textCanvasRef = useRef<fabric.Canvas | null>(null);
  const drawCanvasRef = useRef<fabric.Canvas | null>(null);
  const lastTextObjectRef = useRef<EditableTextObject | null>(null);
  const lastInsertedImageRef = useRef<fabric.FabricImage | null>(null);
  const recalcDocumentHeightRef = useRef<(() => void) | null>(null);
  const requestSaveRef = useRef<(() => void) | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const isLoadingDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeToolRef = useRef<Tool>("pencil");
  const isImageDeleteModeRef = useRef(false);
  const pencilColorRef = useRef<string>(DEFAULT_PENCIL_COLOR);
  const textFontSizeRef = useRef<TextSizeOption>(DEFAULT_TEXT_SIZE);
  const bindITextSizeOnTextChangeRef = useRef<(t: EditableTextObject) => void | null>(null);
  const pendingImageStorageDeletesRef = useRef<Set<string>>(new Set());
  const networkOpDepthRef = useRef(0);
  const draftSaveInFlightRef = useRef(false);
  const previewSaveInFlightRef = useRef(false);
  const draftRowIdRef = useRef<string | null>(null);
  const draftRoomIdRef = useRef<string | null>(null);
  const lastDraftSavedAtRef = useRef(0);
  const lastPreviewSavedAtRef = useRef(0);
  const didManualSaveRef = useRef(false);
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [pencilColor, setPencilColor] = useState<string>(DEFAULT_PENCIL_COLOR);
  const [pencilWidth, setPencilWidth] = useState<1 | 3 | 5>(DEFAULT_PENCIL_WIDTH);
  const [textFontSize, setTextFontSize] = useState<TextSizeOption>(DEFAULT_TEXT_SIZE);
  const [isImageDeleteMode, setIsImageDeleteMode] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [isSavingToDrawings, setIsSavingToDrawings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [networkErrorTick, setNetworkErrorTick] = useState(0);
  const [canvasesReady, setCanvasesReady] = useState(false);
  const [defaultWorkName, setDefaultWorkName] = useState("MyBoard");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [saveSuccessTick, setSaveSuccessTick] = useState(0);
  const { inputBcp47, isTextRtl } = useLocale();
  const textInputLocaleRef = useRef({ bcp47: inputBcp47, rtl: isTextRtl });
  const { appearance, setAppearance } = useAppearance();
  const { request: requestSavedWorksRefresh, publishCreated: publishSavedWorkCreated } =
    useSavedWorksRefresh();
  const undoStackRef = useRef<CanvasSnapshot[]>([]);
  const suppressHistoryUntilRef = useRef(0);

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id") ?? searchParams.get("drawing");
  const drawingIdToLoad = selectedDrawingId ?? idFromUrl ?? null;
  const canvasObjectsDrawingId = resolveCanvasObjectDrawingId(selectedDrawingId, idFromUrl);

  useEffect(() => {
    const check = () => setIsMobileViewport(window.matchMedia("(max-width: 639px)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    textInputLocaleRef.current = { bcp47: inputBcp47, rtl: isTextRtl };
  }, [inputBcp47, isTextRtl]);

  const applyTextLocaleToObject = (o: EditableTextObject) => {
    requestAnimationFrame(() => {
      const ta = o.hiddenTextarea;
      if (ta) {
        const sysLang = typeof navigator !== "undefined" ? navigator.language : "";
        ta.setAttribute("lang", textInputLocaleRef.current.bcp47 || sysLang || "en");
        ta.setAttribute("dir", textInputLocaleRef.current.rtl ? "rtl" : "ltr");
        ta.setAttribute("autocapitalize", "sentences");
        ta.setAttribute("autocomplete", "off");
        ta.setAttribute("autocorrect", "on");
        ta.setAttribute("spellcheck", "true");
      }
    });
  };

  const bindTextKeyboardShortcuts = (o: EditableTextObject) => {
    requestAnimationFrame(() => {
      const ta = o.hiddenTextarea;
      if (!ta || ta.getAttribute(TEXT_KEYBOARD_BOUND_ATTR) === "1") {
        return;
      }
      ta.setAttribute(TEXT_KEYBOARD_BOUND_ATTR, "1");
      ta.addEventListener("keydown", (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
          ev.preventDefault();
          o.selectAll();
          return;
        }
        if (ev.key === "Enter" || ev.key === "Backspace" || ev.key === "Delete") {
          // Native Textbox behavior handles multiline + deletion.
        }
      });
    });
  };

  useEffect(() => {
    if (!canvasesReady) {
      return;
    }
    const textCanvas = textCanvasRef.current;
    if (!textCanvas) {
      return;
    }
    for (const o of textCanvas.getObjects()) {
      if (o instanceof fabric.IText || o instanceof fabric.Textbox) {
        applyTextLocaleToObject(o);
        bindTextKeyboardShortcuts(o);
      }
    }
  }, [inputBcp47, isTextRtl, canvasesReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const existing = localStorage.getItem(DRAFT_ROOM_STORAGE_KEY);
    if (existing && existing.trim()) {
      draftRoomIdRef.current = existing;
      return;
    }
    const created = `draft:${crypto.randomUUID()}`;
    draftRoomIdRef.current = created;
    localStorage.setItem(DRAFT_ROOM_STORAGE_KEY, created);
  }, []);

  const bumpNetworkError = useCallback(() => {
    setNetworkErrorTick((n) => n + 1);
  }, []);

  const beginNetworkOp = useCallback(() => {
    networkOpDepthRef.current += 1;
    if (networkOpDepthRef.current === 1) {
      setIsProcessing(true);
    }
  }, []);

  const endNetworkOp = useCallback(() => {
    networkOpDepthRef.current = Math.max(0, networkOpDepthRef.current - 1);
    if (networkOpDepthRef.current === 0) {
      setIsProcessing(false);
    }
  }, []);

  const buildDocumentSnapshot = useCallback(async (
    imgCanvas: fabric.Canvas,
    textCanvas: fabric.Canvas,
    drawCanvas: fabric.Canvas,
  ) => {
    beginNetworkOp();
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
        textLayer: textCanvas.toObject([OBJECT_UPDATED_AT_KEY]),
        drawLayer: drawCanvas.toObject([OBJECT_UPDATED_AT_KEY]),
        canvasWidth: width,
        canvasHeight: height,
        savedAt: new Date().toISOString(),
      };
    } finally {
      endNetworkOp();
    }
  }, [beginNetworkOp, endNetworkOp]);

  const markObjectUpdatedAt = (obj: fabric.Object | null | undefined) => {
    if (!obj) {
      return;
    }
    obj.set(OBJECT_UPDATED_AT_KEY as keyof fabric.Object, Date.now() as never);
  };

  const persistSnapshotLocally = useCallback(
    async (
      snapshot: CanvasSnapshot,
      opts?: {
        pendingSync: boolean;
      },
    ) => {
      try {
        await putLocalCanvasSnapshot(SUPABASE_DOCUMENT_ID, snapshot, opts?.pendingSync ?? false);
      } catch (e) {
        console.warn("IndexedDB persist failed:", e);
      }
    },
    [],
  );

  const syncPendingLocalSnapshot = useCallback(async () => {
    try {
      const local = await getLocalCanvasSnapshot(SUPABASE_DOCUMENT_ID);
      if (!local || !local.pendingSync) {
        return;
      }
      const { data: remote, error: remoteError } = await supabase
        .from(SUPABASE_CANVAS_TABLE)
        .select("updated_at")
        .eq("id", SUPABASE_DOCUMENT_ID)
        .maybeSingle();
      if (remoteError) {
        throw remoteError;
      }
      const remoteUpdatedAt = remote?.updated_at
        ? new Date(remote.updated_at as string).getTime()
        : 0;
      if (remoteUpdatedAt >= local.updatedAt) {
        await putLocalCanvasSnapshot(SUPABASE_DOCUMENT_ID, local.snapshot, false);
        return;
      }
      const { error } = await supabase.from(SUPABASE_CANVAS_TABLE).upsert(
        {
          id: SUPABASE_DOCUMENT_ID,
          img_layer: local.snapshot.imgLayer,
          text_layer: local.snapshot.textLayer,
          draw_layer: local.snapshot.drawLayer,
          canvas_height: local.snapshot.canvasHeight,
          updated_at: new Date(local.snapshot.savedAt).toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) {
        throw error;
      }
      await putLocalCanvasSnapshot(SUPABASE_DOCUMENT_ID, local.snapshot, false);
    } catch (e) {
      console.warn("Local sync failed:", e);
    }
  }, []);

  const persistToDexie = useCallback(
    async (snapshot: CanvasSnapshot, opts?: { myBoardReconcile?: boolean }) => {
      const myBoard = opts?.myBoardReconcile !== false;
      try {
        console.log("[save:canvas] persistToDexie: legacy myboard_dexie snapshot");
        await saveCanvasObjectsFromSnapshot(snapshot);
      } catch (e) {
        console.warn("Dexie persist failed:", e);
      }
      if (!myBoard) {
        console.log(
          "[save:canvas] persistToDexie: MyBoardDB reconcile skipped (e.g. post-load from server)",
        );
        return;
      }
      const drawingId = canvasObjectsDrawingId;
      try {
        console.log("[save:canvas] persistToDexie: MyBoardDB + pending from snapshot", { drawingId });
        await reconcileLocalCanvasObjectsFromSnapshot(drawingId, snapshot);
        pushChangesDebounced();
      } catch (e) {
        console.warn("MyBoardDB reconcile failed:", e);
      }
    },
    [canvasObjectsDrawingId],
  );

  const persistFabricObject = useCallback(
    async (layer: "img" | "text" | "draw", obj: fabric.Object | null | undefined) => {
      if (!obj || isLoadingDrawingRef.current) {
        return;
      }
      const getFn = (obj as fabric.Object & { get?: (k: string) => unknown }).get;
      const setFn = (obj as fabric.Object & { set?: (k: string, v: unknown) => void }).set;
      const currentId = typeof getFn === "function" ? (getFn.call(obj, "mbCollabId") as string | undefined) : undefined;
      const objectId = (typeof currentId === "string" && currentId) || uuidv4();
      if (typeof setFn === "function" && (!currentId || currentId !== objectId)) {
        setFn.call(obj, "mbCollabId", objectId);
      }
      markObjectUpdatedAt(obj);

      const serialized =
        layer === "img"
          ? (obj.toObject([
              ...SNAPSHOT_IMAGE_PROPS,
              OBJECT_UPDATED_AT_KEY,
              "mbCollabId",
            ]) as Record<string, unknown>)
          : (obj.toObject([
              OBJECT_UPDATED_AT_KEY,
              "mbCollabId",
              ...(layer === "text" ? [FORCE_EDIT_KEY] : []),
            ]) as Record<string, unknown>);

      const drawingId = canvasObjectsDrawingId;
      const rowId = `${drawingId}:${objectId}`;
      const t = Date.now();

      console.log("[save:canvas] persistFabricObject", {
        layer,
        rowId,
        objectId,
        drawingId,
      });
      await upsertCanvasObjectLocal(
        {
          id: rowId,
          drawing_id: drawingId,
          object_id: objectId,
          layer,
          fabric_json: serialized,
          last_updated: t,
          sync_status: "pending",
        },
        "persistFabricObject",
      );
      console.log("[save:canvas] persistFabricObject: Dexie put done, scheduling push");
      pushChangesDebounced();
    },
    [canvasObjectsDrawingId],
  );

  const syncOfflineChanges = useCallback(async () => {
    try {
      await pushChanges();
    } catch (e) {
      console.warn("pushChanges failed:", e);
    }
  }, []);

  const ensureObjectUuid = (obj: fabric.Object | null | undefined) => {
    if (!obj) {
      return;
    }
    const getFn = (obj as fabric.Object & { get?: (k: string) => unknown }).get;
    const setFn = (obj as fabric.Object & { set?: (k: string, v: unknown) => void }).set;
    const current = typeof getFn === "function" ? (getFn.call(obj, "mbCollabId") as string | undefined) : undefined;
    if (typeof current === "string" && current.length > 0) {
      return;
    }
    if (typeof setFn === "function") {
      setFn.call(obj, "mbCollabId", uuidv4());
    }
  };

  const renderPreviewBlob = (
    imgCanvas: fabric.Canvas,
    textCanvas: fabric.Canvas,
    drawCanvas: fabric.Canvas,
  ): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const width = drawCanvas.getWidth();
      const height = drawCanvas.getHeight();
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const context = exportCanvas.getContext("2d");
      if (!context) {
        reject(new Error("Cannot create 2d context for preview"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(imgCanvas.lowerCanvasEl, 0, 0);
      context.drawImage(textCanvas.lowerCanvasEl, 0, 0);
      context.drawImage(drawCanvas.lowerCanvasEl, 0, 0);
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to export preview blob"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

  const saveDraftSnapshot = useCallback(
    async (opts?: { forcePreview?: boolean }) => {
      const imgCanvas = imgCanvasRef.current;
      const textCanvas = textCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      const draftRoom = draftRoomIdRef.current;
      if (!imgCanvas || !textCanvas || !drawCanvas || !draftRoom) {
        return;
      }
      if (draftSaveInFlightRef.current) {
        return;
      }
      draftSaveInFlightRef.current = true;
      beginNetworkOp();
      try {
        const content = await buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
        const now = Date.now();
        const shouldUpdatePreview =
          opts?.forcePreview === true ||
          now - lastPreviewSavedAtRef.current >= PREVIEW_SNAPSHOT_MS;

        let previewUrl: string | null | undefined;
        if (shouldUpdatePreview && !previewSaveInFlightRef.current) {
          previewSaveInFlightRef.current = true;
          try {
            const previewBlob = await renderPreviewBlob(imgCanvas, textCanvas, drawCanvas);
            const path = `previews/draft-${draftRoom.replace(/[^a-zA-Z0-9:_-]/g, "")}.png`;
            const { error: uploadError } = await supabase.storage
              .from("images")
              .upload(path, previewBlob, {
                contentType: "image/png",
                cacheControl: "60",
                upsert: true,
              });
            if (!uploadError) {
              const { data } = supabase.storage.from("images").getPublicUrl(path);
              previewUrl = data.publicUrl;
              lastPreviewSavedAtRef.current = now;
            } else {
              console.warn("Draft preview upload failed:", uploadError);
            }
          } finally {
            previewSaveInFlightRef.current = false;
          }
        }

        const name = `${defaultWorkName || "MyBoard"} (черновик)`;
        const existingId = draftRowIdRef.current;
        if (existingId) {
          const updated = await updateDrawing({
            id: existingId,
            name,
            content,
            ...(previewUrl !== undefined ? { previewUrl } : {}),
            roomId: draftRoom,
          });
          draftRowIdRef.current = updated.id;
        } else {
          const latest = await getLatestDrawingByRoom(draftRoom);
          if (latest) {
            const updated = await updateDrawing({
              id: latest.id,
              name,
              content,
              ...(previewUrl !== undefined ? { previewUrl } : {}),
              roomId: draftRoom,
            });
            draftRowIdRef.current = updated.id;
          } else {
            const created = await createDrawing({
              name,
              content,
              previewUrl: previewUrl ?? null,
              roomId: draftRoom,
            });
            draftRowIdRef.current = created.id;
          }
        }
        lastDraftSavedAtRef.current = now;
        localStorage.setItem(DRAFT_EXPIRES_AT_KEY, String(now + DRAFT_GRACE_MS));
        if (draftRowIdRef.current) {
          localStorage.setItem(DRAFT_ROW_ID_KEY, draftRowIdRef.current);
        }
      } catch (e) {
        console.warn("Draft autosave failed:", e);
        bumpNetworkError();
      } finally {
        endNetworkOp();
        draftSaveInFlightRef.current = false;
      }
    },
    [buildDocumentSnapshot, bumpNetworkError, defaultWorkName],
  );

  const setTextEditingVisuals = (text: EditableTextObject) => {
    const fill = (typeof text.fill === "string" && text.fill ? text.fill : "#000000") as string;
    /** Без `fontSize`: размеры остаются по символам (`styles` / ref на объекте), иначе затирается микст-набор. */
    text.set({
      fontFamily: "Arial",
      fill,
      backgroundColor: "rgba(255,255,255,0.25)",
      padding: TEXT_HORIZONTAL_PADDING,
      borderColor: "rgba(255, 80, 80, 0.35)",
      editingBorderColor: "rgba(255, 80, 80, 0.55)",
      cursorColor: fill,
      selectionColor: "rgba(255, 80, 80, 0.15)",
      shadow: new fabric.Shadow({
        color: "rgba(255,255,255,0.8)",
        blur: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    });
  };

  const setTextIdleVisuals = (text: EditableTextObject) => {
    const fill = (typeof text.fill === "string" && text.fill ? text.fill : "#000000") as string;
    text.set({
      fontFamily: "Arial",
      fill,
      backgroundColor: "rgba(255,255,255,0.25)",
      padding: TEXT_HORIZONTAL_PADDING,
      borderColor: "rgba(0,0,0,0)",
      editingBorderColor: "rgba(0,0,0,0)",
      shadow: null,
    });
  };

  /**
   * На каждом `changed` применяет `textFontSizeRef` к только что вставленному / заменённому
   * фрагменту (в т.ч. в середине абзаца), не трогая остальной текст.
   */
  const bindITextSizeOnTextChange = (t: EditableTextObject) => {
    const rec = t as unknown as Record<string, boolean>;
    if (rec[ITEXT_SIZE_LISTENER]) {
      return;
    }
    rec[ITEXT_SIZE_LISTENER] = true;
    let lastText = typeof t.text === "string" ? t.text : "";
    t.on("changed", () => {
      const textCanvas = textCanvasRef.current;
      if (isLoadingDrawingRef.current) {
        lastText = typeof t.text === "string" ? t.text : "";
        return;
      }
      const now = typeof t.text === "string" ? t.text : "";
      const cursorAfter = t.selectionStart ?? 0;
      const range = findFontSizeApplyRange(lastText, now, cursorAfter);
      if (range && range.end > range.start) {
        t.setSelectionStyles(
          { fontSize: textFontSizeRef.current },
          range.start,
          range.end,
        );
        t.initDimensions();
        setTextEditingVisuals(t);
      }
      lastText = now;
      if (textCanvas) {
        textCanvas.requestRenderAll();
      }
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
    });
  };
  bindITextSizeOnTextChangeRef.current = bindITextSizeOnTextChange;

  const ensureTextUiBound = (t: EditableTextObject) => {
    const rec = t as unknown as Record<string, unknown>;
    if (rec[TEXT_UI_BOUND_KEY]) {
      return;
    }
    rec[TEXT_UI_BOUND_KEY] = true;

    bindITextSizeOnTextChange(t);
    setTextIdleVisuals(t);

    t.on("editing:entered", () => {
      setTextEditingVisuals(t);
      applyTextLocaleToObject(t);
      bindTextKeyboardShortcuts(t);
      const textCanvas = textCanvasRef.current;
      textCanvas?.requestRenderAll();
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
      t.hiddenTextarea?.focus();
    });

    t.on("editing:exited", () => {
      setTextIdleVisuals(t);
      const textCanvas = textCanvasRef.current;
      textCanvas?.requestRenderAll();
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
    });
  };

  /**
   * Смена кегля через `setSelectionStyles` (Fabric): выделение — на весь range;
   * свернутый курсор — стиль в точке [s, s+1) для след. ввода. Затем `initDimensions` и сохранение
   * полного JSON объекта (persist + `changed` для согласованности с Realtime/Supabase).
   */
  const handleFontSizeChange = (size: number) => {
    const next: TextSizeOption =
      size === 10 || size === 14 || size === 18
        ? size
        : ([10, 14, 18] as const).reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a));
    setTextFontSize(next);
    textFontSizeRef.current = next;

    const textCanvas = textCanvasRef.current;
    if (!textCanvas) {
      return;
    }
    const active = textCanvas.getActiveObject();
    if (!active) {
      return;
    }
    if (!(active instanceof fabric.IText) && !(active instanceof fabric.Textbox)) {
      return;
    }
    const t = active as EditableTextObject;

    if (t.isEditing) {
      t.setSelectionStyles({ fontSize: next });
    } else {
      const s = t.selectionStart ?? 0;
      const e = t.selectionEnd ?? s;
      if (e > s) {
        t.setSelectionStyles({ fontSize: next }, s, e);
      } else {
        t.setSelectionStyles({ fontSize: next }, s, s + 1);
      }
    }
    t.initDimensions();
    if (t.isEditing) {
      setTextEditingVisuals(t);
    }
    void persistFabricObject("text", t);
    textCanvas.requestRenderAll();
    recalcDocumentHeightRef.current?.();
    requestSaveRef.current?.();
  };

  const clearTextEditingVisuals = () => {
    const textCanvas = textCanvasRef.current;
    if (!textCanvas) {
      return;
    }

    const textObjects = textCanvas
      .getObjects()
      .filter((obj): obj is EditableTextObject => obj instanceof fabric.IText || obj instanceof fabric.Textbox);

    textObjects.forEach((text) => {
      if (text.isEditing) {
        text.exitEditing();
      }
      setTextIdleVisuals(text);
    });

    textCanvas.discardActiveObject();
    textCanvas.requestRenderAll();
  };

  useOfflineSync({
    enabled: true,
    syncDrawingId: canvasObjectsDrawingId,
    canvasesReady,
    isRestoringRef: isLoadingDrawingRef,
    imgCanvasRef,
    textCanvasRef,
    drawCanvasRef,
  });

  const loadDrawing = useCallback(
    async (
      data: CanvasSnapshot,
      opts?: { isCancelled?: () => boolean; skipHistorySeed?: boolean },
    ) => {
      console.log("Загруженные данные:", data);
      const isCancelled = opts?.isCancelled ?? (() => false);
      const imgCanvas = imgCanvasRef.current;
      const textCanvas = textCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!imgCanvas || !textCanvas || !drawCanvas) {
        return;
      }

      imgCanvas.clear();
      textCanvas.clear();
      drawCanvas.clear();
      imgCanvas.backgroundColor = "#ffffff";
      textCanvas.backgroundColor = "rgba(0,0,0,0)";
      drawCanvas.backgroundColor = "rgba(0,0,0,0)";

      const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const source = (
        raw.content && typeof raw.content === "object"
          ? (raw.content as Record<string, unknown>)
          : raw
      ) as Record<string, unknown>;
      const snapshot = normalizeSnapshotByFabricType({
        imgLayer: source.imgLayer ?? source.img_layer ?? { objects: [] },
        textLayer: source.textLayer ?? source.text_layer ?? { objects: [] },
        drawLayer: source.drawLayer ?? source.draw_layer ?? { objects: [] },
        canvasWidth:
          typeof source.canvasWidth === "number"
            ? source.canvasWidth
            : typeof source.canvas_width === "number"
              ? source.canvas_width
              : undefined,
        canvasHeight:
          typeof source.canvasHeight === "number"
            ? source.canvasHeight
            : typeof source.canvas_height === "number"
              ? source.canvas_height
              : drawCanvas.getHeight(),
        savedAt:
          typeof source.savedAt === "string"
            ? source.savedAt
            : typeof source.saved_at === "string"
              ? source.saved_at
              : new Date().toISOString(),
      });
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
        .filter((obj): obj is EditableTextObject => obj instanceof fabric.IText || obj instanceof fabric.Textbox);
      for (const t of texts) {
        bindITextSizeOnTextChangeRef.current?.(t);
      }
      const lastImage = images.length > 0 ? images[images.length - 1] : null;
      const lastText = texts.length > 0 ? texts[texts.length - 1] : null;

      lastInsertedImageRef.current = lastImage;
      lastTextObjectRef.current = lastText;
      recalcDocumentHeightRef.current?.();

      if (!opts?.skipHistorySeed) {
        try {
          undoStackRef.current = [JSON.parse(JSON.stringify(snapshot)) as CanvasSnapshot];
        } catch {
          undoStackRef.current = [];
        }
        setCanUndo(false);
      }
      suppressHistoryUntilRef.current = Date.now() + 400;
    },
    [],
  );

  const performUndo = useCallback(async () => {
    if (undoStackRef.current.length <= 1) {
      return;
    }
    undoStackRef.current.pop();
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    if (!prev) {
      return;
    }
    isLoadingDrawingRef.current = true;
    try {
      await loadDrawing(JSON.parse(JSON.stringify(prev)) as CanvasSnapshot, {
        skipHistorySeed: true,
      });
    } finally {
      isLoadingDrawingRef.current = false;
    }
    setCanUndo(undoStackRef.current.length > 1);
    suppressHistoryUntilRef.current = Date.now() + 400;
    requestSaveRef.current?.();
  }, [loadDrawing]);

  const handleNewDocument = useCallback(async () => {
    if (
      !window.confirm(
        "Создать новый документ? Несохранённые изменения будут потеряны.",
      )
    ) {
      return;
    }
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }
    clearTextEditingVisuals();
    isLoadingDrawingRef.current = true;
    try {
      const w = drawCanvas.getWidth();
      const minH = getMinDocumentHeightForWidth(w);
      const snapshot: CanvasSnapshot = {
        imgLayer: { objects: [] },
        textLayer: { objects: [] },
        drawLayer: { objects: [] },
        canvasWidth: w,
        canvasHeight: minH,
        savedAt: new Date().toISOString(),
      };
      await loadDrawing(snapshot);
      await persistSnapshotLocally(snapshot, { pendingSync: false });
      await persistToDexie(snapshot);
      pendingImageStorageDeletesRef.current.clear();
      lastInsertedImageRef.current = null;
      lastTextObjectRef.current = null;
      setPencilColor(DEFAULT_PENCIL_COLOR);
      pencilColorRef.current = DEFAULT_PENCIL_COLOR;
      setPencilWidth(DEFAULT_PENCIL_WIDTH);
      setTextFontSize(DEFAULT_TEXT_SIZE);
      textFontSizeRef.current = DEFAULT_TEXT_SIZE;
      setActiveTool("pencil");
      activeToolRef.current = "pencil";
      setIsImageDeleteMode(false);
      isImageDeleteModeRef.current = false;
      setDefaultWorkName("MyBoard");
      router.replace("/");
      recalcDocumentHeightRef.current?.();
      requestSaveRef.current?.();
    } finally {
      isLoadingDrawingRef.current = false;
    }
  }, [loadDrawing, persistSnapshotLocally, persistToDexie, router]);

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
        let netStarted = false;
        try {
          beginNetworkOp();
          netStarted = true;
          await prepareImageLayerForSnapshot(imgCanvas);
          const imgLayer = imgCanvas.toObject([
            ...SNAPSHOT_IMAGE_PROPS,
            OBJECT_UPDATED_AT_KEY,
          ]) as {
            objects?: unknown[];
          };
          assertImageJsonUsesRemoteSrcOnly(imgLayer);
          const textLayer = textCanvas.toObject([OBJECT_UPDATED_AT_KEY]);
          const drawLayer = drawCanvas.toObject([OBJECT_UPDATED_AT_KEY]);
          const snapshot: CanvasSnapshot = {
            imgLayer,
            textLayer,
            drawLayer,
            canvasWidth: drawCanvas.getWidth(),
            canvasHeight: drawCanvas.getHeight(),
            savedAt: new Date().toISOString(),
          };
          await persistSnapshotLocally(snapshot, {
            pendingSync: typeof navigator !== "undefined" && !navigator.onLine,
          });
          await persistToDexie(snapshot);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return;
          }
          const { error } = await supabase
            .from(SUPABASE_CANVAS_TABLE)
            .upsert(
              {
                id: SUPABASE_DOCUMENT_ID,
                img_layer: snapshot.imgLayer,
                text_layer: snapshot.textLayer,
                draw_layer: snapshot.drawLayer,
                canvas_height: snapshot.canvasHeight,
                updated_at: snapshot.savedAt,
              },
              { onConflict: "id" },
            );

          if (error) {
            console.warn("Supabase save failed:", error.message);
            bumpNetworkError();
            await persistSnapshotLocally(snapshot, { pendingSync: true });
          } else {
            await persistSnapshotLocally(snapshot, { pendingSync: false });
            const toRemove = [...pendingImageStorageDeletesRef.current];
            pendingImageStorageDeletesRef.current.clear();
            if (toRemove.length > 0) {
              try {
                await removeStorageObjects(toRemove);
              } catch (e) {
                console.warn("Storage remove failed:", e);
                bumpNetworkError();
              }
            }
          }
        } catch (e) {
          console.warn("Autosave failed:", e);
          bumpNetworkError();
        } finally {
          if (netStarted) {
            endNetworkOp();
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

    const undoSnapshotFingerprint = (s: CanvasSnapshot) =>
      JSON.stringify({
        imgLayer: s.imgLayer,
        textLayer: s.textLayer,
        drawLayer: s.drawLayer,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
      });

    const commitUndoHistory = async () => {
      if (isLoadingDrawingRef.current) {
        return;
      }
      if (Date.now() < suppressHistoryUntilRef.current) {
        return;
      }
      const ic = imgCanvasRef.current;
      const tc = textCanvasRef.current;
      const dc = drawCanvasRef.current;
      if (!ic || !tc || !dc) {
        return;
      }
      beginNetworkOp();
      let snap: CanvasSnapshot;
      try {
        snap = await buildDocumentSnapshot(ic, tc, dc);
      } finally {
        endNetworkOp();
      }
      const fp = undoSnapshotFingerprint(snap);
      const top = undoStackRef.current[undoStackRef.current.length - 1];
      if (top && undoSnapshotFingerprint(top) === fp) {
        return;
      }
      undoStackRef.current.push(JSON.parse(JSON.stringify(snap)) as CanvasSnapshot);
      while (undoStackRef.current.length > 6) {
        undoStackRef.current.shift();
      }
      setCanUndo(undoStackRef.current.length > 1);
    };

    let historyDebounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleUndoHistory = () => {
      if (historyDebounce) {
        clearTimeout(historyDebounce);
      }
      historyDebounce = setTimeout(() => {
        historyDebounce = null;
        void commitUndoHistory();
      }, 480);
    };

    drawCanvas.on("path:created", (event) => {
      if (!event.path) {
        return;
      }
      ensureObjectUuid(event.path);
      markObjectUpdatedAt(event.path);
      void persistFabricObject("draw", event.path);
      if (activeToolRef.current === "pencil") {
        event.path.set({ stroke: pencilColorRef.current });
        event.path.globalCompositeOperation = "source-over";
      } else {
        event.path.globalCompositeOperation = "destination-out";
      }
      drawCanvas.renderAll();
      scheduleRecalc();
      queueSaveDocument();
    });

    const handleTextPointer = (event: fabric.TPointerEventInfo) => {
      if (isImageDeleteModeRef.current) {
        return;
      }
      if (activeToolRef.current !== "text") {
        if (!event.target) {
          clearTextEditingVisuals();
          queueSaveDocument();
        }
        return;
      }
      if (event.target instanceof fabric.IText || event.target instanceof fabric.Textbox) {
        lastTextObjectRef.current = event.target;
        setTextEditingVisuals(event.target);
        textCanvas.setActiveObject(event.target);
        event.target.enterEditing();
        event.target.hiddenTextarea?.focus();
        applyTextLocaleToObject(event.target);
        bindTextKeyboardShortcuts(event.target);
        textCanvas.requestRenderAll();
        queueSaveDocument();
        return;
      }
      clearTextEditingVisuals();
      const p = textCanvas.getScenePoint(event.e);
      const maxWidth = Math.max(180, Math.floor(textCanvas.getWidth() * 0.8));
      const size = textFontSizeRef.current;
      const newText = new fabric.IText("", {
        left: Math.max(16, p.x),
        top: Math.max(16, p.y),
        width: maxWidth,
        fontFamily: "Arial",
        fontSize: size,
        fill: "#000000",
        editable: true,
        objectCaching: false,
        backgroundColor: "rgba(255,255,255,0.25)",
        padding: TEXT_HORIZONTAL_PADDING,
        borderColor: "rgba(255, 80, 80, 0.35)",
        editingBorderColor: "rgba(255, 80, 80, 0.55)",
        cursorColor: "#000000",
        selectionColor: "rgba(255, 80, 80, 0.15)",
      });
      const smartPos = getSmartPosition(textCanvas, newText);
      newText.set({ left: smartPos.left, top: smartPos.top });
      setTextIdleVisuals(newText);
      bindITextSizeOnTextChange(newText);
      newText.on("editing:entered", () => {
        setTextEditingVisuals(newText);
        applyTextLocaleToObject(newText);
        bindTextKeyboardShortcuts(newText);
        textCanvas.requestRenderAll();
        recalcDocumentHeightRef.current?.();
      });
      newText.on("editing:exited", () => {
        setTextIdleVisuals(newText);
        textCanvas.requestRenderAll();
        recalcDocumentHeightRef.current?.();
        requestSaveRef.current?.();
      });
      lastTextObjectRef.current = newText;
      textCanvas.add(newText);
      textCanvas.setActiveObject(newText);
      newText.enterEditing();
      newText.hiddenTextarea?.focus();
      applyTextLocaleToObject(newText);
      bindTextKeyboardShortcuts(newText);
      textCanvas.requestRenderAll();
      recalcDocumentHeightRef.current?.();
      queueSaveDocument();
    };

    drawCanvas.on("mouse:down", handleTextPointer);
    textCanvas.on("mouse:down", handleTextPointer);

    textCanvas.on("mouse:dblclick", (event) => {
      if (!(event.target instanceof fabric.IText) && !(event.target instanceof fabric.Textbox)) {
        return;
      }
      lastTextObjectRef.current = event.target;
      setTextEditingVisuals(event.target);
      textCanvas.setActiveObject(event.target);
      event.target.enterEditing();
      event.target.selectAll();
      event.target.hiddenTextarea?.focus();
      applyTextLocaleToObject(event.target);
      bindTextKeyboardShortcuts(event.target);
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
      canvas.on("object:added", (evt) => {
        const target = evt.target as fabric.Object | null;
        ensureObjectUuid(target);
        markObjectUpdatedAt(target);
        if (
          canvas === textCanvas &&
          (target instanceof fabric.IText || target instanceof fabric.Textbox)
        ) {
          ensureTextUiBound(target);
        }
      });
      canvas.on("object:modified", (evt) => markObjectUpdatedAt(evt.target as fabric.Object | null));
      canvas.on("object:added", (evt) => {
        const layer: "img" | "text" | "draw" =
          canvas === imgCanvas ? "img" : canvas === textCanvas ? "text" : "draw";
        void persistFabricObject(layer, evt.target as fabric.Object | null);
      });
      canvas.on("object:modified", (evt) => {
        const layer: "img" | "text" | "draw" =
          canvas === imgCanvas ? "img" : canvas === textCanvas ? "text" : "draw";
        void persistFabricObject(layer, evt.target as fabric.Object | null);
      });
      canvas.on("object:added", scheduleRecalc);
      canvas.on("object:removed", scheduleRecalc);
      canvas.on("object:modified", scheduleRecalc);
      canvas.on("object:added", queueSaveDocument);
      canvas.on("object:removed", queueSaveDocument);
      canvas.on("object:modified", queueSaveDocument);
      canvas.on("object:added", () => {
        void commitUndoHistory();
      });
      canvas.on("object:removed", () => {
        void commitUndoHistory();
      });
      canvas.on("object:modified", () => {
        scheduleUndoHistory();
      });
    });

    setCanvasesReady(true);

    return () => {
      setCanvasesReady(false);
      if (historyDebounce) {
        clearTimeout(historyDebounce);
        historyDebounce = null;
      }
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
  }, [beginNetworkOp, buildDocumentSnapshot, drawingIdToLoad, endNetworkOp, persistFabricObject]);

  useEffect(() => {
    const onOnline = () => {
      void syncPendingLocalSnapshot();
      void syncDexieCanvasObjectsWithSupabase().catch((e) =>
        console.warn("Dexie sync on online failed:", e),
      );
      void syncOfflineChanges();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncOfflineChanges, syncPendingLocalSnapshot]);

  useEffect(() => {
    if (!canvasesReady) {
      return;
    }
    const timer = window.setInterval(async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        return;
      }
      const imgCanvas = imgCanvasRef.current;
      const textCanvas = textCanvasRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!imgCanvas || !textCanvas || !drawCanvas) {
        return;
      }
      try {
        const snapshot = await buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
        await persistSnapshotLocally(snapshot, { pendingSync: true });
        await persistToDexie(snapshot);
      } catch (e) {
        console.warn("Offline autosave to IndexedDB failed:", e);
      }
    }, OFFLINE_AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [buildDocumentSnapshot, canvasesReady, persistSnapshotLocally, persistToDexie]);

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
      beginNetworkOp();
      try {
        isLoadingDrawingRef.current = true;
        const drawing = await getDrawingById(drawingIdToLoad);
        if (isCancelled) {
          return;
        }
        const base = drawing.content;
        if (!base) {
          return;
        }
        let objectRows = await getLocalCanvasObjectsByDrawingId(drawingIdToLoad);
        if (objectRows.length === 0 && typeof navigator !== "undefined" && navigator.onLine) {
          try {
            objectRows = await fetchCanvasObjectsFromSupabase(drawingIdToLoad);
          } catch (e) {
            console.warn("canvas_objects: fetch for load failed, using drawings.content", e);
          }
        }
        const snapshot =
          objectRows.length > 0
            ? buildSnapshotFromObjectRows(objectRows, base)
            : normalizeSnapshotByFabricType(base);
        await loadDrawing(snapshot, { isCancelled: () => isCancelled });
        if (objectRows.length > 0) {
          await replaceDrawingCanvasObjectsLocal(drawingIdToLoad, objectRows);
        }
        await persistSnapshotLocally(snapshot, { pendingSync: false });
        await persistToDexie(snapshot, { myBoardReconcile: false });
      } catch (error) {
        console.warn("Failed to load drawing:", error);
        bumpNetworkError();
      } finally {
        endNetworkOp();
        isLoadingDrawingRef.current = false;
      }
    };

    void run();
    return () => {
      isCancelled = true;
    };
  }, [drawingIdToLoad, loadDrawing, persistSnapshotLocally, persistToDexie]);

  useEffect(() => {
    if (!drawingIdToLoad) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("canvas_objects")
          .select("id,drawing_id,object_id,layer,payload,updated_at,last_sync_tstamp")
          .eq("drawing_id", drawingIdToLoad);
        if (error) {
          throw error;
        }
        if (cancelled) {
          return;
        }
        const rows = (data ?? []).map((row) =>
          supabaseRowToCanvasObject({
            id: String(row.id),
            drawing_id: String(row.drawing_id),
            object_id: String(row.object_id),
            layer: String(row.layer),
            payload: row.payload,
            updated_at: String(row.updated_at ?? new Date().toISOString()),
          }),
        );
        await replaceDrawingCanvasObjectsLocal(drawingIdToLoad, rows);
      } catch (e) {
        console.warn("Failed to hydrate Dexie from Supabase canvas_objects:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawingIdToLoad]);

  useEffect(() => {
    if (!canvasesReady || drawingIdToLoad) {
      return;
    }
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }
    void (async () => {
      try {
        const snapshot = await buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
        await persistSnapshotLocally(snapshot, { pendingSync: false });
        await persistToDexie(snapshot);
      } catch (e) {
        console.warn("Initial local snapshot failed:", e);
      }
    })();
  }, [buildDocumentSnapshot, canvasesReady, drawingIdToLoad, persistSnapshotLocally, persistToDexie]);

  useEffect(() => {
    if (!canvasesReady || drawingIdToLoad) {
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await loadSnapshotFromDexie();
        if (!snapshot || cancelled) {
          return;
        }
        isLoadingDrawingRef.current = true;
        try {
          await loadDrawing(snapshot);
          await persistSnapshotLocally(snapshot, { pendingSync: true });
        } finally {
          isLoadingDrawingRef.current = false;
        }
      } catch (e) {
        console.warn("Dexie offline load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasesReady, drawingIdToLoad, loadDrawing, persistSnapshotLocally]);

  useEffect(() => {
    if (!canvasesReady) {
      return;
    }
    const draftRoom = draftRoomIdRef.current;
    if (!draftRoom || drawingIdToLoad) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const expRaw = localStorage.getItem(DRAFT_EXPIRES_AT_KEY);
        const expiresAt = expRaw ? Number(expRaw) : 0;
        const now = Date.now();
        const latest = await getLatestDrawingByRoom(draftRoom);
        if (cancelled || !latest) {
          return;
        }
        if (Number.isFinite(expiresAt) && expiresAt > now) {
          const shouldResume = window.confirm(
            "Найден временный черновик. Продолжить работу с последнего автосохранения?",
          );
          if (shouldResume) {
            isLoadingDrawingRef.current = true;
            try {
              await loadDrawing(latest.content);
              draftRowIdRef.current = latest.id;
              setDefaultWorkName(latest.name.replace(/\s*\(черновик\)\s*$/i, ""));
            } finally {
              isLoadingDrawingRef.current = false;
            }
          }
        } else if (latest.id) {
          await deleteDrawingById(latest.id);
          localStorage.removeItem(DRAFT_ROW_ID_KEY);
          localStorage.removeItem(DRAFT_EXPIRES_AT_KEY);
        }
      } catch (e) {
        console.warn("Draft resume check failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasesReady, drawingIdToLoad, loadDrawing]);

  useEffect(() => {
    if (!canvasesReady) {
      return;
    }
    const timer = window.setInterval(() => {
      if (isLoadingDrawingRef.current) {
        return;
      }
      void saveDraftSnapshot();
    }, AUTOSAVE_DRAFT_MS);
    return () => window.clearInterval(timer);
  }, [canvasesReady, saveDraftSnapshot]);

  useEffect(() => {
    const onPageHide = () => {
      if (didManualSaveRef.current) {
        return;
      }
      void saveDraftSnapshot({ forcePreview: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [saveDraftSnapshot]);

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
    pencilColorRef.current = pencilColor;
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
      brush.width = pencilWidth;
      brush.color = pencilColor;
      drawCanvas.freeDrawingBrush = brush;
    }
    drawCanvas.isDrawingMode =
      !isImageDeleteMode && (activeTool === "pencil" || activeTool === "eraser");
    textCanvas.defaultCursor = activeTool === "text" ? "text" : "default";
  }, [activeTool, isImageDeleteMode, pencilColor, pencilWidth]);

  useEffect(() => {
    textFontSizeRef.current = textFontSize;
  }, [textFontSize]);

  const addText = () => {
    setIsImageDeleteMode(false);
    isImageDeleteModeRef.current = false;
    activeToolRef.current = "text";
    setActiveTool("text");
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!textCanvas || !drawCanvas) {
      return;
    }

    // '+' (новый текстовый блок): сбрасываем "текущий размер" к дефолту 14.
    setTextFontSize(DEFAULT_TEXT_SIZE);
    textFontSizeRef.current = DEFAULT_TEXT_SIZE;

    textCanvas.wrapperEl.style.pointerEvents = "auto";
    textCanvas.upperCanvasEl.style.pointerEvents = "auto";
    drawCanvas.wrapperEl.style.pointerEvents = "none";
    drawCanvas.upperCanvasEl.style.pointerEvents = "none";
    drawCanvas.isDrawingMode = false;
    textCanvas.defaultCursor = "text";

    const canvasWidth = textCanvas.getWidth();
    const baseLeft = Math.max(20, canvasWidth * 0.1);
    const baseTop = 48;
    const width = Math.max(180, Math.floor(canvasWidth * 0.8));

    const newText = new fabric.IText("Начните печатать...", {
      left: baseLeft,
      top: baseTop,
      width,
      fontFamily: "Arial",
      fontSize: DEFAULT_TEXT_SIZE,
      fill: "#000000",
      editable: true,
      objectCaching: false,
    });

    // Чтобы остальные участники могли открыть редактирование сразу после INSERT.
    (newText as fabric.Object & { set: (k: string, v: boolean) => void }).set(FORCE_EDIT_KEY, true);

    const smartPos = getSmartPosition(textCanvas, newText);
    newText.set({ left: smartPos.left, top: smartPos.top });

    ensureTextUiBound(newText);
    lastTextObjectRef.current = newText;
    textCanvas.add(newText);
    // Сразу после add — чтобы гарантированно появился курсор/обновление.
    textCanvas.requestRenderAll();
    textCanvas.setActiveObject(newText);
    newText.enterEditing();
    try {
      const len = typeof newText.text === "string" ? newText.text.length : 0;
      newText.hiddenTextarea?.setSelectionRange(len, len);
    } catch {
      // ignore
    }
  };

  const editExistingText = () => {
    setIsImageDeleteMode(false);
    isImageDeleteModeRef.current = false;
    activeToolRef.current = "text";
    setActiveTool("text");

    const textCanvas = textCanvasRef.current;
    if (!textCanvas) {
      return;
    }

    const candidate =
      (lastTextObjectRef.current && textCanvas.getObjects().includes(lastTextObjectRef.current)
        ? lastTextObjectRef.current
        : null) ??
      (textCanvas
        .getObjects()
        .filter(
          (o): o is EditableTextObject => o instanceof fabric.IText || o instanceof fabric.Textbox,
        )
        .at(-1) ?? null);

    if (!candidate) {
      return;
    }

    ensureTextUiBound(candidate);
    const t = candidate;

    textCanvas.setActiveObject(t);
    const len = typeof t.text === "string" ? t.text.length : 0;
    t.enterEditing();
    try {
      t.hiddenTextarea?.setSelectionRange(len, len);
    } catch {
      // ignore
    }
    t.setSelectionStyles({ fontSize: textFontSizeRef.current });
    t.hiddenTextarea?.focus();

    if (t.isEditing) {
      setTextEditingVisuals(t);
    }
    t.initDimensions();
    textCanvas.requestRenderAll();
    recalcDocumentHeightRef.current?.();
    void persistFabricObject("text", t);
    requestSaveRef.current?.();
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const saveToSupabase = async (name: string) => {
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return;
    }

    const trimmed = name.trim() || "MyBoard";
    setIsSavingToDrawings(true);
    beginNetworkOp();
    didManualSaveRef.current = true;
    try {
      const content = await buildDocumentSnapshot(imgCanvas, textCanvas, drawCanvas);
      const previewDataUrl = drawCanvas.toDataURL({
        format: "png",
        quality: 0.1,
        multiplier: 1,
      });
      const roomIdForSave =
        (typeof collabRoomId === "string" && collabRoomId.trim()) ||
        `saved:${crypto.randomUUID()}`;
      await upsertProjectLocal({
        id: drawingIdToLoad ?? SUPABASE_DOCUMENT_ID,
        name: trimmed,
        updated_at: content.savedAt,
      });
      const created = await createDrawing({
        name: trimmed,
        content,
        roomId: roomIdForSave,
        previewUrl: previewDataUrl,
      });
      router.replace(`/?id=${created.id}`);
      publishSavedWorkCreated(created);
      requestSavedWorksRefresh();
      setSaveSuccessTick((n) => n + 1);
      if (draftRowIdRef.current) {
        try {
          await deleteDrawingById(draftRowIdRef.current);
        } catch (e) {
          console.warn("Failed to remove draft after manual save:", e);
        }
      }
      localStorage.removeItem(DRAFT_ROW_ID_KEY);
      localStorage.removeItem(DRAFT_EXPIRES_AT_KEY);
      setDefaultWorkName(trimmed);
      const toRemove = [...pendingImageStorageDeletesRef.current];
      pendingImageStorageDeletesRef.current.clear();
      if (toRemove.length > 0) {
        try {
          await removeStorageObjects(toRemove);
        } catch (e) {
          console.warn("removeStorageObjects after save:", e);
          bumpNetworkError();
        }
      }
    } catch (error) {
      console.warn("saveToSupabase failed:", error);
      bumpNetworkError();
    } finally {
      didManualSaveRef.current = false;
      endNetworkOp();
      setIsSavingToDrawings(false);
    }
  };

  const renderBoardToExportCanvas = (): HTMLCanvasElement | null => {
    const imgCanvas = imgCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!imgCanvas || !textCanvas || !drawCanvas) {
      return null;
    }

    const width = drawCanvas.getWidth();
    const height = drawCanvas.getHeight();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;

    const context = exportCanvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(imgCanvas.lowerCanvasEl, 0, 0);
    context.drawImage(textCanvas.lowerCanvasEl, 0, 0);
    context.drawImage(drawCanvas.lowerCanvasEl, 0, 0);
    return exportCanvas;
  };

  const exportBoardDocument = useCallback(
    async (format: BoardExportFormat) => {
      const exportCanvas = renderBoardToExportCanvas();
      if (!exportCanvas) {
        return;
      }

      const ts = Date.now();
      if (format === "png") {
        const link = document.createElement("a");
        link.href = exportCanvas.toDataURL("image/png");
        link.download = `myboard-${ts}.png`;
        link.click();
        return;
      }

      if (format === "jpeg") {
        try {
          await new Promise<void>((resolve, reject) => {
            exportCanvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("jpeg blob"));
                  return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `myboard-${ts}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
                resolve();
              },
              "image/jpeg",
              0.92,
            );
          });
        } catch {
          bumpNetworkError();
        }
        return;
      }

      if (format === "pdf") {
        try {
          const { jsPDF } = await import("jspdf");
          const w = exportCanvas.width;
          const h = exportCanvas.height;
          const doc = new jsPDF(w > h ? "l" : "p", "px", [w, h]);
          const imgData = exportCanvas.toDataURL("image/jpeg", 0.92);
          doc.addImage(imgData, "JPEG", 0, 0, w, h);
          doc.save(`myboard-${ts}.pdf`);
        } catch (e) {
          console.warn("export pdf:", e);
          bumpNetworkError();
        }
      }
    },
    [bumpNetworkError],
  );

  const shareBoardNative = async (): Promise<boolean> => {
    if (typeof navigator === "undefined") {
      return false;
    }

    const exportCanvas = renderBoardToExportCanvas();
    if (!exportCanvas) {
      return false;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      exportCanvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) {
      return false;
    }

    const file = new File([blob], `myboard-${Date.now()}.png`, { type: "image/png" });
    const shareUrl = typeof window !== "undefined" ? window.location.href : undefined;
    const shareData: ShareData = {
      title: "MyBoard",
      text: "Скриншот моей доски",
      url: shareUrl,
      files: [file],
    };
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share(shareData);
      return true;
    }
    return false;
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const imgCanvas = imgCanvasRef.current;
    if (!file || !imgCanvas) {
      return;
    }

    beginNetworkOp();
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
      bumpNetworkError();
    } finally {
      endNetworkOp();
      event.target.value = "";
    }
  };

  const topChromePx = isMobileViewport
    ? STUDIO_CONSOLE_MOBILE_HEADER_PX
    : STUDIO_CONSOLE_HEIGHT_PX;

  const boardChrome = boardChromeFromAppearance(appearance);

  useEffect(() => {
    if (!canvasesReady) {
      return;
    }
    const img = imgCanvasRef.current;
    if (!img) {
      return;
    }
    const bg = appearance.comfort ? "#faf8f3" : appearance.inverted ? "#0a0a0a" : "#ffffff";
    img.set("backgroundColor", bg);
    img.requestRenderAll();
  }, [appearance.comfort, appearance.inverted, canvasesReady]);

  return (
    <section
      className={cn(
        "relative h-screen overflow-hidden",
        appearance.comfort ? "bg-[#eae5d6]" : appearance.inverted ? "bg-zinc-950" : "bg-gray-50",
      )}
    >
      <StudioConsole
        activeTool={activeTool}
        pencilColor={pencilColor}
        pencilWidth={pencilWidth}
        isImageDeleteMode={isImageDeleteMode}
        isSavingToDrawings={isSavingToDrawings}
        saveSuccessTick={saveSuccessTick}
        isProcessing={isProcessing}
        networkErrorTick={networkErrorTick}
        onBackgroundNetworkError={bumpNetworkError}
        textFontSize={textFontSize}
        collabRoomId={collabRoomId}
        collabParticipants={collabParticipants}
        roomFull={roomFull}
        maxRoomParticipants={MAX_ROOM_PARTICIPANTS}
        fileInputRef={fileInputRef}
        boardChrome={boardChrome}
        boardContentWidthClass={BOARD_CONTENT_WIDTH_CLASS}
        boardToolbarMaxClass="w-fit max-w-full shrink-0"
        canUndo={canUndo}
        onUndo={() => {
          void performUndo();
        }}
        onMyBoardInvert={() => {
          setAppearance((a) => ({ ...a, inverted: !a.inverted }));
        }}
        onMyBoardComfort={() => {
          setAppearance((a) =>
            a.comfort ? { inverted: false, comfort: false } : { ...a, comfort: true }
          );
        }}
        onNewDocument={handleNewDocument}
        onPaletteColor={(hex) => {
          clearTextEditingVisuals();
          setPencilColor(hex);
          pencilColorRef.current = hex;
          isImageDeleteModeRef.current = false;
          setIsImageDeleteMode(false);
          activeToolRef.current = "pencil";
          setActiveTool("pencil");
        }}
        onPencilWidthChange={(nextWidth) => {
          setPencilWidth(nextWidth);
        }}
        onEraser={() => {
          clearTextEditingVisuals();
          isImageDeleteModeRef.current = false;
          setIsImageDeleteMode(false);
          activeToolRef.current = "eraser";
          setActiveTool("eraser");
        }}
        onTextSize={(px) => {
          handleFontSizeChange(px);
        }}
        onAddText={addText}
        onEditText={editExistingText}
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
        defaultWorkName={defaultWorkName}
        onSaveToDatabase={(name) => {
          clearTextEditingVisuals();
          return saveToSupabase(name);
        }}
        onExportBoard={async (format) => {
          clearTextEditingVisuals();
          await exportBoardDocument(format);
        }}
        onShareBoard={shareBoardNative}
        onFileChange={onFileSelected}
      />

      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: `${topChromePx}px` }}
      >
        <div
          className={cn(
            "mx-auto flex w-full justify-center px-3 pb-8 pt-4",
            BOARD_OUTER_MAX_CLASS,
          )}
        >
          <div
            ref={boardContainerRef}
            className={cn(
              BOARD_WIDTH_CLASS,
              appearance.comfort
                ? "border-stone-300 bg-[#faf8f3]"
                : appearance.inverted
                  ? "border-zinc-700 bg-zinc-950"
                  : "border-gray-200 bg-white",
            )}
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

    </section>
  );
}
