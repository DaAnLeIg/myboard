"use client";

import type { ChangeEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleAlert,
  Download,
  Eraser,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Save,
  Share2,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useLibraryModal } from "../contexts/LibraryModalContext";
import { cn } from "../utils/cn";
import { ROOM_PARAM } from "../hooks/useCollaboration";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Slider } from "./ui/slider";
import { ColorPicker } from "./ui/color-picker";

const ICON = 1.75 as const;

/** Высота фиксированной консоли (одна строка на десктопе). */
export const STUDIO_CONSOLE_HEIGHT_PX = 56;
/** @deprecated Используйте STUDIO_CONSOLE_HEIGHT_PX */
export const TOOLBAR_HEIGHT_PX = STUDIO_CONSOLE_HEIGHT_PX;

export type Tool = "pencil" | "eraser" | "text";

export const PENCIL_SWATCHES = [
  { key: "black", color: "#000000" },
  { key: "white", color: "#ffffff" },
  { key: "yellow", color: "#facc15" },
  { key: "red", color: "#ef4444" },
  { key: "blue", color: "#2563eb" },
  { key: "green", color: "#16a34a" },
] as const;

export type TextSizeOption = 10 | 14 | 18;

/** Плавающая панель инструментов. */
const floatingToolbar =
  "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl bg-white px-2.5 py-1.5 shadow-lg";

/** Вложенные группы: рамка с внутренними отступами. */
const innerGroup =
  "inline-flex h-8 min-h-8 shrink-0 items-center gap-0.5 rounded-xl border border-zinc-200/80 bg-zinc-50/30 px-1.5";

const toolButtonBase =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 p-0 text-zinc-900 transition outline-none";

const toolButtonInactive = "bg-transparent hover:bg-gray-100";

const toolButtonActive = "bg-gray-200";

export type BoardChrome = "light" | "dark" | "ivory";

export type BoardExportFormat = "png" | "jpeg" | "pdf";

type StudioConsoleProps = {
  activeTool: Tool;
  pencilColor: string;
  pencilWidth: 1 | 3 | 5;
  isImageDeleteMode: boolean;
  isSavingToDrawings: boolean;
  /** Фоновые сетевые операции (Supabase, Storage, подготовка снимка). */
  isProcessing?: boolean;
  /** Увеличивается при ошибке фоновой операции — кратко подсвечивает иконку обновления. */
  networkErrorTick?: number;
  onBackgroundNetworkError?: () => void;
  textFontSize: TextSizeOption;
  collabRoomId: string;
  collabParticipants: number;
  roomFull: boolean;
  maxRoomParticipants: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  boardChrome: BoardChrome;
  boardOuterMaxClass: string;
  boardToolbarMaxClass: string;
  canUndo: boolean;
  onUndo: () => void;
  onMyBoardInvert: () => void;
  onMyBoardComfort: () => void;
  onPaletteColor: (hex: string) => void;
  onPencilWidthChange: (nextWidth: 1 | 3 | 5) => void;
  onEraser: () => void;
  onTextSize: (px: TextSizeOption) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onToggleImageDelete: () => void;
  onSaveToDatabase: (name: string) => void | Promise<void>;
  defaultWorkName: string;
  onExportBoard: (format: BoardExportFormat) => void | Promise<void>;
  onShareBoard?: () => Promise<boolean>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNewDocument?: () => void | Promise<void>;
};

