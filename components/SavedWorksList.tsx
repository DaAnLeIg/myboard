"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSavedWorksRefresh } from "../contexts/SavedWorksRefreshContext";
import { listDrawings, type DrawingRow } from "../utils/drawingsApi";

type SavedWorksListProps = {
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string) => void;
};

export default function SavedWorksList({
  selectedDrawingId,
  onSelectDrawing,
}: SavedWorksListProps) {
  const [items, setItems] = useState<DrawingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { register, registerCreated } = useSavedWorksRefresh();

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listDrawings(30);
      setItems(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Неизвестная ошибка";
      setError(message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadItems]);

  useEffect(() => {
    const run = () => {
      void loadItems();
    };
    register(run);
    return () => {
      register(null);
    };
  }, [loadItems, register]);

  useEffect(() => {
    registerCreated((row) => {
      setItems((prev) => {
        const withoutSame = prev.filter((x) => x.id !== row.id);
        return [row, ...withoutSame];
      });
    });
    return () => registerCreated(null);
  }, [registerCreated]);

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">Сохраненные работы</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-zinc-500" aria-busy="true" aria-live="polite">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
          <span className="sr-only">Загрузка списка</span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">Ошибка: {error}</p> : null}
      {!isLoading && !error && items.length === 0 ? (
        <p className="text-sm text-zinc-600">Пока нет сохраненных работ.</p>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectDrawing(item.id)}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
              selectedDrawingId === item.id
                ? "border-blue-500 bg-blue-50 text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
            }`}
          >
            <div className="mb-1 font-medium">{item.name}</div>
            <div className="font-medium">ID: {item.id}</div>
            <div className="text-xs text-zinc-500">
              {item.created_at
                ? new Date(item.created_at).toLocaleString()
                : "Дата не указана"}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
