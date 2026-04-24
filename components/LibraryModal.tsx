"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { DoorOpen, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteDrawingById,
  type DrawingRow,
  listDrawings,
} from "../utils/drawingsApi";
import { useLibraryModal } from "../contexts/LibraryModalContext";

export default function LibraryModal() {
  const { isOpen, close } = useLibraryModal();
  const router = useRouter();
  const titleId = useId();
  const [rows, setRows] = useState<DrawingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDrawings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDrawings(100);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadDrawings();
    }
  }, [isOpen, loadDrawings]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const openOnBoard = (id: string) => {
    close();
    router.push(`/?id=${encodeURIComponent(id)}`);
  };

  const onDelete = async (row: DrawingRow) => {
    const label = row.name || "без названия";
    if (
      !window.confirm(
        `Удалить работу «${label}»? Действие нельзя отменить.`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      await deleteDrawingById(row.id);
      setRows((list) => list.filter((r) => r.id !== row.id));
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Не удалось удалить работу",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-zinc-900/50"
        onClick={close}
        tabIndex={-1}
        aria-label="Закрыть"
      />
      <div
        className="relative z-[1] flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-2 border-black bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-900">
              Библиотека работ
            </h2>
            <p className="text-sm text-zinc-500">Все сохранённые рисунки из базы</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void loadDrawings()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black/25 bg-white text-zinc-900 transition hover:bg-zinc-100"
              title="Обновить"
              aria-label="Обновить список"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-800 transition hover:bg-zinc-50"
              title="Закрыть"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <p className="text-sm text-zinc-600">Загрузка…</p>
          ) : error ? (
            <p className="text-sm text-red-600">Ошибка: {error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-600">Пока нет работ в таблице drawings.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {rows.map((row) => {
                const busy = deletingId === row.id;
                return (
                  <li
                    key={row.id}
                    className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <h3 className="truncate font-medium text-zinc-900">
                        {row.name || "Без названия"}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("ru-RU", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Дата не указана"}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-zinc-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => openOnBoard(row.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        title="Открыть на холсте"
                        aria-label={`Открыть «${row.name}» на холсте`}
                        disabled={busy}
                      >
                        <DoorOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(row)}
                        disabled={busy}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition enabled:hover:border-red-400 enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Удалить"
                        aria-label={`Удалить «${row.name}»`}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