export default function StudioConsole({
  activeTool,
  pencilColor,
  pencilWidth,
  isImageDeleteMode,
  isSavingToDrawings,
  isProcessing = false,
  networkErrorTick = 0,
  onBackgroundNetworkError,
  textFontSize,
  collabRoomId,
  collabParticipants,
  roomFull,
  maxRoomParticipants,
  fileInputRef,
  boardChrome,
  boardOuterMaxClass,
  boardToolbarMaxClass,
  canUndo,
  onUndo,
  onMyBoardInvert,
  onMyBoardComfort,
  onPaletteColor,
  onPencilWidthChange,
  onEraser,
  onTextSize,
  onAddText,
  onAddImage,
  onToggleImageDelete,
  onSaveToDatabase,
  defaultWorkName,
  onExportBoard,
  onShareBoard,
  onFileChange,
  onNewDocument,
}: StudioConsoleProps) {
  const path = usePathname();
  const { isOpen: libraryOpen, open: openLibrary } = useLibraryModal();
  const isHome = path === "/";
  const isLibrary = libraryOpen;
  const dark = boardChrome === "dark";
  const ivory = boardChrome === "ivory";

  const navLinkClass = (active: boolean) =>
    cn(
      "inline-flex items-center justify-center gap-0 rounded-full border px-2.5 text-sm font-medium shadow-sm transition",
      dark
        ? active
          ? "border-zinc-500 bg-zinc-800 text-zinc-100"
          : "border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
        : ivory
          ? active
            ? "border-stone-400 bg-[#ddd8c8] text-stone-900"
            : "border-stone-300 bg-[#e8e4d4] text-stone-900 hover:bg-[#ddd8c8]"
          : active
            ? "border-zinc-400 bg-gray-100 text-zinc-900"
            : "border-zinc-200 bg-white text-zinc-900 hover:bg-gray-100",
    );

  const myBoardChipClass = () =>
    cn(
      "inline-flex h-9 min-w-9 items-center justify-center gap-0 rounded-full border px-2.5 text-sm font-medium shadow-md transition",
      ivory
        ? "border-stone-400 bg-[#e0dbc9] text-stone-900 hover:bg-[#d5cfbc]"
        : dark
          ? "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100"
          : "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800",
    );

  const myBoardLongTimerRef = useRef<number | null>(null);
  const myBoardLongConsumedRef = useRef(false);

  const clearMyBoardLongTimer = () => {
    if (myBoardLongTimerRef.current != null) {
      window.clearTimeout(myBoardLongTimerRef.current);
      myBoardLongTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearMyBoardLongTimer();
    };
  }, []);

  const isPencilActive = activeTool === "pencil" && !isImageDeleteMode;
  const isEraserActive = activeTool === "eraser" && !isImageDeleteMode;
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [workName, setWorkName] = useState(defaultWorkName);
  const popoverId = useId();
  const saveGroupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWorkName((prev) => (saveNameOpen ? prev : defaultWorkName));
  }, [defaultWorkName, saveNameOpen]);

  useEffect(() => {
    if (!saveNameOpen) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (
        t instanceof Node &&
        saveGroupRef.current &&
        !saveGroupRef.current.contains(t)
      ) {
        setSaveNameOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [saveNameOpen]);

  const handleMainSaveClick = () => {
    if (isSavingToDrawings) {
      return;
    }
    setWorkName((w) => (w.trim() ? w : defaultWorkName));
    setSaveNameOpen(true);
  };

  const handleConfirmSave = () => {
    const name = workName.trim() || defaultWorkName;
    setSaveNameOpen(false);
    void Promise.resolve(onSaveToDatabase(name));
  };

  const buildRoomInviteUrl = (): string | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const room = collabRoomId?.trim();
    if (!room) {
      return null;
    }
    const u = new URL(`${window.location.origin}${window.location.pathname}`);
    u.searchParams.set(ROOM_PARAM, room);
    const cur = new URL(window.location.href);
    const docId = cur.searchParams.get("id") ?? cur.searchParams.get("drawing");
    if (docId?.trim()) {
      u.searchParams.set("id", docId.trim());
    }
    return u.toString();
  };

  const isValidRoomInviteUrl = (url: string): boolean => {
    try {
      const u = new URL(url);
      const r = u.searchParams.get(ROOM_PARAM)?.trim();
      return Boolean(r && r === collabRoomId.trim());
    } catch {
      return false;
    }
  };

  const [refreshErrorFlash, setRefreshErrorFlash] = useState(false);
  const [mobileRoomOpen, setMobileRoomOpen] = useState(false);
  const [desktopRoomOpen, setDesktopRoomOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportWrapRef = useRef<HTMLDivElement | null>(null);
  const exportLeaveTimerRef = useRef<number | null>(null);
  const [mobileFabOpen, setMobileFabOpen] = useState(false);
  const [mobileFabPinned, setMobileFabPinned] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileDockPos, setMobileDockPos] = useState({ x: 16, y: 16 });
  const fabLongPressTimerRef = useRef<number | null>(null);
  const fabLongPressTriggeredRef = useRef(false);
  const panelLongPressTimerRef = useRef<number | null>(null);
  const dragTimerRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, baseX: 16, baseY: 16 });

  useEffect(() => {
    if (!networkErrorTick) {
      return;
    }
    setRefreshErrorFlash(true);
    const id = window.setTimeout(() => setRefreshErrorFlash(false), 2200);
    return () => window.clearTimeout(id);
  }, [networkErrorTick]);

  const flashRefreshError = () => {
    onBackgroundNetworkError?.();
  };

  const clearFabLongPressTimer = () => {
    if (fabLongPressTimerRef.current != null) {
      window.clearTimeout(fabLongPressTimerRef.current);
      fabLongPressTimerRef.current = null;
    }
  };

  const clearPanelLongPressTimer = () => {
    if (panelLongPressTimerRef.current != null) {
      window.clearTimeout(panelLongPressTimerRef.current);
      panelLongPressTimerRef.current = null;
    }
  };

  const clearDragTimer = () => {
    if (dragTimerRef.current != null) {
      window.clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  };

  const startDragHold = (ev: React.PointerEvent<HTMLElement>) => {
    clearDragTimer();
    dragPointerIdRef.current = ev.pointerId;
    dragStartRef.current = {
      x: ev.clientX,
      y: ev.clientY,
      baseX: mobileDockPos.x,
      baseY: mobileDockPos.y,
    };
    dragActiveRef.current = false;
    dragTimerRef.current = window.setTimeout(() => {
      dragActiveRef.current = true;
    }, 350);
  };

  const moveDragHold = (ev: React.PointerEvent<HTMLElement>) => {
    if (!dragActiveRef.current || dragPointerIdRef.current !== ev.pointerId) {
      return;
    }
    const dx = dragStartRef.current.x - ev.clientX;
    const dy = dragStartRef.current.y - ev.clientY;
    setMobileDockPos({
      x: Math.max(8, Math.min(window.innerWidth - 72, dragStartRef.current.baseX + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 72, dragStartRef.current.baseY + dy)),
    });
  };

  const endDragHold = () => {
    clearDragTimer();
    dragActiveRef.current = false;
    dragPointerIdRef.current = null;
  };

  const startFabLongPress = () => {
    clearFabLongPressTimer();
    fabLongPressTriggeredRef.current = false;
    fabLongPressTimerRef.current = window.setTimeout(() => {
      fabLongPressTriggeredRef.current = true;
      setMobileFabPinned(true);
      setMobileFabOpen(true);
    }, 550);
  };

  const toggleFab = () => {
    if (fabLongPressTriggeredRef.current) {
      fabLongPressTriggeredRef.current = false;
      return;
    }
    setMobileFabOpen((prev) => !prev);
  };

  const clearExportLeaveTimer = () => {
    if (exportLeaveTimerRef.current != null) {
      window.clearTimeout(exportLeaveTimerRef.current);
      exportLeaveTimerRef.current = null;
    }
  };

  const openExportMenu = () => {
    clearExportLeaveTimer();
    setExportMenuOpen(true);
  };

  const scheduleCloseExportMenu = () => {
    clearExportLeaveTimer();
    exportLeaveTimerRef.current = window.setTimeout(() => {
      setExportMenuOpen(false);
      exportLeaveTimerRef.current = null;
    }, 240);
  };

  useEffect(() => {
    return () => {
      clearFabLongPressTimer();
      clearPanelLongPressTimer();
      clearDragTimer();
      clearExportLeaveTimer();
    };
  }, []);

  useEffect(() => {
    if (!exportMenuOpen || typeof document === "undefined") {
      return;
    }
    const onDocPointer = (e: PointerEvent) => {
      const el = exportWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    return () => document.removeEventListener("pointerdown", onDocPointer, true);
  }, [exportMenuOpen]);

  const handleShare = async () => {
    if (onShareBoard) {
      try {
        const shared = await onShareBoard();
        if (shared) {
          return;
        }
      } catch (e) {
        console.warn("Native board share failed:", e);
      }
    }
    const url = buildRoomInviteUrl();
    if (!url || !isValidRoomInviteUrl(url)) {
      flashRefreshError();
      return;
    }
    const text = `Присоединяйся к моей работе в MyBoard! Ссылка: ${url}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "MyBoard",
          text,
          url,
        });
        return;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : (e as Error)?.name;
        if (name === "AbortError") {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      flashRefreshError();
    }
  };

  const toolbarContent = (
    <>
      <div className={innerGroup}>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500" title="Карандаш" aria-hidden>
          <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} />
        </span>
        <div className="grid grid-cols-3 grid-rows-2 gap-0.5" role="group" aria-label="Цвет карандаша">
          {PENCIL_SWATCHES.map((sw) => {
            const selected = isPencilActive && pencilColor === sw.color;
            return (
              <button
                key={sw.key}
                type="button"
                onClick={() => onPaletteColor(sw.color)}
                className={`h-2 w-2 border-0 p-0 transition ${selected ? "ring-1 ring-inset ring-zinc-800 ring-offset-0" : "ring-0 hover:opacity-90"} rounded-sm`}
                style={{ backgroundColor: sw.color }}
                title={`Карандаш: ${sw.key}`}
                aria-label={`Карандаш, цвет ${sw.key}`}
                aria-pressed={selected}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={onEraser}
          className={`${toolButtonBase} ml-0.5 h-6 w-6 ${isEraserActive ? toolButtonActive : toolButtonInactive}`}
          title="Ластик"
          aria-pressed={isEraserActive}
          aria-label="Ластик"
        >
          <Eraser className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
        </button>
      </div>

      <div className={`${innerGroup} flex-col !h-auto py-1`} role="group" aria-label="Толщина линии">
        {[1, 3, 5].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onPencilWidthChange(w as 1 | 3 | 5)}
            className={`flex h-2.5 w-8 items-center justify-center rounded ${pencilWidth === w ? "bg-zinc-200" : "hover:bg-zinc-100"}`}
            title={`Толщина ${w}px`}
            aria-pressed={pencilWidth === w}
            aria-label={`Толщина линии ${w} пиксель${w > 1 ? "я" : ""}`}
          >
            <span className="block w-5 rounded-full bg-zinc-900" style={{ height: `${w}px` }} />
          </button>
        ))}
      </div>

      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`} title="Настройки кисти" aria-label="Настройки кисти">
            <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-700">Толщина (shadcn Slider)</p>
              <Slider
                value={[pencilWidth]}
                min={1}
                max={5}
                step={2}
                onValueChange={(v) => onPencilWidthChange((v[0] === 1 || v[0] === 5 ? v[0] : 3) as 1 | 3 | 5)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-700">Цвет (shadcn ColorPicker)</p>
              <ColorPicker color={pencilColor} onChange={onPaletteColor} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );

  return (
    <>
      <div
        className="pointer-events-none fixed right-2 top-2 z-[75] sm:right-3 sm:top-3"
        role="status"
        aria-label={`Пользователей в сети: ${collabParticipants} из ${maxRoomParticipants}`}
      >
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums shadow-sm backdrop-blur",
            dark
              ? "border-zinc-600/80 bg-zinc-900/90 text-zinc-200"
              : ivory
                ? "border-stone-300/80 bg-[#f0ebe0]/95 text-stone-700"
                : "border-zinc-200/70 bg-white/90 text-zinc-600",
          )}
          title="Участники в комнате"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
            aria-hidden
          />
          <span>
            {collabParticipants}
            <span className={dark ? "text-zinc-500" : ivory ? "text-stone-400" : "text-zinc-400"}>
              /
            </span>
            {maxRoomParticipants}
          </span>
        </div>
      </div>

      <div className="fixed inset-x-0 top-0 z-[70] flex items-start justify-between px-2.5 pt-2 sm:hidden">
        <div className="flex max-w-[min(100vw-1rem,28rem)] flex-wrap items-center gap-1.5">
          <Link
            href="/"
            className={cn(myBoardChipClass(), "min-h-9 shrink-0 px-2 text-xs")}
            title="MyBoard"
            aria-current={isHome ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.button !== 0) {
                return;
              }
              e.preventDefault();
              if (myBoardLongConsumedRef.current) {
                myBoardLongConsumedRef.current = false;
                return;
              }
              onMyBoardInvert();
            }}
            onPointerDown={() => {
              clearMyBoardLongTimer();
              myBoardLongConsumedRef.current = false;
              myBoardLongTimerRef.current = window.setTimeout(() => {
                myBoardLongConsumedRef.current = true;
                onMyBoardComfort();
              }, 650);
            }}
            onPointerUp={clearMyBoardLongTimer}
            onPointerLeave={clearMyBoardLongTimer}
            onPointerCancel={clearMyBoardLongTimer}
          >
            MyBoard
          </Link>
          <button
            type="button"
            onClick={() => {
              void onNewDocument?.();
            }}
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            title="Новая работа"
            aria-label="Новая работа"
          >
            <Plus className="h-5 w-5" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            title="Поделиться"
            aria-label="Поделиться ссылкой"
          >
            <Share2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={openLibrary}
            className={`${navLinkClass(isLibrary)} h-9 w-9 gap-0 p-0 shadow-md`}
            title="Библиотека работ"
            aria-label="Библиотека работ"
          >
            <FolderOpen className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
          <Popover open={mobileRoomOpen} onOpenChange={setMobileRoomOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
                title="Номер комнаты"
                aria-label="Показать номер комнаты"
              >
                <span className="select-none text-[17px] font-black leading-none tracking-tight" aria-hidden>
                  N
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(20rem,92vw)]">
              <p className="text-xs font-medium text-zinc-500">Комната</p>
              <p className="mt-1 break-all font-mono text-sm text-zinc-900">{collabRoomId}</p>
              {roomFull ? (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Комната заполнена (макс. {maxRoomParticipants})
                </p>
              ) : null}
              <button
                type="button"
                className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                onClick={async () => {
                  const url = buildRoomInviteUrl();
                  if (!url) {
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    flashRefreshError();
                  }
                }}
              >
                Копировать ссылку-приглашение
              </button>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => onUndo()}
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md disabled:cursor-not-allowed disabled:opacity-40`}
            title="Отменить (до 5 шагов)"
            aria-label="Отменить последнее действие"
          >
            <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
          <Link
            href="/privacy"
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            title="Политика конфиденциальности"
            aria-label="Политика конфиденциальности"
          >
            <CircleAlert className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </Link>
        </div>
      </div>

      <div
        className="fixed z-[90] sm:hidden"
        style={{ right: `${mobileDockPos.x}px`, bottom: `${mobileDockPos.y}px` }}
      >
        {mobileFabOpen ? (
          <div
            className={`${floatingToolbar} mb-2 max-w-[86vw] flex-col items-start`}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                clearPanelLongPressTimer();
                panelLongPressTimerRef.current = window.setTimeout(() => {
                  setMobileFabPinned(false);
                  setMobileFabOpen(false);
                }, 550);
              }
            }}
            onPointerUp={clearPanelLongPressTimer}
            onPointerCancel={clearPanelLongPressTimer}
            onPointerDownCapture={startDragHold}
            onPointerMove={moveDragHold}
            onPointerUpCapture={endDragHold}
            onPointerCancelCapture={endDragHold}
          >
            <div className="flex w-full flex-wrap items-center gap-1.5" role="toolbar" aria-label="Мобильные инструменты">
              {toolbarContent}
              <button type="button" onClick={onAddText} className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`}><Type className="h-4 w-4" strokeWidth={ICON} /></button>
              <button type="button" onClick={onAddImage} className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`}><ImageIcon className="h-4 w-4" strokeWidth={ICON} /></button>
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => onUndo()}
                className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive} disabled:cursor-not-allowed disabled:opacity-40`}
                title="Отменить"
                aria-label="Отменить последнее действие"
              >
                <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
              <button type="button" onClick={handleMainSaveClick} className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`}><Save className="h-4 w-4" strokeWidth={ICON} /></button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onPointerDown={startFabLongPress}
          onPointerUp={clearFabLongPressTimer}
          onPointerCancel={clearFabLongPressTimer}
          onPointerDownCapture={startDragHold}
          onPointerMove={moveDragHold}
          onPointerUpCapture={endDragHold}
          onPointerCancelCapture={endDragHold}
          onClick={toggleFab}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl"
          aria-label={mobileFabOpen ? "Свернуть инструменты" : "Открыть инструменты"}
          title={mobileFabPinned ? "Панель закреплена" : "Открыть инструменты (долгое нажатие закрепляет)"}
        >
          {mobileFabOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[70] hidden backdrop-blur sm:block",
          ivory ? "border-b border-stone-200/80 bg-[#ebe6d8]/95" : dark ? "border-b border-zinc-800 bg-zinc-900/90" : "bg-zinc-100/90",
        )}
        aria-label="Панель навигации и инструментов"
      >
        <div
          className={cn(
            "mx-auto flex w-full flex-wrap items-start gap-2 overflow-visible px-2.5 pb-0 pt-2",
            boardOuterMaxClass,
          )}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Link
              href="/"
              className={cn(myBoardChipClass(), isHome && "ring-2 ring-zinc-400 ring-offset-2 ring-offset-transparent")}
              title="MyBoard: нажать — инверсия; долгое — режим для глаз"
              aria-current={isHome ? "page" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                if (myBoardLongConsumedRef.current) {
                  myBoardLongConsumedRef.current = false;
                  return;
                }
                onMyBoardInvert();
              }}
              onPointerDown={() => {
                clearMyBoardLongTimer();
                myBoardLongConsumedRef.current = false;
                myBoardLongTimerRef.current = window.setTimeout(() => {
                  myBoardLongConsumedRef.current = true;
                  onMyBoardComfort();
                }, 650);
              }}
              onPointerUp={clearMyBoardLongTimer}
              onPointerLeave={clearMyBoardLongTimer}
              onPointerCancel={clearMyBoardLongTimer}
            >
              MyBoard
            </Link>
            <button
              type="button"
              onClick={() => {
                void onNewDocument?.();
              }}
              className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
              title="Новая работа"
              aria-label="Новая работа"
            >
              <Plus className="h-5 w-5" strokeWidth={ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
              title="Поделиться"
              aria-label="Поделиться ссылкой"
            >
              <Share2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={openLibrary}
              className={`${navLinkClass(isLibrary)} h-9 w-9 gap-0 p-0 shadow-md`}
              title="Библиотека работ"
              aria-label="Библиотека работ"
              aria-pressed={isLibrary}
            >
              <FolderOpen className="h-4 w-4" strokeWidth={ICON} aria-hidden />
            </button>
            <Popover open={desktopRoomOpen} onOpenChange={setDesktopRoomOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
                  title="Номер комнаты"
                  aria-label="Показать номер комнаты"
                >
                  <span className="select-none text-[17px] font-black leading-none tracking-tight" aria-hidden>
                    N
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(20rem,92vw)]">
                <p className="text-xs font-medium text-zinc-500">Комната</p>
                <p className="mt-1 break-all font-mono text-sm text-zinc-900">{collabRoomId}</p>
                {roomFull ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Комната заполнена (макс. {maxRoomParticipants})
                  </p>
                ) : null}
                <button
                  type="button"
                  className="mt-3 w-full rounded-md border border-zinc-300 bg-zinc-50 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                  onClick={async () => {
                    const url = buildRoomInviteUrl();
                    if (!url) {
                      return;
                    }
                    try {
                      await navigator.clipboard.writeText(url);
                    } catch {
                      flashRefreshError();
                    }
                  }}
                >
                  Копировать ссылку-приглашение
                </button>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => onUndo()}
              className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md disabled:cursor-not-allowed disabled:opacity-40`}
              title="Отменить (до 5 шагов)"
              aria-label="Отменить последнее действие"
            >
              <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
            </button>
            <Link
              href="/privacy"
              className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
              title="Политика конфиденциальности"
              aria-label="Политика конфиденциальности"
            >
              <CircleAlert className="h-4 w-4" strokeWidth={ICON} aria-hidden />
            </Link>
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-1 flex-wrap items-center justify-center sm:justify-end",
              boardToolbarMaxClass,
            )}
          >
            <div className={floatingToolbar} role="toolbar" aria-label="Инструменты">
            <div className={innerGroup}>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-zinc-500" title="Карандаш" aria-hidden>
                <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} />
              </span>
              <div
                className="grid grid-cols-3 grid-rows-2 gap-0.5"
                role="group"
                aria-label="Цвет карандаша"
              >
                {PENCIL_SWATCHES.map((sw) => {
                  const selected = isPencilActive && pencilColor === sw.color;
                  return (
                    <button
                      key={sw.key}
                      type="button"
                      onClick={() => onPaletteColor(sw.color)}
                      className={`h-2 w-2 border-0 p-0 transition ${
                        selected
                          ? "ring-1 ring-inset ring-zinc-800 ring-offset-0"
                          : "ring-0 hover:opacity-90"
                      } rounded-sm`}
                      style={{ backgroundColor: sw.color }}
                      title={`Карандаш: ${sw.key}`}
                      aria-label={`Карандаш, цвет ${sw.key}`}
                      aria-pressed={selected}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={onEraser}
                className={`${toolButtonBase} ml-0.5 h-6 w-6 ${
                  isEraserActive ? toolButtonActive : toolButtonInactive
                }`}
                title="Ластик"
                aria-pressed={isEraserActive}
                aria-label="Ластик"
              >
                <Eraser className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
              </button>
            </div>

            <div className={innerGroup} role="group" aria-label="Размер текста">
              <div className="flex h-8 min-h-8 min-w-0 items-center justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onTextSize(10)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-0 text-zinc-900 outline-none transition ${
                    textFontSize === 10 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`
                  }`}
                  title="Размер 10 px"
                  aria-pressed={textFontSize === 10}
                  aria-label="Весь текст 10 px"
                >
                  <Type className="h-2.5 w-2.5 shrink-0" strokeWidth={ICON} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onTextSize(14)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-0 text-zinc-900 outline-none transition ${
                    textFontSize === 14 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`
                  }`}
                  title="Размер 14 px"
                  aria-pressed={textFontSize === 14}
                  aria-label="Весь текст 14 px"
                >
                  <Type className="h-3 w-3 shrink-0" strokeWidth={ICON} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onTextSize(18)}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-0 text-zinc-900 outline-none transition ${
                    textFontSize === 18 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`
                  }`}
                  title="Размер 18 px"
                  aria-pressed={textFontSize === 18}
                  aria-label="Весь текст 18 px"
                >
                  <Type className="h-3.5 w-3.5 shrink-0" strokeWidth={ICON} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={onAddText}
                  className={`ml-0.5 flex h-6 w-6 items-center justify-center border-0 p-0 text-zinc-900 outline-none transition ${
                    activeTool === "text" ? toolButtonActive : `rounded-md ${toolButtonInactive}`
                  } rounded-md`}
                  title="Новый абзац"
                  aria-label="Вставить новый текст"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
                </button>
              </div>
            </div>

            <div className={innerGroup}>
              <button
                type="button"
                onClick={onAddImage}
                className={`${toolButtonBase} h-6 w-6 ${toolButtonInactive} rounded-md`}
                title="Вставить изображение"
                aria-label="Вставить изображение"
              >
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
              </button>
              <button
                type="button"
                onClick={onToggleImageDelete}
                className={`${toolButtonBase} h-6 w-6 ${
                  isImageDeleteMode
                    ? "bg-red-100 text-red-700 hover:bg-red-50"
                    : `${toolButtonInactive}`
                } rounded-md`}
                title="Удалить изображение"
                aria-pressed={isImageDeleteMode}
                aria-label="Режим удаления изображений"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
              </button>
            </div>

            <div className="relative z-[1] min-h-8" ref={saveGroupRef}>
              <button
                type="button"
                onClick={handleMainSaveClick}
                disabled={isSavingToDrawings}
                className={`${toolButtonBase} h-8 w-8 rounded-md ${
                  isSavingToDrawings
                    ? "cursor-not-allowed opacity-50"
                    : saveNameOpen
                      ? toolButtonActive
                      : "hover:bg-gray-100"
                }`}
                title="Сохранить в базу"
                aria-expanded={saveNameOpen}
                aria-controls={saveNameOpen ? popoverId : undefined}
                aria-label="Сохранить в базу: задать название"
              >
                {isSavingToDrawings ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={ICON} aria-hidden />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={ICON} aria-hidden />
                )}
              </button>
              {saveNameOpen && !isSavingToDrawings ? (
                <div
                  id={popoverId}
                  className="absolute left-0 top-full z-[80] mt-1.5 w-[min(18rem,92vw)] rounded-md border border-zinc-200 bg-white p-2 shadow-lg"
                  role="region"
                  aria-label="Название работы"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmSave();
                    }
                  }}
                >
                  <label className="block text-xs font-medium text-zinc-700" htmlFor={`${popoverId}-input`}>
                    Название работы
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      id={`${popoverId}-input`}
                      className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      value={workName}
                      onChange={(e) => setWorkName(e.target.value)}
                      placeholder={defaultWorkName}
                      maxLength={120}
                      autoFocus
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmSave}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-white transition hover:bg-zinc-800"
                      title="Сохранить"
                      aria-label="Подтвердить сохранение"
                    >
                      <Save className="h-4 w-4" strokeWidth={ICON} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              ref={exportWrapRef}
              className="relative shrink-0"
              onMouseEnter={openExportMenu}
              onMouseLeave={scheduleCloseExportMenu}
            >
              <button
                type="button"
                className="inline-flex h-8 min-h-8 w-full items-center justify-center gap-0.5 rounded-md px-2 text-sm font-medium text-zinc-900 transition hover:bg-gray-100"
                title="Скачать документ (PNG, JPG или PDF)"
                aria-label="Скачать документ"
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
                onClick={() => setExportMenuOpen((o) => !o)}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
                <span>PNG</span>
                <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={ICON} aria-hidden />
              </button>
              {exportMenuOpen ? (
                <div
                  className="absolute right-0 top-full z-[95] mt-1 min-w-[9.5rem] rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
                  role="menu"
                  aria-label="Формат файла"
                  onMouseEnter={openExportMenu}
                  onMouseLeave={scheduleCloseExportMenu}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void Promise.resolve(onExportBoard("png"));
                    }}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void Promise.resolve(onExportBoard("jpeg"));
                    }}
                  >
                    JPG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void Promise.resolve(onExportBoard("pdf"));
                    }}
                  >
                    PDF
                  </button>
                </div>
              ) : null}
            </div>
            </div>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />
    </>
  );
}
