"use client";

import type { ChangeEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Download,
  Eraser,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { APP_NAV_HEIGHT_PX } from "./AppNav";

export const TOOLBAR_HEIGHT_PX = 100;

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

type ToolbarProps = {
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

const frame = "inline-flex items-center gap-1.5 border border-black bg-white p-1.5";

export default function Toolbar({
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
}: ToolbarProps) {
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
      <header
        className="fixed inset-x-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur"
        style={{ top: APP_NAV_HEIGHT_PX }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-2.5 overflow-visible px-3 py-2.5">
          <div className={frame}>
            <div className="grid w-[4.5rem] grid-cols-3 grid-rows-2 gap-0.5" role="group" aria-label="Цвет карандаша">
              {PENCIL_SWATCHES.map((sw) => {
                const selected = isPencilActive && pencilColor === sw.color;
                return (
                  <button
                    key={sw.key}
                    type="button"
                    onClick={() => onPaletteColor(sw.color)}
                    className={`h-4 w-4 border border-black/40 transition ${
                      selected ? "ring-2 ring-offset-1 ring-black" : "hover:opacity-90"
                    }`}
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
              className={`flex h-9 w-9 shrink-0 items-center justify-center border border-black/20 transition ${
                isEraserActive ? "bg-black text-white" : "bg-white text-black hover:bg-zinc-100"
              }`}
              title="Ластик"
              aria-label="Ластик"
            >
              <Eraser className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className={frame}>
            <div className="grid grid-cols-2 grid-rows-2 gap-0.5" role="group" aria-label="Размер текста и новый абзац">
              <button
                type="button"
                onClick={() => onTextSize(10)}
                className={`flex h-8 w-8 items-end justify-center border border-black/30 font-serif font-bold leading-none text-black ${
                  textFontSize === 10 ? "ring-1 ring-black" : "bg-white"
                }`}
                title="Размер текста 10 px"
                aria-pressed={textFontSize === 10}
                aria-label="Весь текст 10 px"
              >
                <span className="text-[10px]">T</span>
              </button>
              <button
                type="button"
                onClick={() => onTextSize(14)}
                className={`flex h-8 w-8 items-end justify-center border border-black/30 font-serif font-bold leading-none text-black ${
                  textFontSize === 14 ? "ring-1 ring-black" : "bg-white"
                }`}
                title="Размер текста 14 px"
                aria-pressed={textFontSize === 14}
                aria-label="Весь текст 14 px"
              >
                <span className="text-[14px]">T</span>
              </button>
              <button
                type="button"
                onClick={() => onTextSize(18)}
                className={`flex h-8 w-8 items-end justify-center border border-black/30 font-serif font-bold leading-none text-black ${
                  textFontSize === 18 ? "ring-1 ring-black" : "bg-white"
                }`}
                title="Размер текста 18 px"
                aria-pressed={textFontSize === 18}
                aria-label="Весь текст 18 px"
              >
                <span className="text-lg">T</span>
              </button>
              <button
                type="button"
                onClick={onAddText}
                className="flex h-8 w-8 items-center justify-center border border-dashed border-black bg-zinc-50 text-black transition hover:bg-zinc-100"
                title="Новый абзац"
                aria-label="Вставить новый текст"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>

          <div className={frame}>
            <button
              type="button"
              onClick={onAddImage}
              className="flex h-9 w-9 items-center justify-center bg-white text-black"
              title="Вставить изображение"
              aria-label="Вставить изображение"
            >
              <ImageIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onToggleImageDelete}
              className={`flex h-9 w-9 items-center justify-center ${
                isImageDeleteMode ? "bg-red-600 text-white" : "bg-white text-black"
              }`}
              title="Удалить изображение"
              aria-pressed={isImageDeleteMode}
              aria-label="Режим удаления изображений"
            >
              <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="relative" ref={saveGroupRef}>
            <button
              type="button"
              onClick={handleMainSaveClick}
              disabled={isSavingToDrawings}
              className="inline-flex h-9 min-w-9 items-center justify-center border border-black bg-white px-2.5 text-black transition enabled:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Сохранить в базу"
              aria-expanded={saveNameOpen}
              aria-controls={saveNameOpen ? popoverId : undefined}
              aria-label="Сохранить в базу: задать название"
            >
              {isSavingToDrawings ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
            {saveNameOpen && !isSavingToDrawings ? (
              <div
                id={popoverId}
                className="absolute right-0 top-full z-[80] mt-1.5 w-[min(18rem,92vw)] rounded-md border border-black bg-white p-2 shadow-lg"
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
                    className="min-w-0 flex-1 border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-black bg-zinc-900 text-white transition hover:bg-zinc-800"
                    title="Сохранить"
                    aria-label="Подтвердить сохранение"
                  >
                    <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onExportPng}
            className="inline-flex h-9 items-center gap-1 border border-black bg-white px-2.5 text-sm font-medium text-black transition hover:bg-zinc-100"
            title="Скачать PNG"
            aria-label="Скачать PNG"
          >
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
            <span>PNG</span>
          </button>
        </div>
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-600">
          <span>
            Комната: <span className="font-mono text-zinc-800">{collabRoomId.slice(0, 8)}…</span>
          </span>
          <span>·</span>
          <span>
            в сети: {collabParticipants} / {maxRoomParticipants}
          </span>
          {roomFull ? (
            <span className="font-medium text-amber-700">
              Комната заполнена (макс. {maxRoomParticipants})
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
