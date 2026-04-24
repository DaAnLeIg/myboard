"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FolderOpen, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DrawingRow, listDrawings } from "../utils/drawingsApi";
import { supabase } from "../utils/supabaseClient";
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
    const rowId = row.id;
    if (typeof rowId !== "string" || !rowId.trim()) {
      console.error("Ожидалась строка (UUID) в row.id, получено:", rowId);
      return;
    }
    setDeletingId(rowId);
    try {
      console.log("Удаляю ID:", rowId);
      const { error } = await supabase.from("drawings").delete().eq("id", rowId);
      if (error) {
        console.warn("Удаление работы:", error);
        return;
      }
      setRows((list) => list.filter((r) => r.id !== rowId));
    } catch (e) {
      console.warn("Удаление работы:", e);
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
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
        onClick={close}
        tabIndex={-1}
        aria-label="Закрыть (фон)"
      />
      <div
        className="relative z-[1] flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-gray-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          title="Закрыть"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <div className="shrink-0 border-b border-gray-100 px-5 pb-5 pr-32 pt-6 sm:pr-40">
          <h2
            id={titleId}
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          >
            Библиотека
          </h2>
          <p className="mt-1 text-sm text-gray-500">Сохранённые работы</p>
        </div>
        <div className="absolute right-14 top-3 z-10">
          <button
            type="button"
            onClick={() => void loadDrawings()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            title="Обновить"
            aria-label="Обновить список"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-gray-400" aria-busy="true" aria-live="polite">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">Загрузка списка</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600/90">Ошибка: {error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">Пока нет работ.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const busy = deletingId === row.id;
                return (
                  <li
                    key={row.id}
                    className="group flex min-h-[7.5rem] flex-col rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    title={row.id}
                  >
                    <h3 className="line-clamp-2 min-h-0 text-sm font-bold leading-snug text-gray-900">
                      {row.name || "Без названия"}
                    </h3>
                    <div className="mt-auto w-full pt-4">
                      <p className="text-xs leading-relaxed text-gray-500">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString("ru-RU", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </p>
                      <div className="mt-2 flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => openOnBoard(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                          title="Открыть на холсте"
                          aria-label={`Открыть «${row.name}» на холсте`}
                          disabled={busy}
                        >
                          <FolderOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(row)}
                          disabled={busy}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Удалить"
                          aria-label={`Удалить «${row.name}»`}
                        >
                          {busy ? (
                            <Loader2
                              className="h-4 w-4 shrink-0 animate-spin text-gray-500"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          ) : (
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                          )}
                        </button>
                      </div>
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
