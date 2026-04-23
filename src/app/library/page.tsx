"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../utils/supabaseClient";

type DrawingListRow = {
  id: string;
  name: string;
  created_at: string;
  content: unknown;
  preview_url: string | null;
  room_id: string | null;
};

function OpenDoorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h12V8.5a.5.5 0 0 0-.11-.32L9 4H5a2 2 0 0 0-2 2v14Z" />
      <path d="M9 11h.01" />
      <path d="M9 4v4.17" />
    </svg>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<DrawingListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrawings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.from("drawings").select("*");
    if (fetchError) {
      setError(fetchError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as DrawingListRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDrawings();
  }, [loadDrawings]);

  const openOnBoard = (id: string) => {
    router.push(`/?id=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Библиотека работ</h1>
            <p className="text-sm text-zinc-500">Все сохранённые рисунки из базы</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDrawings()}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              На холст
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <p className="text-sm text-zinc-600">Загрузка…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Ошибка: {error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600">Пока нет работ в таблице drawings.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-zinc-900">{row.name || "Без названия"}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString("ru-RU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Дата не указана"}
                  </p>
                </div>
                <div className="mt-4 flex justify-end border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openOnBoard(row.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    title="Открыть на холсте"
                    aria-label={`Открыть работу «${row.name}» на холсте`}
                  >
                    <OpenDoorIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
