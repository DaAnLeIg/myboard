"use client";

import Link from "next/link";
import { useLocale } from "../contexts/LocaleContext";
import { cn } from "../utils/cn";

export function PrivacyView() {
  const { t, isUiRtl } = useLocale();

  return (
    <main
      className={cn(
        "mx-auto min-h-screen max-w-2xl px-4 py-10 text-zinc-800 sm:px-6 sm:py-14",
        isUiRtl && "text-right",
      )}
      dir={isUiRtl ? "rtl" : "ltr"}
    >
      <p className="mb-6 text-sm text-zinc-500">
        <Link
          href="/"
          className="text-zinc-700 underline-offset-2 hover:underline"
        >
          {t("priv.back")}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {t("priv.title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">{t("priv.appLine")}</p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.1h")}
          </h2>
          <p>{t("priv.1p")}</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.2h")}
          </h2>
          <p>{t("priv.2p")}</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.3h")}
          </h2>
          <p>{t("priv.3p")}</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.4h")}
          </h2>
          <p>{t("priv.4p")}</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.5h")}
          </h2>
          <p>{t("priv.5p")}</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            {t("priv.6h")}
          </h2>
          <p>{t("priv.6p")}</p>
        </section>
      </div>
    </main>
  );
}
