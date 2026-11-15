import { useEffect, useRef } from "react";
import type { Message, Guidance, RunInputMode } from "@workspace/api-client-react";
import { Send, Lightbulb, BookOpen, KeyRound, ShieldAlert, AlertTriangle, RotateCw, MessageSquare, CornerDownLeft, Replace } from "lucide-react";

const MODES: { id: RunInputMode; label: string; icon: typeof Send; desc: string }[] = [
  { id: "hint", label: "Hint", icon: Lightbulb, desc: "A nudge, no answer" },
  { id: "explain", label: "Explain", icon: BookOpen, desc: "The idea behind it" },
  { id: "solution", label: "Solution", icon: KeyRound, desc: "Full worked code" },
];

function CodeExample({
  code,
  messageId,
  onApplyCode,
}: {
  code: string;
  messageId: string;
  onApplyCode: (code: string, action: "insert" | "replace") => void;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-[hsl(222_22%_14%)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="mr-auto font-mono text-[10px] uppercase tracking-wider text-white/55">Suggested code · review before applying</span>
        <button type="button" data-testid={`button-apply-insert-${messageId}`} onClick={() => onApplyCode(code, "insert")}
          className="inline-flex items-center gap-1 rounded bg-[hsl(14_73%_43%)] px-2 py-1 text-[11px] font-medium text-white transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <CornerDownLeft className="h-3 w-3" aria-hidden /> Insert at cursor
        </button>
        <button type="button" data-testid={`button-apply-replace-${messageId}`} onClick={() => onApplyCode(code, "replace")}
          className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] font-medium text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Replace className="h-3 w-3" aria-hidden /> Replace draft
        </button>
      </div>
      <pre className="max-h-64 overflow-auto p-3 font-mono text-xs leading-5 text-[hsl(40_25%_90%)]"><code>{code}</code></pre>
    </div>
  );
}

function GuidanceView({
  g,
  messageId,
  onApplyCode,
}: {
  g: Guidance;
  messageId: string;
  onApplyCode: (code: string, action: "insert" | "replace") => void;
}) {
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="mt-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">{items.map((i, n) => <li key={n}>{i}</li>)}</ul>
      </div>
    );
  return (
    <div className="text-sm">
      <p className="whitespace-pre-wrap">{g.explanation}</p>
      {g.nextStep && <p className="mt-3 rounded border-l-2 border-primary bg-primary/5 px-3 py-2"><span className="font-medium">Next step: </span>{g.nextStep}</p>}
      {g.codeExample && <CodeExample code={g.codeExample} messageId={messageId} onApplyCode={onApplyCode} />}
      {g.concepts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">{g.concepts.map((c) => <span key={c} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-secondary-foreground">{c}</span>)}</div>
      )}
      {list("Common mistakes", g.commonMistakes)}
      {list("Learn next", g.nextTopicsToLearn)}
      {g.encouragement && <p className="mt-3 italic text-secondary-foreground">{g.encouragement}</p>}
    </div>
  );
}

