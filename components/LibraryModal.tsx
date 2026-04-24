"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FolderOpen, Loader2, RefreshCw, Share2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "../contexts/LocaleContext";
import { type DrawingRow, listDrawings } from "../utils/drawingsApi";
import { supabase } from "../utils/supabaseClient";
import { useLibraryModal } from "../contexts/LibraryModalContext";

export default function LibraryModal() {
  const { t, localeBcp47 } = useLocale();
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
      setError(e instanceof Error ? e.message : t("library.loadErrDef"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  const shareDrawingLink = async (id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/?id=${encodeURIComponent(id)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: t("lib.shareSystemTitle"),
          text: t("lib.shareWork"),
          url,
        });
        return;
      }
    } catch (e) {
      const name = e instanceof DOMException ? e.name : (e as Error)?.name;
      if (name === "AbortError") {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(t("lib.promptLink"), url);
    }
  };

  const onDelete = async (row: DrawingRow) => {
    const label = row.name || t("library.unnamed");
    if (!window.confirm(t("library.deleteConfirm", { name: label }))) {
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
        aria-label={t("library.closeBg")}
      />
      <div
        className="relative z-[1] flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl shadow-gray-200/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          title={t("dialog.close")}
          aria-label={t("dialog.close")}
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <div className="shrink-0 border-b border-gray-100 px-5 pb-5 pr-32 pt-6 sm:pr-40">
          <h2
            id={titleId}
            className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          >
            {t("library.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t("library.sub")}</p>
        </div>
        <div className="absolute right-14 top-3 z-10">
          <button
            type="button"
            onClick={() => void loadDrawings()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            title={t("library.refresh")}
            aria-label={t("library.refreshAria")}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-gray-400" aria-busy="true" aria-live="polite">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{t("library.loadList")}</span>
            </div>
          ) : error ? (
            <p className="text-sm text-red-600/90">
              {t("library.loadErr")}: {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">{t("library.empty")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const busy = deletingId === row.id;
                return (
                  <li
                    key={row.id}
                    className="group flex min-h-[7.5rem] flex-col rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                    title={row.id}
                  >
                    <div className="mb-2 h-28 w-full overflow-hidden rounded-lg bg-gray-100">
                      {row.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.preview_url}
                          alt={row.name || t("library.preview")}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          {t("library.noPreview")}
                        </div>
                      )}
                    </div>
                    <h3 className="line-clamp-2 min-h-0 text-sm font-bold leading-snug text-gray-900">
                      {row.name || t("library.unnamed")}
                    </h3>
                    <div className="mt-auto w-full pt-4">
                      <p className="text-xs leading-relaxed text-gray-500">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString(localeBcp47, {
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
                          title={t("library.open")}
                          aria-label={t("library.openAria", {
                            name: row.name || t("library.unnamed"),
                          })}
                          disabled={busy}
                        >
                          <FolderOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void shareDrawingLink(row.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                          title={t("library.share")}
                          aria-label={t("library.shareAria", { name: row.name || t("library.unnamed") })}
                          disabled={busy}
                        >
                          <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(row)}
                          disabled={busy}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title={t("library.delete")}
                          aria-label={t("library.deleteAria", { name: row.name || t("library.unnamed") })}
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
