"use client";

import type { ChangeEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download,
  Eraser,
  Image as ImageIcon,
  Library,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { useLibraryModal } from "../contexts/LibraryModalContext";
import { useSavedWorksRefresh } from "../contexts/SavedWorksRefreshContext";

const ICON = 1.75 as const;

/** Высота фиксированной консоли: верхняя панель + строка «комната». */
export const STUDIO_CONSOLE_HEIGHT_PX = 92;
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

const navLinkClass = (active: boolean) =>
  `inline-flex items-center justify-center gap-0 rounded-full border border-zinc-200 bg-white px-2.5 text-sm font-medium shadow-sm transition hover:bg-gray-100 ${
    active ? "border-zinc-400 bg-gray-100 text-zinc-900" : "text-zinc-900"
  }`;

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

type StudioConsoleProps = {
  activeTool: Tool;
  pencilColor: string;
  isImageDeleteMode: boolean;
  isSavingToDrawings: boolean;
  textFontSize: TextSizeOption;
  collabRoomId: string;
  collabParticipants: number;
  roomFull: boolean;
  maxRoomParticipants: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPaletteColor: (hex: string) => void;
  onEraser: () => void;
  onTextSize: (px: TextSizeOption) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onToggleImageDelete: () => void;
  onSaveToDatabase: (name: string) => void | Promise<void>;
  defaultWorkName: string;
  onExportPng: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function StudioConsole({
  activeTool,
  pencilColor,
  isImageDeleteMode,
  isSavingToDrawings,
  textFontSize,
  collabRoomId,
  collabParticipants,
  roomFull,
  maxRoomParticipants,
  fileInputRef,
  onPaletteColor,
  onEraser,
  onTextSize,
  onAddText,
  onAddImage,
  onToggleImageDelete,
  onSaveToDatabase,
  defaultWorkName,
  onExportPng,
  onFileChange,
}: StudioConsoleProps) {
  const path = usePathname();
  const { isOpen: libraryOpen, open: openLibrary } = useLibraryModal();
  const { request: requestSavedListRefresh } = useSavedWorksRefresh();
  const isHome = path === "/";
  const isLibrary = libraryOpen;

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

  return (
    <>
      <div
        className="pointer-events-none fixed right-2 top-2 z-[75] sm:right-3 sm:top-3"
        role="status"
        aria-label={`Пользователей в сети: ${collabParticipants} из ${maxRoomParticipants}`}
      >
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/90 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600 shadow-sm backdrop-blur"
          title="Участники в комнате"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]"
            aria-hidden
          />
          <span>
            {collabParticipants}
            <span className="text-zinc-400">/</span>
            {maxRoomParticipants}
          </span>
        </div>
      </div>

      <header
        className="fixed inset-x-0 top-0 z-[70] bg-zinc-100/90 backdrop-blur"
        aria-label="Панель навигации и инструментов"
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-start gap-2 overflow-visible px-2.5 pb-0 pt-2">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Link
              href="/"
              className={`${navLinkClass(isHome)} h-9 min-w-9 shadow-md`}
              title="Доска"
              aria-current={isHome ? "page" : undefined}
            >
              MyBoard
            </Link>
            <button
              type="button"
              onClick={openLibrary}
              className={`${navLinkClass(isLibrary)} h-9 w-9 gap-0 p-0 shadow-md`}
              title="Библиотека работ"
              aria-label="Библиотека работ"
              aria-pressed={isLibrary}
            >
              <Library className="h-4 w-4" strokeWidth={ICON} aria-hidden />
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center sm:justify-end">
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

            <button
              type="button"
              onClick={onExportPng}
              className="inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-0.5 rounded-md px-2 text-sm font-medium text-zinc-900 transition hover:bg-gray-100"
              title="Скачать PNG"
              aria-label="Скачать PNG"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
              <span>PNG</span>
            </button>

            {isHome ? (
              <button
                type="button"
                onClick={() => requestSavedListRefresh()}
                className={`${toolButtonBase} h-8 w-8 rounded-md text-zinc-800 ${toolButtonInactive}`}
                title="Обновить список работ"
                aria-label="Обновить список сохранённых работ"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={ICON} aria-hidden />
              </button>
            ) : null}
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-2 border-t border-zinc-200/60 px-2.5 py-1.5 text-[11px] text-zinc-600">
          <span>
            Комната: <span className="font-mono text-zinc-800">{collabRoomId.slice(0, 8)}…</span>
          </span>
          {roomFull ? (
            <span className="font-medium text-amber-700">
              · Комната заполнена (макс. {maxRoomParticipants})
            </span>
          ) : null}
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
