"use client";

import type { ChangeEvent, RefObject } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleAlert,
  Download,
  Eraser,
  FolderOpen,
  Image as ImageIcon,
  List,
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
  GripHorizontal,
} from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";
import { useLibraryModal } from "../contexts/LibraryModalContext";
import { LanguagePicker } from "./LanguagePicker";
import { cn } from "../utils/cn";
import { ROOM_PARAM } from "../hooks/useCollaboration";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Slider } from "./ui/slider";
import { ColorPicker } from "./ui/color-picker";

const ICON = 1.75 as const;
const FLOATING_TOOLS_POS_KEY = "myboard_floating_tools_v1";

/** Высота фиксированной консоли (одна строка на десктопе). */
export const STUDIO_CONSOLE_HEIGHT_PX = 56;
/**
 * Отступ под моб. шапку: одна полоса (MyBoard, иконки, отмена) + счётчик;
 * панель инструментов вынесена в плавающий блок.
 */
export const STUDIO_CONSOLE_MOBILE_HEADER_PX = 64;
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

/** @see innerGroupClass / toolBtn* в StudioConsole (dark / ivory / light) */

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
  /** Та же ширина, что и рабочее поле (только `w-…`). */
  boardContentWidthClass: string;
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
  boardContentWidthClass,
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
  const { t } = useLocale();
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

  /** Группы кисти/текста/картинки: как chip-и навигации, с инверсией и «слоновой костью». */
  const innerGroupClass = cn(
    "inline-flex h-8 min-h-8 shrink-0 items-center gap-0.5 rounded-xl border px-1.5",
    dark
      ? "border-zinc-600/80 bg-zinc-800/55"
      : ivory
        ? "border-stone-300/80 bg-[#e4dfd0]/90"
        : "border-zinc-200/80 bg-zinc-50/50",
  );

  /** Палитра/иконки в моб. FAB: прежняя капсула. */
  const consoleToolsClusterClass = cn(
    "inline-flex w-fit max-w-full min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border px-2 py-1.5",
    "shadow-lg ring-1",
    dark
      ? "border-zinc-500/80 bg-zinc-800/95 shadow-zinc-950/40 ring-white/10"
      : ivory
        ? "border-stone-400/80 bg-[#f0ece1]/95 shadow-stone-900/20 ring-stone-500/25"
        : "border-zinc-200/90 bg-white/95 shadow-zinc-900/10 ring-zinc-300/80",
  );
  /** Оболочка переносимой панели (с ручкой сверху). */
  const toolsFloatShellClass = cn(
    "flex w-max min-w-0 max-w-full flex-col overflow-hidden p-0",
    "max-w-[min(100vw-1rem,653px)]",
    "rounded-2xl border shadow-lg ring-1",
    dark
      ? "border-zinc-500/80 bg-zinc-800/95 shadow-zinc-950/50 ring-white/10"
      : ivory
        ? "border-stone-400/80 bg-[#f0ece1]/95 shadow-stone-900/25 ring-stone-500/30"
        : "border-zinc-200/90 bg-white/98 shadow-zinc-900/15 ring-zinc-300/80",
  );
  const toolsFloatHandleClass = cn(
    "flex h-5 w-full shrink-0 touch-none select-none items-center justify-center border-b",
    "cursor-grab border-black/10 active:cursor-grabbing",
    "dark:border-white/15",
    dark ? "bg-zinc-800" : ivory ? "bg-[#e8e2d4]/95" : "bg-zinc-100/90",
  );

  const toolButtonBase = cn(
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 p-0 transition outline-none",
    dark ? "text-zinc-100" : ivory ? "text-stone-900" : "text-zinc-900",
  );
  const toolButtonInactive = dark
    ? "bg-transparent hover:bg-zinc-700/90"
    : ivory
      ? "bg-transparent hover:bg-[#cec6b0]/90"
      : "bg-transparent hover:bg-zinc-100/90";
  const toolButtonActive = dark ? "bg-zinc-600" : ivory ? "bg-[#c4b8a0]" : "bg-zinc-200";

  const toolIconMuted = dark ? "text-zinc-400" : ivory ? "text-stone-500" : "text-zinc-500";
  const toolTypeClass = dark ? "text-zinc-100" : ivory ? "text-stone-900" : "text-zinc-900";

  const swatchSelectedRing = dark
    ? "ring-1 ring-inset ring-zinc-200 ring-offset-0"
    : ivory
      ? "ring-1 ring-inset ring-stone-600/60 ring-offset-0"
      : "ring-1 ring-inset ring-zinc-800 ring-offset-0";

  const imageDeleteActive = dark
    ? "bg-red-950/50 text-red-300 hover:bg-red-950/70"
    : ivory
      ? "bg-red-100/90 text-red-800 hover:bg-red-100"
      : "bg-red-100 text-red-700 hover:bg-red-50";

  const navMoreMenuSurface = cn(
    "fixed z-[96] max-h-[min(90vh,calc(100vh-4rem))] overflow-y-auto rounded-xl border py-1.5 shadow-xl",
    dark
      ? "border-zinc-600 bg-zinc-800 text-zinc-100"
      : ivory
        ? "border-stone-300 bg-[#f4efe4] text-stone-900"
        : "border-zinc-200 bg-white text-zinc-900",
  );
  const navMoreRow = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
    dark
      ? "text-zinc-100 hover:bg-zinc-700/90"
      : ivory
        ? "text-stone-900 hover:bg-[#ddd8c8]/90"
        : "text-zinc-800 hover:bg-zinc-50",
  );
  const navMoreRowLink = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
    dark
      ? "text-zinc-100 hover:bg-zinc-700/90"
      : ivory
        ? "text-stone-900 hover:bg-[#ddd8c8]/90"
        : "text-zinc-800 hover:bg-zinc-50",
  );
  const navMoreDivider = dark ? "bg-zinc-600" : ivory ? "bg-stone-300" : "bg-zinc-200";
  const saveNamePopoverClass = cn(
    "absolute left-0 right-0 top-full z-[80] mt-1.5 rounded-md border p-2 shadow-lg",
    dark
      ? "border-zinc-600 bg-zinc-900"
      : ivory
        ? "border-stone-300 bg-[#ebe6d8]"
        : "border-zinc-200 bg-white",
  );
  const formLabelClass = dark ? "text-zinc-300" : ivory ? "text-stone-600" : "text-zinc-700";
  const workNameInputClass = cn(
    "min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1",
    dark
      ? "border-zinc-500 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-zinc-500"
      : ivory
        ? "border-stone-400 bg-[#faf8f3] text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:ring-stone-400"
        : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-zinc-400",
  );
  const saveMenuRowClass = (isOpen: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
      isSavingToDrawings
        ? "cursor-not-allowed opacity-50"
        : isOpen
          ? dark
            ? "bg-zinc-700 text-zinc-100"
            : ivory
              ? "bg-[#d5cfbc] text-stone-900"
              : "bg-zinc-200 text-zinc-900"
          : dark
            ? "text-zinc-100 hover:bg-zinc-700/90"
            : ivory
              ? "text-stone-900 hover:bg-[#ddd8c8]/90"
              : "text-zinc-800 hover:bg-zinc-50",
    );
  const saveConfirmIconBtn = cn(
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition",
    dark
      ? "border-zinc-200 bg-zinc-200 text-zinc-900 hover:bg-zinc-100"
      : ivory
        ? "border-stone-600 bg-stone-800 text-[#f4efe4] hover:bg-stone-700"
        : "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800",
  );
  const shareDialogSurface = cn(
    "relative z-[1] w-full max-w-md rounded-2xl border p-5 shadow-2xl",
    dark
      ? "border-zinc-600 bg-zinc-800"
      : ivory
        ? "border-stone-300 bg-[#f4efe4]"
        : "border-zinc-200 bg-white",
  );
  const shareDialogTitle = dark ? "text-zinc-100" : ivory ? "text-stone-900" : "text-zinc-900";
  const shareDialogMuted = dark ? "text-zinc-400" : ivory ? "text-stone-600" : "text-zinc-500";
  const shareDialogBody = dark ? "text-zinc-300" : ivory ? "text-stone-800" : "text-zinc-700";
  const shareCloseBtn = cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
    dark
      ? "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
      : ivory
        ? "text-stone-500 hover:bg-[#e8e4d4] hover:text-stone-900"
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
  );
  const shareFieldLabel = dark ? "text-zinc-400" : ivory ? "text-stone-600" : "text-zinc-500";
  const shareMono = dark ? "text-zinc-200" : ivory ? "text-stone-900" : "text-zinc-900";
  const shareMonoSm = dark ? "text-zinc-400" : ivory ? "text-stone-700" : "text-zinc-700";
  const shareCopyBtn = cn(
    "mt-2 w-full rounded-lg border py-2 text-sm font-medium transition",
    dark
      ? "border-zinc-500 bg-zinc-700/80 text-zinc-100 hover:bg-zinc-700"
      : ivory
        ? "border-stone-400 bg-[#e8e4d4] text-stone-900 hover:bg-[#ddd8c8]"
        : "border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100",
  );
  const shareNativeBtn = cn(
    "inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition sm:w-auto",
    dark
      ? "border-zinc-200 bg-zinc-200 text-zinc-900 hover:bg-zinc-100"
      : ivory
        ? "border-stone-700 bg-stone-800 text-[#f4efe4] hover:bg-stone-700"
        : "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800",
  );
  const shareDoneBtn = cn(
    "inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition sm:w-auto",
    dark
      ? "border-zinc-500 bg-zinc-700/50 text-zinc-100 hover:bg-zinc-700"
      : ivory
        ? "border-stone-300 bg-[#e8e4d4] text-stone-900 hover:bg-[#ddd8c8]"
        : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  );

  /** Участники в комнате — как кнопки-иконки в шапке, без тени. */
  const participantStatusPill = (
    <div
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums shadow-none transition",
        dark
          ? "border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
          : ivory
            ? "border-stone-300 bg-[#e8e4d4] text-stone-900 hover:bg-[#ddd8c8]"
            : "border-zinc-200 bg-white text-zinc-900 hover:bg-gray-100",
      )}
      role="status"
      aria-label={t("room.participantsAria", { a: collabParticipants, b: maxRoomParticipants })}
      title={t("room.participantsTitle")}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <span>
        {collabParticipants}
        <span className={dark ? "text-zinc-500" : ivory ? "text-stone-400" : "text-zinc-400"}>/</span>
        {maxRoomParticipants}
      </span>
    </div>
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

  /** Три горизонтальные полоски слева от карандаша: сверху 1px, середина 3px, снизу 5px. */
  const pencilWidthStripeControl = (
    <div
      className="mr-0.5 flex h-6 w-3 shrink-0 flex-col gap-px"
      role="group"
      aria-label={t("pencil.groupWidth")}
    >
      {([1, 3, 5] as const).map((w) => {
        const active = pencilWidth === w;
        return (
          <button
            key={w}
            type="button"
            onClick={() => onPencilWidthChange(w)}
            className={cn(
              "flex min-h-0 flex-1 w-full items-center justify-center rounded-sm border-0 p-0 transition outline-none",
              active
                ? dark
                  ? "bg-zinc-600 ring-1 ring-inset ring-zinc-400/40"
                  : ivory
                    ? "bg-[#c4b8a0] ring-1 ring-inset ring-stone-500/45"
                    : "bg-zinc-200 ring-1 ring-inset ring-zinc-400/50"
                : dark
                  ? "hover:bg-zinc-700/80"
                  : ivory
                    ? "hover:bg-[#d5cfbc]"
                    : "hover:bg-zinc-100",
            )}
            title={t("pencil.width", { w })}
            aria-pressed={active}
            aria-label={t("pencil.widthLine", { w })}
          >
            <span
              className={cn(
                "block h-px w-full max-w-[11px] rounded-full",
                dark ? "bg-zinc-100" : ivory ? "bg-stone-800" : "bg-zinc-900",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );

  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [workName, setWorkName] = useState(defaultWorkName);
  const popoverId = useId();
  const sharePanelTitleId = useId();
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
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [navMoreOpen, setNavMoreOpen] = useState(false);
  const [navMorePos, setNavMorePos] = useState<{ top: number; left: number } | null>(null);
  const navMoreAnchorRef = useRef<HTMLElement | null>(null);
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
  const [toolsPanelPos, setToolsPanelPos] = useState({ x: 16, y: 70 });
  const toolsPanelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = localStorage.getItem(FLOATING_TOOLS_POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { x?: unknown; y?: unknown };
        if (
          typeof p.x === "number" &&
          typeof p.y === "number" &&
          !Number.isNaN(p.x) &&
          !Number.isNaN(p.y)
        ) {
          setToolsPanelPos({ x: p.x, y: p.y });
          return;
        }
      }
    } catch {
      // ignore
    }
    setToolsPanelPos({
      x: Math.max(8, (window.innerWidth - 420) / 2),
      y: STUDIO_CONSOLE_HEIGHT_PX + 6,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onResize = () => {
      setToolsPanelPos((p) => {
        const el = toolsPanelRef.current;
        const dw = el?.offsetWidth ?? 360;
        const dh = el?.offsetHeight ?? 72;
        return {
          x: Math.max(8, Math.min(window.innerWidth - dw - 8, p.x)),
          y: Math.max(8, Math.min(window.innerHeight - dh - 8, p.y)),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onToolsPanelHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (e.button !== 0) {
      return;
    }
    const origX = toolsPanelPos.x;
    const origY = toolsPanelPos.y;
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const el = toolsPanelRef.current;
      const dw = el?.offsetWidth ?? 360;
      const dh = el?.offsetHeight ?? 72;
      setToolsPanelPos({
        x: Math.max(8, Math.min(window.innerWidth - dw - 8, origX + (ev.clientX - startX))),
        y: Math.max(8, Math.min(window.innerHeight - dh - 8, origY + (ev.clientY - startY))),
      });
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      const r = toolsPanelRef.current?.getBoundingClientRect();
      if (r) {
        const p = { x: r.left, y: r.top };
        setToolsPanelPos(p);
        try {
          localStorage.setItem(FLOATING_TOOLS_POS_KEY, JSON.stringify(p));
        } catch {
          // ignore
        }
      }
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };

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

  const NAV_MORE_MENU_W = 232;

  const layoutNavMore = useCallback(() => {
    const el = navMoreAnchorRef.current;
    if (!el || typeof window === "undefined") {
      return;
    }
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - NAV_MORE_MENU_W - 8));
    setNavMorePos({ top: r.bottom + 6, left });
  }, []);

  const closeNavMore = useCallback(() => {
    setNavMoreOpen(false);
    setNavMorePos(null);
    navMoreAnchorRef.current = null;
    setSaveNameOpen(false);
  }, []);

  const toggleNavMore = useCallback(
    (anchor: HTMLElement) => {
      if (navMoreOpen && navMoreAnchorRef.current === anchor) {
        closeNavMore();
        return;
      }
      navMoreAnchorRef.current = anchor;
      setNavMoreOpen(true);
    },
    [navMoreOpen, closeNavMore],
  );

  useLayoutEffect(() => {
    if (!navMoreOpen) {
      setNavMorePos(null);
      return;
    }
    layoutNavMore();
    const onScrollOrResize = () => layoutNavMore();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [navMoreOpen, layoutNavMore]);

  useEffect(() => {
    if (!navMoreOpen || typeof document === "undefined") {
      return;
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const menuEl = document.getElementById("nav-console-more-menu");
      if (menuEl?.contains(t)) {
        return;
      }
      if (navMoreAnchorRef.current?.contains(t)) {
        return;
      }
      closeNavMore();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [navMoreOpen, closeNavMore]);

  useEffect(() => {
    if (!navMoreOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeNavMore();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navMoreOpen, closeNavMore]);

  useEffect(() => {
    return () => {
      clearFabLongPressTimer();
      clearPanelLongPressTimer();
      clearDragTimer();
    };
  }, []);

  useEffect(() => {
    if (!sharePanelOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSharePanelOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sharePanelOpen]);

  const copyRoomIdToClipboard = async () => {
    const id = collabRoomId?.trim();
    if (!id) {
      flashRefreshError();
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      flashRefreshError();
    }
  };

  const copyInviteUrlToClipboard = async () => {
    const url = buildRoomInviteUrl();
    if (!url || !isValidRoomInviteUrl(url)) {
      flashRefreshError();
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      flashRefreshError();
    }
  };

  /** Системное меню «Поделиться» (файл доски + текст), если доступно. */
  const runSystemShare = async () => {
    if (onShareBoard) {
      try {
        const shared = await onShareBoard();
        if (shared) {
          return true;
        }
      } catch (e) {
        console.warn("Native board share failed:", e);
      }
    }
    const url = buildRoomInviteUrl();
    if (!url || !isValidRoomInviteUrl(url)) {
      flashRefreshError();
      return false;
    }
    const text = t("share.joinText", { url });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("lib.shareSystemTitle"),
          text,
          url,
        });
        return true;
      } catch (e) {
        const name = e instanceof DOMException ? e.name : (e as Error)?.name;
        if (name === "AbortError") {
          return true;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      flashRefreshError();
      return false;
    }
  };

  const toolbarContent = (
    <>
      <div className={innerGroupClass}>
        {pencilWidthStripeControl}
        <span
          className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center", toolIconMuted)}
          title={t("pencil.aria")}
          aria-hidden
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} />
        </span>
        <div className="grid grid-cols-3 grid-rows-2 gap-0.5" role="group" aria-label={t("pencil.colors")}>
          {PENCIL_SWATCHES.map((sw) => {
            const selected = isPencilActive && pencilColor === sw.color;
            const cname = t(`color.${sw.key}`);
            return (
              <button
                key={sw.key}
                type="button"
                onClick={() => onPaletteColor(sw.color)}
                className={cn(
                  "h-2 w-2 border-0 p-0 transition rounded-sm",
                  selected ? swatchSelectedRing : "ring-0 hover:opacity-90",
                )}
                style={{ backgroundColor: sw.color }}
                title={t("pencil.swatch", { c: cname })}
                aria-label={t("pencil.swatch", { c: cname })}
                aria-pressed={selected}
              />
            );
          })}
        </div>
        <button
          type="button"
          onClick={onEraser}
          className={`${toolButtonBase} ml-0.5 h-6 w-6 ${isEraserActive ? toolButtonActive : toolButtonInactive}`}
          title={t("eraser.aria")}
          aria-pressed={isEraserActive}
          aria-label={t("eraser.aria")}
        >
          <Eraser className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
        </button>
      </div>

      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`} title={t("settings.brush")} aria-label={t("settings.brush")}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn(
            "w-60",
            dark && "border-zinc-600 bg-zinc-800 text-zinc-100",
            ivory && "border-stone-300 bg-[#f4efe4] text-stone-900",
            !dark && !ivory && "bg-white",
          )}
        >
          <div className="space-y-3">
            <div>
              <p
                className={cn(
                  "mb-1 text-xs font-medium",
                  dark ? "text-zinc-300" : ivory ? "text-stone-600" : "text-zinc-700",
                )}
              >
                {t("settings.widthLabel")}
              </p>
              <Slider
                value={[pencilWidth]}
                min={1}
                max={5}
                step={2}
                onValueChange={(v) => onPencilWidthChange((v[0] === 1 || v[0] === 5 ? v[0] : 3) as 1 | 3 | 5)}
              />
            </div>
            <div>
              <p
                className={cn(
                  "mb-1 text-xs font-medium",
                  dark ? "text-zinc-300" : ivory ? "text-stone-600" : "text-zinc-700",
                )}
              >
                {t("settings.colorLabel")}
              </p>
              <ColorPicker color={pencilColor} onChange={onPaletteColor} />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );

  const mainToolsRowContent = (
    <div
      className={cn(
        "inline-flex w-fit max-w-full min-w-0 flex-wrap items-center gap-1.5 px-2 py-1.5",
        "shrink-0",
        boardToolbarMaxClass,
      )}
      role="toolbar"
      aria-label={t("header.mainToolbar")}
    >
      <div className={innerGroupClass}>
        {pencilWidthStripeControl}
        <span
          className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center", toolIconMuted)}
          title={t("pencil.aria")}
          aria-hidden
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={ICON} />
        </span>
        <div
          className="grid grid-cols-3 grid-rows-2 gap-0.5"
          role="group"
          aria-label={t("pencil.colors")}
        >
          {PENCIL_SWATCHES.map((sw) => {
            const selected = isPencilActive && pencilColor === sw.color;
            const cname = t(`color.${sw.key}`);
            return (
              <button
                key={sw.key}
                type="button"
                onClick={() => onPaletteColor(sw.color)}
                className={cn(
                  "h-2 w-2 border-0 p-0 transition rounded-sm",
                  selected ? swatchSelectedRing : "ring-0 hover:opacity-90",
                )}
                style={{ backgroundColor: sw.color }}
                title={t("pencil.swatch", { c: cname })}
                aria-label={t("pencil.swatch", { c: cname })}
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
          title={t("eraser.aria")}
          aria-pressed={isEraserActive}
          aria-label={t("eraser.aria")}
        >
          <Eraser className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
        </button>
      </div>

      <div className={innerGroupClass} role="group" aria-label={t("text.sizeGroup")}>
        <div className="flex h-8 min-h-8 min-w-0 items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={() => onTextSize(10)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center border-0 outline-none transition",
              toolTypeClass,
              textFontSize === 10 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`,
            )}
            title={t("text.sizeN", { n: 10 })}
            aria-pressed={textFontSize === 10}
            aria-label={t("text.allN", { n: 10 })}
          >
            <Type className="h-2.5 w-2.5 shrink-0" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onTextSize(14)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center border-0 outline-none transition",
              toolTypeClass,
              textFontSize === 14 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`,
            )}
            title={t("text.sizeN", { n: 14 })}
            aria-pressed={textFontSize === 14}
            aria-label={t("text.allN", { n: 14 })}
          >
            <Type className="h-3 w-3 shrink-0" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onTextSize(18)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center border-0 outline-none transition",
              toolTypeClass,
              textFontSize === 18 ? `rounded-md ${toolButtonActive}` : `rounded-md ${toolButtonInactive}`,
            )}
            title={t("text.sizeN", { n: 18 })}
            aria-pressed={textFontSize === 18}
            aria-label={t("text.allN", { n: 18 })}
          >
            <Type className="h-3.5 w-3.5 shrink-0" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onAddText}
            className={cn(
              "ml-0.5 flex h-6 w-6 items-center justify-center border-0 p-0 outline-none transition",
              toolTypeClass,
              activeTool === "text" ? toolButtonActive : `rounded-md ${toolButtonInactive}`,
              "rounded-md",
            )}
            title={t("text.newBlock")}
            aria-label={t("text.addNew")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
          </button>
        </div>
      </div>

      <div className={innerGroupClass}>
        <button
          type="button"
          onClick={onAddImage}
          className={`${toolButtonBase} h-6 w-6 ${toolButtonInactive} rounded-md`}
          title={t("image.add")}
          aria-label={t("image.add")}
        >
          <ImageIcon className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onToggleImageDelete}
          className={cn(
            `${toolButtonBase} h-6 w-6 rounded-md`,
            isImageDeleteMode ? imageDeleteActive : toolButtonInactive,
          )}
          title={t("image.removeMode")}
          aria-pressed={isImageDeleteMode}
          aria-label={t("image.removeAria")}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
        </button>
      </div>
    </div>
  );

  const floatingMainTools = (
    <div
      ref={toolsPanelRef}
      className="fixed z-[85] touch-manipulation will-change-transform"
      style={{ left: toolsPanelPos.x, top: toolsPanelPos.y }}
    >
      <div className={toolsFloatShellClass}>
        <button
          type="button"
          className={toolsFloatHandleClass}
          onPointerDown={onToolsPanelHandlePointerDown}
          title={t("toolsPanel.dragHandle")}
          aria-label={t("toolsPanel.dragHandle")}
        >
          <GripHorizontal
            className={cn("h-3.5 w-3.5", dark ? "text-zinc-500" : ivory ? "text-stone-500" : "text-zinc-400")}
            strokeWidth={ICON}
            aria-hidden
          />
        </button>
        {mainToolsRowContent}
      </div>
    </div>
  );

  return (
    <>
      {floatingMainTools}
      <div className="fixed inset-x-0 top-0 z-[70] sm:hidden">
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 flex-col gap-1.5 px-2.5 pt-2",
            boardContentWidthClass,
          )}
        >
        <div className="grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-1.5">
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5">
          <Link
            href="/"
            className={cn(myBoardChipClass(), "min-h-9 shrink-0 px-2 text-xs")}
            title={t("myBoard.hint")}
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
            {t("nav.myBoard")}
          </Link>
          <LanguagePicker
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            labelAria={t("locale.title")}
            labelTitle={t("locale.title")}
            dark={dark}
            ivory={ivory}
          />
          <button
            type="button"
            onClick={() => {
              void onNewDocument?.();
            }}
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            title={t("nav.newDoc")}
            aria-label={t("nav.newDoc")}
          >
            <Plus className="h-5 w-5" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => toggleNavMore(e.currentTarget)}
            className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
            title={t("nav.more")}
            aria-label={t("nav.more")}
            aria-expanded={navMoreOpen}
            aria-haspopup="menu"
          >
            <List className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            onClick={openLibrary}
            className={`${navLinkClass(isLibrary)} h-9 w-9 gap-0 p-0 shadow-md`}
            title={t("nav.library")}
            aria-label={t("nav.library")}
          >
            <FolderOpen className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => onUndo()}
            className={`${navLinkClass(false)} h-9 w-9 shrink-0 gap-0 p-0 shadow-md disabled:cursor-not-allowed disabled:opacity-40`}
            title={t("nav.undo")}
            aria-label={t("nav.undo")}
          >
            <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
          </button>
        </div>
        <div className="flex min-w-0 justify-end self-center">
          {participantStatusPill}
        </div>
        </div>
        </div>
      </div>

      <div
        className="fixed z-[90] sm:hidden"
        style={{ right: `${mobileDockPos.x}px`, bottom: `${mobileDockPos.y}px` }}
      >
        {mobileFabOpen ? (
          <div
            className={cn(consoleToolsClusterClass, "mb-2 max-w-[86vw] flex-col items-start")}
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
            <div className="flex w-full flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("mobile.tools")}>
              {toolbarContent}
              <button type="button" onClick={onAddText} className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`}><Type className="h-4 w-4" strokeWidth={ICON} /></button>
              <button type="button" onClick={onAddImage} className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive}`}><ImageIcon className="h-4 w-4" strokeWidth={ICON} /></button>
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => onUndo()}
                className={`${toolButtonBase} h-8 w-8 rounded-md ${toolButtonInactive} disabled:cursor-not-allowed disabled:opacity-40`}
                title={t("mobile.undo")}
                aria-label={t("nav.undo")}
              >
                <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
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
          className={cn(
            "inline-flex h-14 w-14 items-center justify-center rounded-full shadow-xl",
            ivory
              ? "bg-stone-800 text-[#f4efe4]"
              : dark
                ? "bg-zinc-200 text-zinc-900"
                : "bg-zinc-900 text-white",
          )}
          aria-label={mobileFabOpen ? t("mobile.fab.close") : t("mobile.fab.open")}
          title={mobileFabPinned ? t("mobile.fab.pinned") : t("mobile.fab.open")}
        >
          {mobileFabOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[70] hidden backdrop-blur sm:block",
          ivory ? "border-b border-stone-200/80 bg-[#ebe6d8]/95" : dark ? "border-b border-zinc-800 bg-zinc-900/90" : "bg-zinc-100/90",
        )}
        aria-label={t("header.aria")}
      >
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 flex-col overflow-visible px-2.5 pb-2 pt-2",
            boardContentWidthClass,
          )}
        >
          <div className="grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-2">
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-start gap-1.5">
              <Link
                href="/"
                className={cn(
                  myBoardChipClass(),
                  isHome && "ring-2 ring-zinc-400 ring-offset-2 ring-offset-transparent",
                )}
                title={t("myBoard.hint")}
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
                {t("nav.myBoard")}
              </Link>
              <LanguagePicker
                className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
                labelAria={t("locale.title")}
                labelTitle={t("locale.title")}
                dark={dark}
                ivory={ivory}
              />
              <button
                type="button"
                onClick={() => {
                  void onNewDocument?.();
                }}
                className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
                title={t("nav.newDoc")}
                aria-label={t("nav.newDoc")}
              >
                <Plus className="h-5 w-5" strokeWidth={ICON} aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => toggleNavMore(e.currentTarget)}
                className={`${navLinkClass(false)} h-9 w-9 gap-0 p-0 shadow-md`}
                title={t("nav.more")}
                aria-label={t("nav.more")}
                aria-expanded={navMoreOpen}
                aria-haspopup="menu"
              >
                <List className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
              <button
                type="button"
                onClick={openLibrary}
                className={`${navLinkClass(isLibrary)} h-9 w-9 gap-0 p-0 shadow-md`}
                title={t("nav.library")}
                aria-label={t("nav.library")}
                aria-pressed={isLibrary}
              >
                <FolderOpen className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
              <button
                type="button"
                disabled={!canUndo}
                onClick={() => onUndo()}
                className={`${navLinkClass(false)} h-9 w-9 shrink-0 gap-0 p-0 shadow-md disabled:cursor-not-allowed disabled:opacity-40`}
                title={t("nav.undo")}
                aria-label={t("nav.undo")}
              >
                <Undo2 className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
            </div>
            <div className="flex min-w-0 items-center justify-end self-center">
              {participantStatusPill}
            </div>
          </div>
        </div>
      </header>

      {navMoreOpen && navMorePos ? (
        <div
          id="nav-console-more-menu"
          role="menu"
          aria-label={t("nav.ariaMore")}
          className={navMoreMenuSurface}
          style={{
            top: navMorePos.top,
            left: navMorePos.left,
            width: NAV_MORE_MENU_W,
          }}
        >
          <div className="flex flex-col gap-0.5 px-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeNavMore();
                setSharePanelOpen(true);
              }}
              className={navMoreRow}
            >
              <Share2 className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
              <span>{t("action.share")}</span>
            </button>
            <Link
              href="/privacy"
              role="menuitem"
              onClick={() => closeNavMore()}
              className={navMoreRowLink}
            >
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
              <span>{t("action.privacy")}</span>
            </Link>
            <div className={cn("my-1 h-px shrink-0", navMoreDivider)} aria-hidden />
            <div className="relative w-full px-0.5" ref={saveGroupRef}>
              <button
                type="button"
                onClick={handleMainSaveClick}
                disabled={isSavingToDrawings}
                className={saveMenuRowClass(saveNameOpen)}
                title={t("action.saveHint")}
                aria-expanded={saveNameOpen}
                aria-controls={saveNameOpen ? popoverId : undefined}
                aria-label={t("action.saveHint")}
              >
                {isSavingToDrawings ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={ICON} aria-hidden />
                ) : (
                  <Save className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
                )}
                <span>{t("action.save")}</span>
              </button>
              {saveNameOpen && !isSavingToDrawings ? (
                <div
                  id={popoverId}
                  className={saveNamePopoverClass}
                  role="region"
                  aria-label={t("form.workName")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirmSave();
                    }
                  }}
                >
                  <label className={cn("block text-xs font-medium", formLabelClass)} htmlFor={`${popoverId}-input`}>
                    {t("form.workName")}
                  </label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      id={`${popoverId}-input`}
                      className={workNameInputClass}
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
                      className={saveConfirmIconBtn}
                      title={t("form.confirm")}
                      aria-label={t("form.confirmSave")}
                    >
                      <Save className="h-4 w-4" strokeWidth={ICON} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-0.5 px-0.5" role="group" aria-label={t("export.aria")}>
              <button
                type="button"
                role="menuitem"
                className={navMoreRow}
                title={t("export.png")}
                aria-label={t("export.png")}
                onClick={() => {
                  closeNavMore();
                  void Promise.resolve(onExportBoard("png"));
                }}
              >
                <Download className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
                <span>{t("export.png")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={navMoreRow}
                title={t("export.jpg")}
                aria-label={t("export.jpg")}
                onClick={() => {
                  closeNavMore();
                  void Promise.resolve(onExportBoard("jpeg"));
                }}
              >
                <Download className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
                <span>{t("export.jpg")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={navMoreRow}
                title={t("export.pdf")}
                aria-label={t("export.pdf")}
                onClick={() => {
                  closeNavMore();
                  void Promise.resolve(onExportBoard("pdf"));
                }}
              >
                <Download className="h-4 w-4 shrink-0" strokeWidth={ICON} aria-hidden />
                <span>{t("export.pdf")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sharePanelOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
            aria-label={t("dialog.closeBg")}
            onClick={() => setSharePanelOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={sharePanelTitleId}
            className={shareDialogSurface}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={sharePanelTitleId} className={cn("text-lg font-semibold", shareDialogTitle)}>
                {t("share.title")}
              </h2>
              <button
                type="button"
                onClick={() => setSharePanelOpen(false)}
                className={shareCloseBtn}
                title={t("dialog.close")}
                aria-label={t("dialog.close")}
              >
                <X className="h-4 w-4" strokeWidth={ICON} aria-hidden />
              </button>
            </div>
            <p className={cn("mt-1 text-sm", shareDialogMuted)}>{t("share.body")}</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className={cn("text-xs font-medium", shareFieldLabel)}>{t("share.roomLabel")}</p>
                <p className={cn("mt-1 break-all font-mono text-sm", shareMono)}>{collabRoomId}</p>
                <button
                  type="button"
                  onClick={() => void copyRoomIdToClipboard()}
                  className={shareCopyBtn}
                >
                  {t("share.copyRoom")}
                </button>
              </div>
              <div>
                <p className={cn("text-xs font-medium", shareFieldLabel)}>{t("share.inviteLabel")}</p>
                <p
                  className={cn(
                    "mt-1 max-h-24 overflow-y-auto break-all font-mono text-xs leading-relaxed",
                    shareMonoSm,
                  )}
                >
                  {buildRoomInviteUrl() ?? "—"}
                </p>
                <button
                  type="button"
                  onClick={() => void copyInviteUrlToClipboard()}
                  disabled={!buildRoomInviteUrl()}
                  className={cn(shareCopyBtn, "disabled:cursor-not-allowed disabled:opacity-40")}
                >
                  {t("share.copyLink")}
                </button>
              </div>
            </div>

            {roomFull ? (
              <p
                className={cn(
                  "mt-3 text-xs font-medium",
                  dark ? "text-amber-300" : ivory ? "text-amber-800" : "text-amber-700",
                )}
              >
                {t("share.roomFull", { max: maxRoomParticipants })}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={async () => {
                  const ok = await runSystemShare();
                  if (ok) {
                    setSharePanelOpen(false);
                  }
                }}
                className={shareNativeBtn}
              >
                {t("share.native")}
              </button>
              <button type="button" onClick={() => setSharePanelOpen(false)} className={shareDoneBtn}>
                {t("share.done")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
