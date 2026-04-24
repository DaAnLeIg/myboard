"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BCP47_BY_LOCALE,
  type AppLocale,
  IS_TEXT_RTL,
  IS_UI_RTL,
  LOCALE_STORAGE_KEY,
  isAppLocale,
} from "../lib/locale-config";
import { tImpl, type I18nVars } from "../lib/i18n-table";

export type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: string, vars?: I18nVars) => string;
  inputBcp47: string;
  isTextRtl: boolean;
  isUiRtl: boolean;
  localeBcp47: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "ru";
  }
  const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
  return isAppLocale(raw) ? raw : "ru";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("ru");

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useLayoutEffect(() => {
    setLocaleState(readInitialLocale());
  }, []);

  const t = useCallback(
    (key: string, vars?: I18nVars) => tImpl(locale, key, vars),
    [locale],
  );

  const localeBcp47 = BCP47_BY_LOCALE[locale];
  const isTextRtl = IS_TEXT_RTL[locale];
  const isUiRtl = IS_UI_RTL[locale];
  const inputBcp47 = localeBcp47;

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.lang = localeBcp47;
    document.documentElement.dir = isUiRtl ? "rtl" : "ltr";
  }, [localeBcp47, isUiRtl]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      inputBcp47,
      isTextRtl,
      isUiRtl,
      localeBcp47,
    }),
    [locale, setLocale, t, inputBcp47, isTextRtl, isUiRtl, localeBcp47],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const c = useContext(LocaleContext);
  if (!c) {
    throw new Error("useLocale() must be used under LocaleProvider");
  }
  return c;
}
