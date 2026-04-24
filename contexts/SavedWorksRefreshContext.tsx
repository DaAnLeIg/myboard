"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type Ctx = {
  register: (fn: (() => void) | null) => void;
  request: () => void;
};

const SavedWorksRefreshContext = createContext<Ctx | null>(null);

export function SavedWorksRefreshProvider({ children }: { children: ReactNode }) {
  const ref = useRef<(() => void) | null>(null);
  const register = useCallback((fn: (() => void) | null) => {
    ref.current = fn;
  }, []);
  const request = useCallback(() => {
    ref.current?.();
  }, []);
  const v = useMemo(() => ({ register, request }), [register, request]);
  return (
    <SavedWorksRefreshContext.Provider value={v}>{children}</SavedWorksRefreshContext.Provider>
  );
}

export function useSavedWorksRefresh() {
  const c = useContext(SavedWorksRefreshContext);
  if (!c) {
    return {
      register: () => {},
      request: () => {},
    };
  }
  return c;
}
