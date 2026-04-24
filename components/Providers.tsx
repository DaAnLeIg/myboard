"use client";

import { LibraryModalProvider } from "../contexts/LibraryModalContext";
import { SavedWorksRefreshProvider } from "../contexts/SavedWorksRefreshContext";
import LibraryModal from "./LibraryModal";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LibraryModalProvider>
      <SavedWorksRefreshProvider>
        {children}
      </SavedWorksRefreshProvider>
      <LibraryModal />
    </LibraryModalProvider>
  );
}
