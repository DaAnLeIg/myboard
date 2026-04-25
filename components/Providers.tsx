"use client";

import { LocaleProvider } from "../contexts/LocaleContext";
import { AppearanceProvider } from "../contexts/AppearanceContext";
import { LibraryModalProvider } from "../contexts/LibraryModalContext";
import { SavedWorksRefreshProvider } from "../contexts/SavedWorksRefreshContext";
import LibraryModal from "./LibraryModal";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <AppearanceProvider>
        <LibraryModalProvider>
          <SavedWorksRefreshProvider>
            {children}
          </SavedWorksRefreshProvider>
          <LibraryModal />
        </LibraryModalProvider>
      </AppearanceProvider>
    </LocaleProvider>
  );
}
