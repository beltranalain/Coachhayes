// App theme: Light / Dark / System. Resolves the active palette and exposes it
// via useColors(); screens build their StyleSheets with useThemedStyles(makeStyles)
// so they re-theme live. The choice is persisted; "system" follows the OS setting.

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ThemeColors } from "./theme";

export type ThemeMode = "light" | "dark" | "system";

type ThemeValue = {
  mode: ThemeMode;
  scheme: "light" | "dark";
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
};

const KEY = "ch-theme-mode";
const ThemeContext = createContext<ThemeValue>({ mode: "dark", scheme: "dark", colors: darkColors, setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    }).catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => { setModeState(m); AsyncStorage.setItem(KEY, m).catch(() => {}); };

  const scheme: "light" | "dark" = mode === "system" ? (system === "light" ? "light" : "dark") : mode;
  const colors = scheme === "light" ? lightColors : darkColors;
  const value = useMemo<ThemeValue>(() => ({ mode, scheme, colors, setMode }), [mode, scheme, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
export function useColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

// Build (and memoize) a themed StyleSheet from a factory that takes the palette.
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
