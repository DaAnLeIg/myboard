"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { FolderOpen, Loader2, RefreshCw, Share2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "../contexts/LocaleContext";
import { useAppearance } from "../contexts/AppearanceContext";
import { getBoardTheme } from "../lib/boardTheme";
import { type DrawingRow, listDrawings } from "../utils/drawingsApi";
import { supabase } from "../utils/supabaseClient";
import { useLibraryModal } from "../contexts/LibraryModalContext";
import { cn } from "../utils/cn";

export default function LibraryModal() {
  const { t, localeBcp47 } = useLocale();
  const { appearance } = useAppearance();
  const { dark, ivory, light } = getBoardTheme(appearance);
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

  /** Поверхности в духе `innerGroup` / share-диалога `StudioConsole`. */
  const modalShellClass = cn(
    "relative z-[1] flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl",
    dark && "border-zinc-600/80 bg-zinc-900 shadow-black/40",
    ivory && "border-stone-400/80 bg-[#f4efe4] shadow-stone-900/20",
    light && "border-zinc-200/90 bg-white/98 shadow-zinc-900/10",
  );

  const cardClass = cn(
    "group flex min-h-[7.5rem] flex-col rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md",
    dark && "border-zinc-600/80 bg-zinc-800/90 ring-1 ring-white/5",
    ivory && "border-stone-400/70 bg-[#ebe6d8] ring-1 ring-stone-500/20 shadow-stone-900/5",
    light && "border-zinc-200/80 bg-zinc-50/95 ring-1 ring-zinc-200/50",
  );

  const previewHolderClass = cn(
    "mb-2 h-28 w-full overflow-hidden rounded-lg",
    dark && "bg-zinc-900",
    ivory && "bg-[#d5cebc]/80 ring-1 ring-inset ring-stone-400/30",
    light && "bg-zinc-100 ring-1 ring-inset ring-zinc-200/50",
  );

  const iconBtnClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 p-0 transition outline-none";
  const rowActionBtn = cn(
    iconBtnClass,
    dark && "text-zinc-200 hover:bg-zinc-700/90",
    ivory && "text-stone-800 hover:bg-[#cec6b0]/90",
    light && "text-zinc-800 hover:bg-zinc-200/80",
  );

  const deleteBtnClass = cn(
    iconBtnClass,
    "text-red-500 disabled:cursor-not-allowed disabled:opacity-50",
    dark && "hover:bg-red-950/50 hover:text-red-400",
    ivory && "hover:bg-red-100/90 hover:text-red-800",
    light && "hover:bg-red-50 hover:text-red-600",
  );

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
        className={modalShellClass}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className={cn(
            "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full transition",
            dark && "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
            ivory && "text-stone-500 hover:bg-[#ddd8c8] hover:text-stone-900",
            light && "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
          )}
          title={t("dialog.close")}
          aria-label={t("dialog.close")}
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
        <div
          className={cn(
            "shrink-0 border-b px-5 pb-5 pr-32 pt-6 sm:pr-40",
            dark && "border-zinc-700",
            ivory && "border-stone-300/80",
            light && "border-zinc-200/90",
          )}
        >
          <h2
            id={titleId}
            className={cn(
              "text-2xl font-bold tracking-tight sm:text-3xl",
              dark && "text-zinc-100",
              ivory && "text-stone-900",
              light && "text-zinc-900",
            )}
          >
            {t("library.title")}
          </h2>
          <p
            className={cn(
              "mt-1 text-sm",
              dark && "text-zinc-400",
              ivory && "text-stone-600",
              light && "text-zinc-500",
            )}
          >
            {t("library.sub")}
          </p>
        </div>
        <div className="absolute right-14 top-3 z-10">
          <button
            type="button"
            onClick={() => void loadDrawings()}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
              dark && "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
              ivory && "text-stone-600 hover:bg-[#ddd8c8] hover:text-stone-900",
              light && "text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900",
            )}
            title={t("library.refresh")}
            aria-label={t("library.refreshAria")}
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div
              className={cn(
                "flex items-center gap-2 py-2",
                dark && "text-zinc-500",
                ivory && "text-stone-600",
                light && "text-zinc-400",
              )}
              aria-busy="true"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{t("library.loadList")}</span>
            </div>
          ) : error ? (
            <p
              className={cn(
                "text-sm",
                dark && "text-red-400",
                ivory && "text-red-800",
                light && "text-red-600/90",
              )}
            >
              {t("library.loadErr")}: {error}
            </p>
          ) : rows.length === 0 ? (
            <p
              className={cn(
                "text-sm",
                dark && "text-zinc-500",
                ivory && "text-stone-600",
                light && "text-zinc-500",
              )}
            >
              {t("library.empty")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const busy = deletingId === row.id;
                return (
                  <li
                    key={row.id}
                    className={cardClass}
                    title={row.id}
                  >
                    <div className={previewHolderClass}>
                      {row.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.preview_url}
                          alt={row.name || t("library.preview")}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={cn(
                            "flex h-full w-full items-center justify-center text-xs",
                            dark && "text-zinc-500",
                            ivory && "text-stone-500",
                            light && "text-zinc-500",
                          )}
                        >
                          {t("library.noPreview")}
                        </div>
                      )}
                    </div>
                    <h3
                      className={cn(
                        "line-clamp-2 min-h-0 text-sm font-bold leading-snug",
                        dark && "text-zinc-100",
                        ivory && "text-stone-900",
                        light && "text-zinc-900",
                      )}
                    >
                      {row.name || t("library.unnamed")}
                    </h3>
                    <div className="mt-auto w-full pt-4">
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          dark && "text-zinc-500",
                          ivory && "text-stone-600",
                          light && "text-zinc-500",
                        )}
                      >
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
                          className={rowActionBtn}
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
                          className={rowActionBtn}
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
                          className={deleteBtnClass}
                          title={t("library.delete")}
                          aria-label={t("library.deleteAria", { name: row.name || t("library.unnamed") })}
                        >
                          {busy ? (
                            <Loader2
                              className={cn(
                                "h-4 w-4 shrink-0 animate-spin",
                                dark && "text-zinc-500",
                                ivory && "text-stone-500",
                                light && "text-zinc-500",
                              )}
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
