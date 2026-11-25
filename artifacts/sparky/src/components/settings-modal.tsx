import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Settings, X, RotateCcw, Sparkles, Code2, MessageSquarePlus, Send, CheckCircle2, Mail } from "lucide-react";
import { useSettings, type EditorFontSize, type ThemeMode } from "@/lib/settings";
import type { RunInputMode } from "@workspace/api-client-react";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/80 bg-muted/35 px-3.5 py-2.5 transition-colors hover:bg-muted/60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function SettingsControls({ compact = false }: { compact?: boolean }) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"preferences" | "feedback">("preferences");
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbMessage, setFbMessage] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbResult, setFbResult] = useState<{ emailSent: boolean; recipient: string; mailtoUrl: string } | null>(null);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbError(null);
    setFbSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fbName, email: fbEmail, message: fbMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit feedback.");
      const subject = encodeURIComponent(`Sparky Feedback from ${fbName.trim() || fbEmail.trim()}`);
      const body = encodeURIComponent(`From: ${fbName.trim() ? `${fbName.trim()} <${fbEmail.trim()}>` : fbEmail.trim()}\n\n${fbMessage.trim()}`);
      setFbResult({
        emailSent: Boolean(data.emailSent),
        recipient: data.recipient || "sujay9sundar@gmail.com",
        mailtoUrl: `mailto:${data.recipient || "sujay9sundar@gmail.com"}?subject=${subject}&body=${body}`,
      });
      setFbMessage("");
    } catch (err: unknown) {
      setFbError(err instanceof Error ? err.message : "Could not submit feedback.");
    } finally {
      setFbSending(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  const fontSizes: { id: EditorFontSize; label: string }[] = [
    { id: "sm", label: "Small (12px)" },
    { id: "md", label: "Medium (13px)" },
    { id: "lg", label: "Large (15px)" },
  ];

  const tutorModes: { id: RunInputMode; label: string }[] = [
    { id: "hint", label: "Hint" },
    { id: "explain", label: "Explain" },
    { id: "solution", label: "Solution" },
  ];

  return (
    <>
      <button
        type="button"
        data-testid="button-open-settings"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden />
        {!compact && <span>Settings</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            data-testid="dialog-settings"
            className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" aria-hidden />
                <h2 id="settings-title" className="font-display text-lg font-bold">Settings</h2>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 border-b border-border bg-muted/30 px-5">
              <button
                type="button"
                data-testid="tab-settings-preferences"
                onClick={() => setActiveTab("preferences")}
                className={`flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === "preferences"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings className="h-3.5 w-3.5" aria-hidden /> Preferences
              </button>
              <button
                type="button"
                data-testid="tab-settings-feedback"
                onClick={() => {
                  setActiveTab("feedback");
                  setFbResult(null);
                  setFbError(null);
                }}
                className={`flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === "feedback"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden /> Feedback
              </button>
            </div>

            {activeTab === "feedback" ? (
              <form onSubmit={submitFeedback} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Share feedback on Sparky</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your feedback is saved and routed to <span className="font-mono text-foreground">sujay9sundar@gmail.com</span>.
                  </p>
                </div>

                <div>
                  <label htmlFor="feedback-message" className="mb-1.5 block text-xs font-medium text-foreground">
                    What feedback do you have about Sparky? *
                  </label>
                  <textarea
                    id="feedback-message"
                    data-testid="input-feedback-message"
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={4}
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    placeholder="What worked well, what felt confusing, or what feature should we build next?"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="feedback-name" className="mb-1.5 block text-xs font-medium text-foreground">
                      Name <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      id="feedback-name"
                      data-testid="input-feedback-name"
                      type="text"
                      maxLength={120}
                      value={fbName}
                      onChange={(e) => setFbName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="feedback-email" className="mb-1.5 block text-xs font-medium text-foreground">
                      Email *
                    </label>
                    <input
                      id="feedback-email"
                      data-testid="input-feedback-email"
                      type="email"
                      required
                      maxLength={180}
                      value={fbEmail}
                      onChange={(e) => setFbEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {fbError && (
                  <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {fbError}
                  </p>
                )}

                {fbResult && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {fbResult.emailSent
                        ? `Feedback sent to ${fbResult.recipient}!`
                        : `Feedback saved! (Email relay not configured on this host)`}
                    </div>
                    {!fbResult.emailSent && (
                      <a
                        href={fbResult.mailtoUrl}
                        className="mt-2 inline-flex items-center gap-1.5 font-semibold underline"
                      >
                        <Mail className="h-3.5 w-3.5" aria-hidden /> Open in email app to send to {fbResult.recipient}
                      </a>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    data-testid="button-submit-feedback"
                    disabled={fbSending || !fbMessage.trim() || !fbEmail.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {fbSending ? "Sending..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            ) : (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* Appearance */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sun className="h-3.5 w-3.5" aria-hidden /> Appearance
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = settings.theme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`button-theme-${opt.id}`}
                        onClick={() => updateSetting("theme", opt.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Code Editor */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" aria-hidden /> Code Editor
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/35 px-3.5 py-2.5">
                  <p className="mb-2 text-sm font-medium">Editor Font Size</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {fontSizes.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        data-testid={`button-font-${f.id}`}
                        onClick={() => updateSetting("editorFontSize", f.id)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                          settings.editorFontSize === f.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ToggleRow
                  label="Word wrap"
                  description="Wrap long lines in the code editor instead of horizontal scrolling."
                  checked={settings.editorWordWrap}
                  onChange={(v) => updateSetting("editorWordWrap", v)}
                  testId="switch-word-wrap"
                />
              </section>

              {/* Tutor & Observability */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Tutor &amp; Trace Observability
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/35 px-3.5 py-2.5">
                  <p className="mb-2 text-sm font-medium">Default Tutor Mode</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {tutorModes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateSetting("defaultTutorMode", m.id)}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                          settings.defaultTutorMode === m.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ToggleRow
                  label="Show AI cost & token badges"
                  description="Display estimated USD cost and token usage next to step durations."
                  checked={settings.showAiCosts}
                  onChange={(v) => updateSetting("showAiCosts", v)}
                  testId="switch-ai-costs"
                />
                <ToggleRow
                  label="Auto-expand AI step on completion"
                  description="Automatically open the Gemini step inspector when a tutor run finishes."
                  checked={settings.autoExpandAiTrace}
                  onChange={(v) => updateSetting("autoExpandAiTrace", v)}
                  testId="switch-auto-expand"
                />
                <ToggleRow
                  label="Completion sound chime"
                  description="Play a gentle chime when a tutor run finishes."
                  checked={settings.soundOnComplete}
                  onChange={(v) => updateSetting("soundOnComplete", v)}
                  testId="switch-sound"
                />
              </section>
            </div>
            )}

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={resetSettings}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset defaults
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-semibold text-background"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
