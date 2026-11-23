import { useEffect, useState } from "react";
import type { Run, RunEvent } from "@workspace/api-client-react";
import { CheckCircle2, Circle, Loader2, XCircle, RotateCw, ChevronDown, ArrowDown, Activity } from "lucide-react";
import { TRACE_STEPS, fmtMs } from "@/lib/sparky";
import { useSettings } from "@/lib/settings";

interface StepDetails {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  received?: unknown;
  sent?: unknown;
}

const statusMeta: Record<string, { icon: typeof Circle; cls: string; surface: string; text: string }> = {
  pending: { icon: Circle, cls: "text-muted-foreground", surface: "bg-muted", text: "Waiting" },
  running: { icon: Loader2, cls: "text-primary", surface: "bg-primary/10", text: "Running" },
  retrying: { icon: RotateCw, cls: "text-primary", surface: "bg-primary/10", text: "Retrying" },
  completed: { icon: CheckCircle2, cls: "text-chart-4", surface: "bg-secondary", text: "Done" },
  failed: { icon: XCircle, cls: "text-destructive", surface: "bg-destructive/10", text: "Failed" },
};

function time(s?: string | null) {
  return s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}

function fmtCost(usd?: number | null) {
  if (usd == null) return null;
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}

function runTotals(r: Run | undefined) {
  if (!r) return { durationMs: 0, costUsd: 0, totalTokens: 0 };
  let durationMs = 0;
  let costUsd = 0;
  let totalTokens = 0;
  for (const e of r.events) {
    if (e.durationMs != null) durationMs += e.durationMs;
    const d = (e as RunEvent & { details?: StepDetails | null }).details;
    if (d?.costUsd != null) costUsd += d.costUsd;
    if (d?.totalTokens != null) totalTokens += d.totalTokens;
  }
  return { durationMs, costUsd, totalTokens };
}

