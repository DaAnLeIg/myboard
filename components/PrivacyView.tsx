"use client";

import Link from "next/link";
import { useLocale } from "../contexts/LocaleContext";
import { useAppearance } from "../contexts/AppearanceContext";
import { getBoardTheme } from "../lib/boardTheme";
import { cn } from "../utils/cn";

export function PrivacyView() {
  const { t, isUiRtl } = useLocale();
  const { appearance } = useAppearance();
  const { dark, ivory } = getBoardTheme(appearance);

  return (
    <main
      className={cn(
        "mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6 sm:py-14",
        ivory
          ? "bg-[#eae5d6] text-stone-800"
          : dark
            ? "bg-zinc-950 text-zinc-200"
            : "bg-gray-50 text-zinc-800",
        isUiRtl && "text-right",
      )}
      dir={isUiRtl ? "rtl" : "ltr"}
    >
      <p
        className={cn(
          "mb-6 text-sm",
          ivory ? "text-stone-600" : dark ? "text-zinc-400" : "text-zinc-500",
        )}
      >
        <Link
          href="/"
          className={cn(
            "underline-offset-2 hover:underline",
            ivory ? "text-stone-800" : dark ? "text-zinc-200" : "text-zinc-700",
          )}
        >
          {t("priv.back")}
        </Link>
      </p>
      <h1
        className={cn(
          "text-2xl font-semibold tracking-tight sm:text-3xl",
          ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900",
        )}
      >
        {t("priv.title")}
      </h1>
      <p
        className={cn("mt-2 text-sm", ivory ? "text-stone-600" : dark ? "text-zinc-400" : "text-zinc-500")}
      >
        {t("priv.appLine")}
      </p>

      <div
        className={cn(
          "mt-10 space-y-6 text-[15px] leading-relaxed",
          ivory ? "text-stone-800" : dark ? "text-zinc-300" : "text-zinc-700",
        )}
      >
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.1h")}
          </h2>
          <p>{t("priv.1p")}</p>
        </section>
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.2h")}
          </h2>
          <p>{t("priv.2p")}</p>
        </section>
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.3h")}
          </h2>
          <p>{t("priv.3p")}</p>
        </section>
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.4h")}
          </h2>
          <p>{t("priv.4p")}</p>
        </section>
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.5h")}
          </h2>
          <p>{t("priv.5p")}</p>
        </section>
        <section>
          <h2
            className={cn("mb-2 text-base font-semibold", ivory ? "text-stone-900" : dark ? "text-zinc-100" : "text-zinc-900")}
          >
            {t("priv.6h")}
          </h2>
          <p>{t("priv.6p")}</p>
        </section>
      </div>
    </main>
  );
}