export function TutorPanel({
  messages,
  question,
  onQuestion,
  mode,
  onMode,
  onSend,
  sending,
  simulateFailure,
  onSimulateFailure,
  sendError,
  failedRunId,
  onRetry,
  onRendered,
  currentTaskTitle,
  draftLength,
  onApplyCode,
}: {
  messages: Message[];
  question: string;
  onQuestion: (v: string) => void;
  mode: RunInputMode;
  onMode: (m: RunInputMode) => void;
  onSend: () => void;
  sending: boolean;
  simulateFailure: boolean;
  onSimulateFailure: (v: boolean) => void;
  sendError: string | null;
  failedRunId: string | null;
  onRetry: () => void;
  onRendered: (runIds: string[]) => void;
  currentTaskTitle?: string;
  draftLength: number;
  onApplyCode: (code: string, action: "insert" | "replace") => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(onRendered);
  renderedRef.current = onRendered;

  // Runs after the browser has committed these messages to the DOM.
  useEffect(() => {
    const ids = messages.filter((m) => m.role === "assistant" && m.runId).map((m) => m.runId as string);
    const raf = requestAnimationFrame(() => renderedRef.current(ids));
    endRef.current?.scrollIntoView({ block: "end" });
    return () => cancelAnimationFrame(raf);
  }, [messages]);

  return (
    <section aria-labelledby="tutor" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <h2 id="tutor" className="font-display text-base font-bold">Tutor</h2>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldAlert className="h-3 w-3" aria-hidden /> AI guidance may need verification.</p>
        <p data-testid="status-draft-context" className="mt-2 flex items-center gap-2 rounded-md border border-secondary-foreground/15 bg-secondary/55 px-2.5 py-1.5 text-[11px] text-secondary-foreground" role="status">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-4" aria-hidden />
          Every question includes your current editor draft
          <span className="ml-auto font-mono tabular-nums">{draftLength.toLocaleString()} chars</span>
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto mt-6 max-w-xs text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto h-6 w-6" aria-hidden />
            <p className="mt-2">Stuck{currentTaskTitle ? ` on "${currentTaskTitle}"` : ""}? Start with a hint. Ask for the solution only when you've tried.</p>
          </div>
        ) : (
          messages.map((m) => (
            <article key={m.id} data-testid={`message-${m.id}`} className={m.role === "user" ? "ml-8 rounded-lg bg-muted px-3 py-2 text-sm" : "rise"}>
              {m.role === "assistant" ? (
                <div className="rounded-lg border border-card-border bg-card p-3">
                  <p className="mb-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><ShieldAlert className="h-3 w-3" aria-hidden /> AI · may need verification</p>
                  {m.guidance ? (
                    <GuidanceView g={m.guidance} messageId={m.id} onApplyCode={onApplyCode} />
                  ) : (() => {
                    const match = m.content.match(/```(?:[\w#+.-]+)?[ \t]*\n([\s\S]*?)```/);
                    const code = match?.[1]?.replace(/\n$/, "");
                    return (
                      <>
                        <p className="whitespace-pre-wrap text-sm">{match ? m.content.replace(match[0], "").trim() : m.content}</p>
                        {code && <CodeExample code={code} messageId={m.id} onApplyCode={onApplyCode} />}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </article>
          ))
        )}
        {sending && <div className="h-16 animate-pulse rounded-lg bg-muted" aria-label="Waiting for tutor" />}
        <div ref={endRef} />
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
      >
        <div role="radiogroup" aria-label="Tutor mode" className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const on = mode === m.id;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} data-testid={`button-mode-${m.id}`} onClick={() => onMode(m.id)} title={m.desc}
                className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${on ? (m.id === "solution" ? "bg-primary text-primary-foreground" : "bg-card shadow-sm") : "text-muted-foreground"}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden /> {m.label}
              </button>
            );
          })}
        </div>
        {mode === "solution" && <p className="mb-2 text-[11px] text-primary">You asked for the full solution. Try reading it line by line before copying.</p>}
        <label htmlFor="question" className="sr-only">Your question</label>
        <textarea id="question" data-testid="input-question" rows={3} maxLength={4000} value={question} onChange={(e) => onQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); } }}
          placeholder="Why does my total show NaN?" className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        {sendError && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="flex-1">{sendError} Your question and code are kept.</span>
            {failedRunId && <button type="button" data-testid="button-retry-send" onClick={onRetry} className="inline-flex items-center gap-1 font-medium"><RotateCw className="h-3 w-3" aria-hidden /> Retry</button>}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" data-testid="checkbox-simulate-ai-failure" checked={simulateFailure} onChange={(e) => onSimulateFailure(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Simulate AI failure
          </label>
          <button type="submit" data-testid="button-send" disabled={sending || !question.trim()} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50">
            <Send className="h-3.5 w-3.5" aria-hidden /> Ask
          </button>
        </div>
      </form>
    </section>
  );
}
