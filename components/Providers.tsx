"use client";

import { LibraryModalProvider } from "../contexts/LibraryModalContext";
import LibraryModal from "./LibraryModal";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LibraryModalProvider>
      {children}
      <LibraryModal />
    </LibraryModalProvider>
  );
}
