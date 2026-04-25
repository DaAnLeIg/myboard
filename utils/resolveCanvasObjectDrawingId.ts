/**
 * `public.canvas_objects.drawing_id` = идентификатор **работы** (строка в `public.drawings`),
 * тот же, что в URL: `?id=<uuid>` или `?drawing=<uuid>` (см. `src/app/page.tsx`).
 *
 * Параметр `?room=` (коллаборация в `hooks/useCollaboration`, `ROOM_PARAM`) **не** подставляется
 * в `drawing_id` — RLS в Supabase сопоставляет `canvas_objects` с `drawings` по владельцу доски-работы.
 */
export const DEFAULT_CANVAS_OBJECT_DRAWING_ID = "default" as const;

export function resolveCanvasObjectDrawingId(
  selectedDrawingId: string | null | undefined,
  idOrDrawingFromQuery: string | null | undefined,
): string {
  const fromProp = (selectedDrawingId && String(selectedDrawingId).trim()) || null;
  if (fromProp) {
    return fromProp;
  }
  const fromQuery = (idOrDrawingFromQuery && String(idOrDrawingFromQuery).trim()) || null;
  if (fromQuery) {
    return fromQuery;
  }
  return DEFAULT_CANVAS_OBJECT_DRAWING_ID;
}
