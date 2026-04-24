"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLibraryModal } from "../../../contexts/LibraryModalContext";

/**
 * Старый маршрут /library: сразу открывает модальное окно библиотеки
 * и уводит на главную (список только в модалке).
 */
export default function LibraryPage() {
  const router = useRouter();
  const { open } = useLibraryModal();

  useEffect(() => {
    open();
    router.replace("/");
  }, [open, router]);

  return null;
}
