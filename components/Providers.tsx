"use client";

import { LocaleProvider } from "../contexts/LocaleContext";
import { LibraryModalProvider } from "../contexts/LibraryModalContext";
import { SavedWorksRefreshProvider } from "../contexts/SavedWorksRefreshContext";
import LibraryModal from "./LibraryModal";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LibraryModalProvider>
        <SavedWorksRefreshProvider>
          {children}
        </SavedWorksRefreshProvider>
        <LibraryModal />
      </LibraryModalProvider>
    </LocaleProvider>
  );
}
