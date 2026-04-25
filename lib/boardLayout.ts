import { cn } from "../utils/cn";

/** Внешняя оболочка доски, совпадает с консолью по центрированию. */
export const BOARD_OUTER_MAX_CLASS = "max-w-[800px]";
/** Та же ширина, что у рабочего поля. */
export const BOARD_CONTENT_WIDTH_CLASS = "w-[min(61.33vw,653px)]";
/** Рабочее поле: ширина консоли, обводка. */
export const BOARD_WIDTH_CLASS = cn(
  "relative overflow-hidden rounded-md border shadow-sm",
  BOARD_CONTENT_WIDTH_CLASS,
);
