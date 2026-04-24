"use client";

import { Globe } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "../contexts/LocaleContext";
import { LOCALE_LABELS_RU, LOCALE_ORDER, type AppLocale } from "../lib/locale-config";
import { cn } from "../utils/cn";

const ICON = 1.75 as const;

type LanguagePickerProps = {
  className: string;
  labelAria: string;
  labelTitle: string;
  dark: boolean;
  ivory: boolean;
};

export function LanguagePicker({
  className,
  labelAria,
  labelTitle,
  dark,
  ivory,
}: LanguagePickerProps) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const listId = useId();
  const prefersHoverRef = useRef(false);

  const clearClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!prefersHoverRef.current) {
      return;
    }
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 200);
  }, [clearClose]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    prefersHoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPtr = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Node && !wrapRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPtr, true);
    return () => document.removeEventListener("pointerdown", onPtr, true);
  }, [open]);

  const menuSurface = cn(
    "absolute start-0 top-full z-[120] mt-1 min-w-[12.5rem] max-h-[min(60vh,22rem)] overflow-y-auto rounded-xl border p-1 shadow-lg",
    dark
      ? "border-zinc-600 bg-zinc-900/98 text-zinc-100"
      : ivory
        ? "border-stone-300/90 bg-[#f5f1e6] text-stone-900"
        : "border-zinc-200 bg-white/98 text-zinc-900",
  );

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      onPointerEnter={() => {
        clearClose();
        if (prefersHoverRef.current) {
          setOpen(true);
        }
      }}
      onPointerLeave={() => {
        scheduleClose();
      }}
    >
      <button
        type="button"
        className={className}
        onClick={() => {
          setOpen((o) => !o);
        }}
        title={labelTitle}
        aria-label={labelAria}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <Globe className="h-4 w-4" strokeWidth={ICON} aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("locale.title")}
          className={menuSurface}
        >
          {LOCALE_ORDER.map((l) => (
            <li key={l} role="presentation" className="m-0 list-none p-0">
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                className={cn(
                  "w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition",
                  l === locale
                    ? dark
                      ? "bg-zinc-700 text-zinc-50"
                      : ivory
                        ? "bg-[#e4dcc8] text-stone-900"
                        : "bg-zinc-200 text-zinc-900"
                    : dark
                      ? "text-zinc-200 hover:bg-zinc-800"
                      : ivory
                        ? "text-stone-800 hover:bg-[#ebe4d2]"
                        : "text-zinc-800 hover:bg-zinc-50",
                )}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
              >
                {LOCALE_LABELS_RU[l]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