export function TracePanel({
  run,
  runs,
  selectedId,
  onSelect,
  onRetry,
  retrying,
  live,
  busy,
}: {
  run: Run | undefined;
  runs: Run[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
  retrying: boolean;
  live: boolean;
  busy?: boolean;
}) {
  const { settings } = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string>("");

  useEffect(() => {
    if (settings.autoExpandAiTrace && run?.status === "completed") {
      setOpen("ai");
    }
  }, [settings.autoExpandAiTrace, run?.id, run?.status]);
  const latestByStep = new Map<string, RunEvent[]>();
  run?.events.forEach((e) => latestByStep.set(e.step, [...(latestByStep.get(e.step) ?? []), e]));

  const compareRun = compareId && compareId !== run?.id ? runs.find((r) => r.id === compareId) : undefined;
  const compareByStep = new Map<string, RunEvent>();
  compareRun?.events.forEach((e) => compareByStep.set(e.step, e));

  const totals = runTotals(run);
  const compareTotals = runTotals(compareRun);
  const totalDeltaMs = compareRun ? totals.durationMs - compareTotals.durationMs : null;

  return (
    <section aria-labelledby="how" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <Activity className="h-4 w-4 text-secondary-foreground" aria-hidden />
        <h2 id="how" className="font-display text-base font-bold">How it works</h2>
        {live && run?.status === "running" && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-primary"><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary" />live</span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {runs.length > 0 && (
            <>
              <label htmlFor="run-select" className="sr-only">Recent runs</label>
              <select id="run-select" data-testid="select-run" value={selectedId ?? ""} disabled={busy} onChange={(e) => onSelect(e.target.value)} className="max-w-[12rem] rounded border border-input bg-card px-2 py-1 font-mono text-[11px]">
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>{time(r.createdAt)} · {r.status}{r.attempt > 1 ? ` · try ${r.attempt}` : ""}</option>
                ))}
              </select>
            </>
          )}
          {runs.length > 1 && run && (
            <>
              <label htmlFor="compare-select" className="sr-only">Compare with run</label>
              <select
                id="compare-select"
                data-testid="select-compare-run"
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                className="max-w-[11rem] rounded border border-input bg-card px-2 py-1 font-mono text-[11px]"
              >
                <option value="">Compare timing...</option>
                {runs.filter((r) => r.id !== run.id).map((r) => (
                  <option key={r.id} value={r.id}>vs {time(r.createdAt)} ({r.status})</option>
                ))}
              </select>
            </>
          )}
          {run && (run.status === "failed" || run.status === "interrupted") && (
            <button data-testid="button-retry-run" onClick={() => onRetry(run.id)} disabled={retrying} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60">
              <RotateCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} aria-hidden /> Retry run
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <>
          {run ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span className="break-all">Run ID: {run.id} · {run.status} · attempt {run.attempt}</span>
                {totals.durationMs > 0 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">Total {fmtMs(totals.durationMs)}</span>
                )}
                {settings.showAiCosts && totals.costUsd > 0 && (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                    {fmtCost(totals.costUsd)} · {totals.totalTokens} tok
                  </span>
                )}
                {totalDeltaMs !== null && (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${totalDeltaMs <= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                    {totalDeltaMs <= 0 ? `-${fmtMs(Math.abs(totalDeltaMs))} faster` : `+${fmtMs(totalDeltaMs)} slower`}
                  </span>
                )}
              </div>
              {run.error && <p role="alert" className="mb-2 rounded bg-destructive/10 px-2 py-1.5 text-xs text-destructive">Run {run.status}: {run.error}{run.simulated ? " (simulated failure)" : ""}</p>}
            </>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">This is the path a tutor request takes. Ask a question to see its live status, measured timings, AI cost, and step payloads.</p>
          )}
            <ol className="relative" aria-label={run ? `Request flow, ${run.status}` : "Request flow diagram"} aria-live="polite">
              {TRACE_STEPS.map((s) => {
                const evs = latestByStep.get(s.step);
                const ev = evs?.[evs.length - 1];
                const evDetails = (ev as (RunEvent & { details?: StepDetails | null }) | undefined)?.details ?? null;
                const compareEv = compareByStep.get(s.step);
                const stepDeltaMs = ev?.durationMs != null && compareEv?.durationMs != null ? ev.durationMs - compareEv.durationMs : null;
                const st = ev?.status ?? "pending";
                const m = statusMeta[st] ?? statusMeta.pending;
                const Icon = m.icon;
                const isOpen = open === s.step;
                const index = TRACE_STEPS.findIndex((step) => step.step === s.step);
                const nextEvent = index < TRACE_STEPS.length - 1
                  ? latestByStep.get(TRACE_STEPS[index + 1]!.step)?.slice(-1)[0]
                  : undefined;
                const flowHasContinued = !!ev && !!nextEvent;
                return (
                  <li key={s.step} className="flex flex-col items-stretch">
                    <button
                      data-testid={`button-step-${s.step}`}
                      aria-expanded={isOpen}
                      aria-label={`${s.label}. ${m.text}${ev?.durationMs != null ? `, ${fmtMs(ev.durationMs)}` : ""}. ${isOpen ? "Hide" : "Show"} step details`}
                      onClick={() => setOpen(isOpen ? null : s.step)}
                      className={`group flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-secondary-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${st === "running" ? "border-primary/40" : st === "failed" ? "border-destructive/40" : ""}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${m.surface}`}>
                        <Icon className={`h-4 w-4 ${m.cls} ${st === "running" || st === "retrying" ? "animate-spin" : ""}`} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-tight">{ev?.label || s.label}</span>
                        <span className={`mt-1 block font-mono text-[11px] ${m.cls}`}>
                          {m.text}{ev && ev.attempt > 1 ? ` · attempt ${ev.attempt}` : ""}
                          {evDetails?.model ? ` · ${evDetails.model}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {settings.showAiCosts && evDetails?.costUsd != null && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-1 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                            {fmtCost(evDetails.costUsd)}
                          </span>
                        )}
                        {ev?.durationMs != null && (
                          <span className="rounded bg-muted px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                            {fmtMs(ev.durationMs)}
                          </span>
                        )}
                        {stepDeltaMs !== null && (
                          <span className={`rounded px-1.5 py-1 font-mono text-[10px] font-medium ${stepDeltaMs <= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                            {stepDeltaMs <= 0 ? `-${fmtMs(Math.abs(stepDeltaMs))}` : `+${fmtMs(stepDeltaMs)}`}
                          </span>
                        )}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {isOpen && (
                      <div className="ml-12 mt-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-xs">
                        <p className="leading-relaxed text-muted-foreground">{s.what}</p>
                        {evs ? evs.map((e) => {
                          const d = (e as RunEvent & { details?: StepDetails | null }).details;
                          return (
                            <div key={e.id} className="mt-2 space-y-2">
                              <div>
                                <p className={e.status === "failed" ? "text-destructive" : ""}>{e.summary || "No summary recorded."}</p>
                                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                  attempt {e.attempt} · started {time(e.startedAt)} · ended {time(e.endedAt)}
                                  {e.durationMs != null ? ` · ${fmtMs(e.durationMs)}` : ""}
                                  {d?.costUsd != null ? ` · ${fmtCost(d.costUsd)} (${d.inputTokens ?? 0} in / ${d.outputTokens ?? 0} out)` : ""}
                                </p>
                              </div>
                              {(d?.received !== undefined || d?.sent !== undefined) && (
                                <div className="grid grid-cols-1 gap-2 pt-1">
                                  {d?.received !== undefined && (
                                    <div>
                                      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data received</p>
                                      <pre className="max-h-36 overflow-auto rounded bg-card p-2 font-mono text-[11px] leading-4 text-foreground border border-border">
                                        {JSON.stringify(d.received, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {d?.sent !== undefined && (
                                    <div>
                                      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data sent</p>
                                      <pre className="max-h-36 overflow-auto rounded bg-card p-2 font-mono text-[11px] leading-4 text-foreground border border-border">
                                        {JSON.stringify(d.sent, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }) : <p className="mt-2 text-muted-foreground">Waiting for a real request to reach this step.</p>}
                      </div>
                    )}
                    {index < TRACE_STEPS.length - 1 && (
                      <div aria-hidden="true" className={`flex h-7 items-center justify-center ${flowHasContinued ? "text-chart-4" : "text-border"}`}>
                        <span className={`h-4 w-0.5 ${flowHasContinued ? "bg-chart-4" : "bg-border"}`} />
                        <ArrowDown className="-ml-[5px] h-3.5 w-3.5 shrink-0" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
        </>
      </div>
    </section>
  );
}
