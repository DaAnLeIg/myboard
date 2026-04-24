"use client";

import { Loader2 } from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";

const ICON = 1.75 as const;

export function LoadingPage() {
  const { t } = useLocale();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100">
      <Loader2
        className="h-8 w-8 animate-spin text-zinc-400"
        strokeWidth={ICON}
        aria-hidden
      />
      <span className="sr-only">{t("load.page")}</span>
    </div>
  );
}
