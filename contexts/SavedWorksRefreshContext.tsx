"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { DrawingRow } from "../utils/drawingsApi";

type Ctx = {
  register: (fn: (() => void) | null) => void;
  registerCreated: (fn: ((row: DrawingRow) => void) | null) => void;
  request: () => void;
  publishCreated: (row: DrawingRow) => void;
};

const SavedWorksRefreshContext = createContext<Ctx | null>(null);

export function SavedWorksRefreshProvider({ children }: { children: ReactNode }) {
  const ref = useRef<(() => void) | null>(null);
  const createdRef = useRef<((row: DrawingRow) => void) | null>(null);
  const register = useCallback((fn: (() => void) | null) => {
    ref.current = fn;
  }, []);
  const registerCreated = useCallback((fn: ((row: DrawingRow) => void) | null) => {
    createdRef.current = fn;
  }, []);
  const request = useCallback(() => {
    ref.current?.();
  }, []);
  const publishCreated = useCallback((row: DrawingRow) => {
    createdRef.current?.(row);
  }, []);
  const v = useMemo(
    () => ({ register, registerCreated, request, publishCreated }),
    [register, registerCreated, request, publishCreated],
  );
  return (
    <SavedWorksRefreshContext.Provider value={v}>{children}</SavedWorksRefreshContext.Provider>
  );
}

export function useSavedWorksRefresh() {
  const c = useContext(SavedWorksRefreshContext);
  if (!c) {
    return {
      register: () => {},
      registerCreated: () => {},
      request: () => {},
      publishCreated: () => {},
    };
  }
  return c;
}
