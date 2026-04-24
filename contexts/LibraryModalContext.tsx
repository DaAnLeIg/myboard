"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const LibraryModalContext = createContext<Ctx | null>(null);

export function LibraryModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((o) => !o), []);
  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );
  return (
    <LibraryModalContext.Provider value={value}>{children}</LibraryModalContext.Provider>
  );
}

export function useLibraryModal(): Ctx {
  const c = useContext(LibraryModalContext);
  if (!c) {
    throw new Error("useLibraryModal must be used within LibraryModalProvider");
  }
  return c;
}
