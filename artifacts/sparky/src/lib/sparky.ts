export function errMsg(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const anyE = e as { data?: { error?: string; message?: string }; message?: string };
  return anyE.data?.error || anyE.data?.message || anyE.message || "Something went wrong";
}

export function newKey(): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `send-${r}`;
}

export type DraftBackup = { code: string; question: string; dirty: boolean; at: number };

const k = (id: string) => `sparky:draft:${id}`;

export function readBackup(id: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(k(id));
    const value = raw ? JSON.parse(raw) as Partial<DraftBackup> : null;
    return value && typeof value.code === "string" && typeof value.question === "string" && typeof value.dirty === "boolean" && typeof value.at === "number" ? value as DraftBackup : null;
  } catch {
    return null;
  }
}

export function writeBackup(id: string, b: DraftBackup) {
  try {
    localStorage.setItem(k(id), JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

export function fmtMs(ms?: number | null) {
  if (ms == null) return "";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export const TRACE_STEPS: { step: string; label: string; what: string }[] = [
  { step: "browser", label: "Browser", what: "Your browser packages the question and code and sends an HTTP request." },
  { step: "validation", label: "Validation", what: "The server checks the request shape and limits before trusting it." },
  { step: "database", label: "Database", what: "Your message and the run are written to the database." },
  { step: "ai", label: "AI model", what: "The server asks the AI provider for guidance." },
  { step: "response", label: "Response", what: "The answer is saved and sent back to your browser." },
  { step: "display", label: "Display", what: "Your browser renders the reply and confirms it was shown." },
];
