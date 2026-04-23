"use client";

import type { ChangeEvent, RefObject } from "react";

export const TOOLBAR_HEIGHT_PX = 72;

export type Tool = "pencil" | "eraser" | "text";

type ToolbarProps = {
  activeTool: Tool;
  isImageDeleteMode: boolean;
  isImageActionsOpen: boolean;
  isSavingToDrawings: boolean;
  collabRoomId: string;
  collabParticipants: number;
  roomFull: boolean;
  maxRoomParticipants: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPencil: () => void;
  onEraser: () => void;
  onText: () => void;
  onOpenImageMenu: () => void;
  onAddImage: () => void;
  onToggleImageDelete: () => void;
  onSave: () => void;
  onExportPng: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function Toolbar({
  activeTool,
  isImageDeleteMode,
  isImageActionsOpen,
  isSavingToDrawings,
  collabRoomId,
  collabParticipants,
  roomFull,
  maxRoomParticipants,
  fileInputRef,
  onPencil,
  onEraser,
  onText,
  onOpenImageMenu,
  onAddImage,
  onToggleImageDelete,
  onSave,
  onExportPng,
  onFileChange,
}: ToolbarProps) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-2 px-3 py-3">
          <button
            type="button"
            onClick={onPencil}
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
            onClick={onEraser}
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
            onClick={onText}
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
              onClick={onOpenImageMenu}
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
                onClick={onAddImage}
                className="rounded-md bg-zinc-200 px-2 py-2 text-sm font-bold text-zinc-900 transition hover:bg-zinc-300"
                title="Добавить изображение"
              >
                +
              </button>
              <button
                type="button"
                onClick={onToggleImageDelete}
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
            onClick={onSave}
            disabled={isSavingToDrawings}
            className="rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            title="Сохранить"
          >
            {isSavingToDrawings ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={onExportPng}
            className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            title="Экспорт в PNG"
          >
            Экспорт в PNG
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
