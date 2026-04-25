import type { Appearance } from "../contexts/AppearanceContext";

export type BoardChrome = "light" | "dark" | "ivory";

export function boardChromeFromAppearance(appearance: Appearance): BoardChrome {
  if (appearance.comfort) {
    return "ivory";
  }
  if (appearance.inverted) {
    return "dark";
  }
  return "light";
}

/**
 * Согласовано с `StudioConsole`: `dark` | `ivory` | снежно-серый (light), не `comfort` как «светлая» без инверсии.
 */
export function getBoardTheme(appearance: Appearance) {
  const boardChrome = boardChromeFromAppearance(appearance);
  const dark = boardChrome === "dark";
  const ivory = boardChrome === "ivory";
  return { boardChrome, dark, ivory, light: boardChrome === "light" } as const;
}
