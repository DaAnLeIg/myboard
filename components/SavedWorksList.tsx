"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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

  const loadItems = async () => {
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
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Сохраненные работы</h2>
        <button
          type="button"
          onClick={() => {
            void loadItems();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/25 bg-zinc-900 text-white transition hover:bg-zinc-800"
          title="Обновить"
          aria-label="Обновить список"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

      {isLoading ? <p className="text-sm text-zinc-600">Загрузка...</p> : null}
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
