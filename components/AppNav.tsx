"use client";

import Link from "next/link";
import { Library } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLibraryModal } from "../contexts/LibraryModalContext";

export const APP_NAV_HEIGHT_PX = 40;

const navLinkClass = (active: boolean) =>
  `inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "border-black bg-black text-white"
      : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500"
  }`;

export default function AppNav() {
  const path = usePathname();
  const { isOpen: libraryOpen, open: openLibrary } = useLibraryModal();
  const isHome = path === "/";
  const isLibrary = libraryOpen;

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-[70] border-b border-black bg-white/95"
      style={{ minHeight: APP_NAV_HEIGHT_PX }}
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex h-full min-h-[40px] max-w-[1200px] items-center justify-between gap-3 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className={navLinkClass(isHome)}
            title="Доска"
            aria-current={isHome ? "page" : undefined}
          >
            MyBoard
          </Link>
          <button
            type="button"
            onClick={openLibrary}
            className={navLinkClass(isLibrary)}
            title="Библиотека работ"
            aria-pressed={isLibrary}
          >
            <Library className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span>Библиотека</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
