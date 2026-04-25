/**
 * BCP-47 / language ids used in MyBoard. "es-AR" is Argentine Spanish.
 * "hi" — Hindi (India) Devanagari keyboard / script.
 */
export type AppLocale = "ru" | "en" | "cs" | "es-AR" | "hu" | "de" | "hi" | "ar";

export const LOCALE_ORDER: AppLocale[] = [
  "ru",
  "en",
  "cs",
  "es-AR",
  "hu",
  "de",
  "hi",
  "ar",
];

/** Название языка на самом языке (для списка в переключателе). */
export const LOCALE_ENDONYMS: Record<AppLocale, string> = {
  ru: "Русский",
  en: "English",
  cs: "Čeština",
  "es-AR": "Español (Argentina)",
  hu: "Magyar",
  de: "Deutsch",
  hi: "हिन्दी",
  ar: "العربية",
};

export const BCP47_BY_LOCALE: Record<AppLocale, string> = {
  ru: "ru",
  en: "en",
  cs: "cs",
  "es-AR": "es-AR",
  hu: "hu",
  de: "de",
  hi: "hi",
  ar: "ar",
};

export const IS_UI_RTL: Record<AppLocale, boolean> = {
  ru: false,
  en: false,
  cs: false,
  "es-AR": false,
  hu: false,
  de: false,
  hi: false,
  ar: true,
};

export const IS_TEXT_RTL: Record<AppLocale, boolean> = IS_UI_RTL;

export const LOCALE_STORAGE_KEY = "myboard-locale";

export function isAppLocale(s: string | null | undefined): s is AppLocale {
  if (!s) {
    return false;
  }
  return (LOCALE_ORDER as string[]).includes(s);
}
