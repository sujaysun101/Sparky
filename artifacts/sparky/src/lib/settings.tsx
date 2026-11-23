import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RunInputMode } from "@workspace/api-client-react";

export type ThemeMode = "light" | "dark" | "system";
export type EditorFontSize = "sm" | "md" | "lg";

export interface SparkySettings {
  theme: ThemeMode;
  editorFontSize: EditorFontSize;
  editorWordWrap: boolean;
  defaultTutorMode: RunInputMode;
  showAiCosts: boolean;
  autoExpandAiTrace: boolean;
  soundOnComplete: boolean;
}

export const DEFAULT_SETTINGS: SparkySettings = {
  theme: "system",
  editorFontSize: "md",
  editorWordWrap: true,
  defaultTutorMode: "hint",
  showAiCosts: true,
  autoExpandAiTrace: false,
  soundOnComplete: false,
};

const STORAGE_KEY = "sparky.settings.v1";

function loadSettings(): SparkySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function resolveDark(theme: ThemeMode): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

interface SettingsContextValue {
  settings: SparkySettings;
  isDark: boolean;
  updateSetting: <K extends keyof SparkySettings>(key: K, value: SparkySettings[K]) => void;
  toggleTheme: () => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SparkySettings>(loadSettings);
  const [isDark, setIsDark] = useState<boolean>(() => resolveDark(loadSettings().theme));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }

    const apply = () => {
      const dark = resolveDark(settings.theme);
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };

    apply();

    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings]);

  const updateSetting = <K extends keyof SparkySettings>(key: K, value: SparkySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTheme = () => {
    setSettings((prev) => ({
      ...prev,
      theme: resolveDark(prev.theme) ? "light" : "dark",
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, isDark, updateSetting, toggleTheme, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

export function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // Ignore audio errors
  }
}
