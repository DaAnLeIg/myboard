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

export type AppearanceState = {
  inverted: boolean;
  comfort: boolean;
};

const defaultState: AppearanceState = { inverted: false, comfort: false };

function readFromStorage(): AppearanceState {
  if (typeof window === "undefined") {
    return defaultState;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }
    const p = JSON.parse(raw) as Partial<AppearanceState>;
    return {
      inverted: Boolean(p.inverted),
      comfort: Boolean(p.comfort),
    };
  } catch {
    return defaultState;
  }
}

type AppearanceValue = {
  appearance: AppearanceState;
  setAppearance: Dispatch<SetStateAction<AppearanceState>>;
};

const Ctx = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceState>(defaultState);

  useEffect(() => {
    setAppearanceState(readFromStorage());
  }, []);

  const setAppearance = useCallback(
    (next: SetStateAction<AppearanceState>) => {
      setAppearanceState((prev) => {
        const resolved = typeof next === "function" ? (next as (a: AppearanceState) => AppearanceState)(prev) : next;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
          } catch {
            // ignore
          }
        }
        return resolved;
      });
    },
    [],
  );

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppearance() {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return c;
}
