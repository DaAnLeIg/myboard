"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

const STORAGE_KEY = "myboard_appearance_v1";

export type Appearance = {
  comfort: boolean;
  inverted: boolean;
};

const defaultAppearance: Appearance = { comfort: false, inverted: false };

function readStored(): Appearance {
  if (typeof window === "undefined") {
    return { ...defaultAppearance };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultAppearance };
    }
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== "object" || p === null) {
      return { ...defaultAppearance };
    }
    const o = p as Record<string, unknown>;
    return {
      comfort: Boolean(o.comfort),
      inverted: Boolean(o.inverted),
    };
  } catch {
    return { ...defaultAppearance };
  }
}

type Ctx = {
  appearance: Appearance;
  setAppearance: Dispatch<SetStateAction<Appearance>>;
};

const AppearanceStateContext = createContext<Ctx | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(defaultAppearance);

  useEffect(() => {
    setAppearanceState(readStored());
  }, []);

  const setAppearance: Dispatch<SetStateAction<Appearance>> = useCallback(
    (next) => {
      setAppearanceState((prev) => {
        const n = typeof next === "function" ? next(prev) : next;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
          } catch {
            // ignore
          }
        }
        return n;
      });
    },
    [],
  );

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance]);

  return (
    <AppearanceStateContext.Provider value={value}>
      {children}
    </AppearanceStateContext.Provider>
  );
}

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceStateContext);
  if (!ctx) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return ctx;
}
