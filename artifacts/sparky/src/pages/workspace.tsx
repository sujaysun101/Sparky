import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkspace,
  getGetWorkspaceQueryKey,
  getListProjectsQueryKey,
  useSaveDraft,
  useUpdateTask,
  useStartRun,
  useGetRun,
  getGetRunQueryKey,
  useRetryRun,
  useAcknowledgeRun,
  type Run,
  type RunInputMode,
  type Workspace,
  type Task,
} from "@workspace/api-client-react";
import { ArrowLeft, Check, CloudOff, Loader2, RotateCw, Activity, ListChecks, Code2, MessageSquare, AlertTriangle, BookOpen, Circle, Undo2, Braces } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEditor } from "@/components/code-editor";
import { TutorPanel } from "@/components/tutor-panel";
import { TracePanel } from "@/components/trace-panel";
import { Logo } from "@/pages/home";
import { errMsg, newKey, readBackup, writeBackup } from "@/lib/sparky";

type Tab = "plan" | "code" | "tutor" | "how";
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "failed";
const TERMINAL = ["completed", "failed", "interrupted"];

export default function WorkspacePage({ projectIdOverride }: { projectIdOverride?: string } = {}) {
  const params = useParams<{ id: string }>();
  const projectId = projectIdOverride ?? params.id ?? "";
  const qc = useQueryClient();
  const wsKey = getGetWorkspaceQueryKey(projectId);
  const ws = useGetWorkspace(projectId, { query: { enabled: !!projectId, queryKey: wsKey } });
  const saveDraft = useSaveDraft();
  const updateTask = useUpdateTask();
  const startRun = useStartRun();
  const retryRun = useRetryRun();
  const ackRun = useAcknowledgeRun();

  const [tab, setTab] = useState<Tab>("code");

  /* ---------- draft + autosave ---------- */
  const [code, setCode] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [aiUndoAvailable, setAiUndoAvailable] = useState(false);
  const aiUndo = useRef<{ before: string; after: string } | null>(null);
  const [editorNotice, setEditorNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [simSave, setSimSave] = useState(false);
  const [restored, setRestored] = useState(false);
  const [localBackup, setLocalBackup] = useState(true);
  const simSaveRef = useRef(false);
  simSaveRef.current = simSave;
  const initFor = useRef<string | null>(null);
  const latest = useRef({ code: "", question: "" });
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);
  const saveFn = useRef(saveDraft.mutateAsync);
  const saving = useRef(false);
  saveFn.current = saveDraft.mutateAsync;

  const doSave = useCallback(async () => {
    window.clearTimeout(timer.current);
    // Serialize saves so an older slow write cannot overwrite a newer draft.
    if (saving.current) {
      timer.current = window.setTimeout(() => void doSave(), 400);
      return;
    }
    saving.current = true;
    const snap = { ...latest.current };
    const my = ++seq.current;
    setSaveState("saving");
    try {
      const d = await saveFn.current({ projectId, data: { ...snap, simulateSaveFailure: simSaveRef.current || undefined } });
      if (my !== seq.current) return;
      const clean = latest.current.code === snap.code && latest.current.question === snap.question;
      setLocalBackup(writeBackup(projectId, { ...latest.current, dirty: !clean, at: Date.now() }));
      setSaveState(clean ? "saved" : "unsaved");
      setSaveError(null);
      setSavedAt(d.updatedAt);
      qc.setQueryData<Workspace>(getGetWorkspaceQueryKey(projectId), (old) => (old ? { ...old, draft: d } : old));
    } catch (e) {
      if (my !== seq.current) return;
      setSaveState("failed");
      setSaveError(errMsg(e));
    } finally {
      saving.current = false;
    }
  }, [projectId, qc]);

  const schedule = useCallback(
    (next: { code: string; question: string }) => {
      latest.current = next;
      setLocalBackup(writeBackup(projectId, { ...next, dirty: true, at: Date.now() }));
      setSaveState("unsaved");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void doSave(), 900);
    },
    [projectId, doSave],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const data = ws.data;
    if (!data || initFor.current === projectId) return;
    initFor.current = projectId;
    const b = readBackup(projectId);
    if (b?.dirty && (b.code !== data.draft.code || b.question !== data.draft.question)) {
      setCode(b.code);
      setQuestion(b.question);
      setRestored(true);
      schedule({ code: b.code, question: b.question });
    } else {
      setCode(data.draft.code);
      setQuestion(data.draft.question);
      latest.current = { code: data.draft.code, question: data.draft.question };
      setSavedAt(data.draft.updatedAt);
      setSaveState("saved");
    }
  }, [ws.data, projectId, schedule]);

  const onCode = (v: string) => {
    aiUndo.current = null;
    setAiUndoAvailable(false);
    setCode(v);
    schedule({ code: v, question: latest.current.question });
  };
  const applyCodeExample = (example: string, action: "insert" | "replace") => {
    const before = latest.current.code;
    const at = Math.max(0, Math.min(cursorPosition, before.length));
    const next = action === "replace"
      ? example
      : `${before.slice(0, at)}${example}${before.slice(at)}`;
    aiUndo.current = { before, after: next };
    setAiUndoAvailable(true);
    setEditorNotice(action === "replace" ? "AI suggestion replaced the draft." : "AI suggestion inserted at the cursor.");
    setCode(next);
    const nextCursor = action === "replace" ? example.length : at + example.length;
    setCursorPosition(nextCursor);
    schedule({ code: next, question: latest.current.question });
  };
  const undoAiEdit = () => {
    const snapshot = aiUndo.current;
    if (!snapshot || latest.current.code !== snapshot.after) return;
    aiUndo.current = null;
    setAiUndoAvailable(false);
    setCode(snapshot.before);
    setCursorPosition(snapshot.before.length);
    setEditorNotice("Last AI edit undone. Your earlier draft is restored.");
    schedule({ code: snapshot.before, question: latest.current.question });
  };
  const onQuestion = (v: string) => { setQuestion(v); schedule({ code: latest.current.code, question: v }); };

  /* ---------- tasks ---------- */
  const allTasks = useMemo(() => ws.data?.milestones.flatMap((m) => m.tasks) ?? [], [ws.data]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const currentTask: Task | undefined = allTasks.find((t) => t.id === taskId) ?? allTasks.find((t) => !t.completed) ?? allTasks[0];
  const [taskError, setTaskError] = useState<string | null>(null);

  async function toggleTask(t: Task) {
    setTaskError(null);
    try {
      await updateTask.mutateAsync({ projectId, taskId: t.id, data: { completed: !t.completed } });
      await qc.invalidateQueries({ queryKey: wsKey });
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    } catch (e) {
      setTaskError(errMsg(e));
    }
  }

  /* ---------- runs ---------- */
  const runs = useMemo(() => [...(ws.data?.runs ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [ws.data]);
  const [selRun, setSelRun] = useState<string | null>(null);
  const runId = selRun ?? runs[0]?.id ?? null;
  const runQ = useGetRun(runId ?? "", {
    query: {
      enabled: !!runId,
      queryKey: getGetRunQueryKey(runId ?? ""),
      refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status) ? false : 3000),
    },
  });
  const run = runQ.data;
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!runId) return;
    if (run && TERMINAL.includes(run.status)) return;
    const es = new EventSource(`/api/runs/${runId}/events`, { withCredentials: true });
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false); // browser reconnects; polling covers the gap
    es.addEventListener("run", (ev) => {
      try {
        const r = JSON.parse((ev as MessageEvent).data) as Run;
        qc.setQueryData(getGetRunQueryKey(r.id), r);
        if (TERMINAL.includes(r.status)) { es.close(); setLive(false); }
      } catch {
        /* ignore malformed snapshot */
      }
    });
    return () => { es.close(); setLive(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, run?.status, qc]);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedRunId, setFailedRunId] = useState<string | null>(null);
  const [simAi, setSimAi] = useState(false);
  const [mode, setMode] = useState<RunInputMode>("hint");
  const lastSend = useRef<{ key: string; question: string; code: string; simulated: boolean; mode: RunInputMode; taskId?: string; runId?: string; clear: boolean } | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!run || !TERMINAL.includes(run.status)) return;
    const tag = `${run.id}:${run.attempt}:${run.status}`;
    if (handled.current.has(tag)) return;
    handled.current.add(tag);
    qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey(projectId) });
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    if (lastSend.current?.runId === run.id) {
      setSending(false);
      if (run.status === "completed") {
        if (lastSend.current.clear && latest.current.question === lastSend.current.question) { setQuestion(""); schedule({ code: latest.current.code, question: "" }); }
        lastSend.current = null;
        setSendError(null);
        setFailedRunId(null);
      } else {
        setSendError(`Tutor run ${run.status}: ${run.error ?? "no details"}.`);
        setFailedRunId(run.id);
      }
    }
  }, [run, projectId, qc, schedule]);

  const acked = useRef(new Set<string>());
  const ackFn = useRef(ackRun.mutateAsync);
  ackFn.current = ackRun.mutateAsync;
  const runsRef = useRef(runs);
  runsRef.current = runs;
  const onRendered = useCallback((ids: string[]) => {
    for (const id of ids) {
      if (acked.current.has(id)) continue;
      const cached = qc.getQueryData<Run>(getGetRunQueryKey(id)) ?? runsRef.current.find((r) => r.id === id);
      if (!cached || cached.status !== "completed") continue;
      if (cached.events.some((e) => e.step === "display" && e.status === "completed")) continue;
      acked.current.add(id);
      ackFn.current({ runId: id })
        .then((r) => qc.setQueryData(getGetRunQueryKey(r.id), r))
        .catch(() => acked.current.delete(id));
    }
  }, [qc]);

  async function retry(id: string) {
    setSendError(null);
    try {
      const r = await retryRun.mutateAsync({ runId: id });
      qc.setQueryData(getGetRunQueryKey(r.id), r);
      setSelRun(r.id);
      if (lastSend.current?.runId === r.id) setSending(true);
      setFailedRunId(null);
    } catch (e) {
      setSendError(errMsg(e));
    }
  }

  async function send(q: string, m: RunInputMode, clear: boolean) {
    if (sending || !q.trim()) return;
    const prev = lastSend.current;
    const same = prev && prev.question === q && prev.code === latest.current.code && prev.simulated === simAi && prev.mode === m && prev.taskId === currentTask?.id;
    if (same && prev.runId) return retry(prev.runId);
    const key = same ? prev.key : newKey();
    lastSend.current = { key, question: q, code: latest.current.code, simulated: simAi, mode: m, taskId: currentTask?.id, clear };
    setSending(true);
    setSendError(null);
    setFailedRunId(null);
    try {
      const r = await startRun.mutateAsync({
        projectId,
        data: { question: q, code: latest.current.code, mode: m, taskId: currentTask?.id, idempotencyKey: key, simulateFailure: simAi || undefined },
      });
      lastSend.current.runId = r.id;
      qc.setQueryData(getGetRunQueryKey(r.id), r);
      setSelRun(r.id);
      qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey(projectId) });
    } catch (e) {
      setSending(false);
      setSendError(`Couldn't reach the tutor: ${errMsg(e)}.`);
    }
  }

  function explainConcept(name: string, why: string) {
    setTab("tutor");
    void send(`Explain the concept "${name}" for my current task "${currentTask?.title ?? ""}". Context: ${why}`, "explain", false);
  }

  /* ---------- views ---------- */
  if (ws.isLoading) return <WorkspaceSkeleton />;
  if (ws.isError || !ws.data) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6 grid-paper">
        <div role="alert" className="max-w-sm rounded-xl border border-card-border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
          <h1 className="font-display mt-2 text-xl font-bold">Couldn't open this project</h1>
          <p className="mt-1 text-sm text-muted-foreground">{errMsg(ws.error)}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button data-testid="button-retry-workspace" onClick={() => ws.refetch()} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"><RotateCw className="h-4 w-4" aria-hidden /> Retry</button>
            <Link href="/" className="rounded-md border border-border px-3 py-1.5 text-sm">All projects</Link>
          </div>
        </div>
      </div>
    );
  }

  const { project, milestones, messages } = ws.data;
  const done = allTasks.filter((t) => t.completed).length;
  const pairedMobile = tab === "code" || tab === "tutor";
  const show = (t: Tab) => ((tab === t || ((t === "code" || t === "tutor") && pairedMobile)) ? "flex" : "hidden") + " lg:flex";
  const runActive = run?.status === "running";

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/" aria-label="Back to projects" data-testid="link-back" className="rounded p-1 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="hidden sm:block"><Logo /></div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-medium" data-testid="text-project-title">{project.title}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{project.language} · {project.level} · {project.planSource === "curated" ? "curated plan" : "AI plan · may need verification"}</p>
        </div>
        <button
          data-testid="button-how-it-works"
          onClick={() => { setTab("how"); document.getElementById("how")?.scrollIntoView({ block: "nearest" }); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-secondary-foreground/25 bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground"
        >
          {runActive ? <span className="pulse-dot h-2 w-2 rounded-full bg-primary" aria-hidden /> : <Activity className="h-3.5 w-3.5" aria-hidden />}
          How it works{runActive ? " (live)" : ""}
        </button>
      </header>

      <nav aria-label="Workspace sections" className="grid grid-cols-3 border-b border-border bg-card lg:hidden" role="tablist">
        {([["plan", "Plan", ListChecks], ["code", "Pair", Code2], ["how", "How", Activity]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={id === "code" ? pairedMobile : tab === id} data-testid={`tab-${id}`} onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1 py-2.5 text-xs font-medium ${tab === id ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 overflow-y-auto lg:auto-rows-fr lg:overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_390px]">
        {/* plan */}
        <aside aria-label="Milestones" className={`${show("plan")} min-h-[calc(100dvh-7rem)] flex-col border-r border-border bg-sidebar lg:min-h-0`}>
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-base font-bold">Milestones</h2>
              <span className="font-mono text-[11px] text-muted-foreground">{done}/{allTasks.length}</span>
            </div>
            <div className="mt-2 h-1 rounded bg-muted"><div className="h-1 rounded bg-primary transition-transform" style={{ width: `${allTasks.length ? (done / allTasks.length) * 100 : 0}%` }} /></div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {taskError && <p role="alert" className="m-2 rounded bg-destructive/10 p-2 text-xs text-destructive">{taskError}</p>}
            {milestones.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No milestones in this plan.</p> : milestones.map((m, mi) => (
              <div key={m.id} className="mb-3">
                <p className="px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{String(mi + 1).padStart(2, "0")} · {m.title}</p>
                <ul>
                  {m.tasks.map((t) => {
                    const cur = currentTask?.id === t.id;
                    return (
                      <li key={t.id} className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${cur ? "bg-card shadow-sm ring-1 ring-primary/30" : ""}`}>
                        <button aria-label={`Mark "${t.title}" as ${t.completed ? "not done" : "done"}`} data-testid={`checkbox-task-${t.id}`} onClick={() => toggleTask(t)} disabled={updateTask.isPending}
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${t.completed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"}`}>
                          {t.completed && <Check className="h-3 w-3" aria-hidden />}
                        </button>
                        <button data-testid={`button-task-${t.id}`} aria-current={cur ? "step" : undefined} onClick={() => { setTaskId(t.id); setTab("code"); }}
                          className={`text-left text-sm ${t.completed ? "text-muted-foreground line-through" : ""}`}>{t.title}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* center */}
        <div className={`${pairedMobile || tab === "how" ? "flex" : "hidden"} min-h-[55dvh] flex-col lg:min-h-0 lg:flex`}>
          <div className={`${show("code")} min-h-[55dvh] flex-1 flex-col lg:min-h-0`}>
            {currentTask && (
              <div className="border-b border-border bg-card px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-primary">Current task</p>
                <h2 className="font-display text-lg font-bold" data-testid="text-current-task">{currentTask.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{currentTask.description}</p>
                {currentTask.concepts.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Concepts in this task">
                    {currentTask.concepts.map((c) => (
                      <li key={c.name} className="max-w-xs">
                        <button data-testid={`button-concept-${c.name}`} onClick={() => explainConcept(c.name, c.why)} disabled={sending} title={c.why}
                          className="group inline-flex items-center gap-1 rounded border border-secondary-foreground/20 bg-secondary px-2 py-0.5 text-xs text-secondary-foreground hover:-translate-y-px transition-transform disabled:opacity-50">
                          <BookOpen className="h-3 w-3" aria-hidden /> {c.name} <span className="text-[10px] opacity-60">explain</span>
                        </button>
                        <p className="mt-1 text-xs text-muted-foreground">{c.why}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-[hsl(222_20%_18%)] px-4 py-1.5 font-mono text-[11px] text-white/60">
              <span className="inline-flex items-center gap-1.5"><Braces className="h-3 w-3 text-[hsl(14_78%_65%)]" aria-hidden />{project.language.toLowerCase()} · not executed</span>
              {aiUndoAvailable && <button type="button" data-testid="button-undo-ai-edit" onClick={undoAiEdit} className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[11px] text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Undo2 className="h-3 w-3" aria-hidden /> Undo AI edit</button>}
              <span role="status" aria-live="polite" data-testid="status-editor-ai-edit" className="sr-only">{editorNotice}</span>
              <SaveBadge state={saveState} savedAt={savedAt} error={saveError} onRetry={() => void doSave()} localBackup={localBackup} />
              {restored && <span className="text-[hsl(42_80%_65%)]">restored unsaved backup</span>}
              <label className="ml-auto flex items-center gap-1.5">
                <input type="checkbox" data-testid="checkbox-simulate-save-failure" checked={simSave} onChange={(e) => setSimSave(e.target.checked)} />
                Simulate save failure
              </label>
            </div>
            <CodeEditor value={code} onChange={onCode} language={project.language} cursorPosition={cursorPosition} onCursorChange={setCursorPosition} />
          </div>
          <div className={`${show("how")} min-h-[55dvh] flex-col border-t border-border bg-card lg:h-[38%] lg:min-h-0 lg:flex-none lg:flex-1`}>
            <TracePanel run={run} runs={runs} selectedId={runId} onSelect={setSelRun} onRetry={(id) => void retry(id)} retrying={retryRun.isPending} live={live} busy={sending} />
          </div>
        </div>

        {/* tutor */}
        <div className={`${show("tutor")} min-h-[55dvh] flex-col border-l border-border bg-background lg:min-h-0`}>
          <TutorPanel
            messages={messages}
            question={question}
            onQuestion={onQuestion}
            mode={mode}
            onMode={setMode}
            onSend={() => void send(question, mode, true)}
            sending={sending}
            simulateFailure={simAi}
            onSimulateFailure={setSimAi}
            sendError={sendError}
            failedRunId={failedRunId}
            onRetry={() => failedRunId && void retry(failedRunId)}
            onRendered={onRendered}
            currentTaskTitle={currentTask?.title}
            draftLength={code.length}
            onApplyCode={applyCodeExample}
          />
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state, savedAt, error, onRetry, localBackup }: { state: SaveState; savedAt: string | null; error: string | null; onRetry: () => void; localBackup: boolean }) {
  return (
    <span role="status" data-testid="status-save" className="flex items-center gap-1.5">
      {state === "saving" && <><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…</>}
      {state === "unsaved" && <><Circle className="h-2 w-2 fill-current" aria-hidden /> {localBackup ? "Backed up locally" : "Unsaved — browser backup unavailable; keep this tab open"}</>}
      {state === "saved" && <><Check className="h-3 w-3 text-[hsl(150_45%_60%)]" aria-hidden /> Saved{savedAt ? ` ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</>}
      {state === "failed" && (
        <span className="flex items-center gap-1.5 text-[hsl(356_80%_70%)]">
          <CloudOff className="h-3 w-3" aria-hidden /> Save failed{error ? `: ${error}` : ""} ({localBackup ? "kept locally" : "browser backup unavailable; keep this tab open"})
          <button data-testid="button-retry-save" onClick={onRetry} className="underline">Retry save</button>
        </span>
      )}
    </span>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col" aria-busy="true" aria-label="Loading workspace">
      <div className="h-14 border-b border-border bg-card" />
      <div className="grid flex-1 gap-0 lg:grid-cols-[290px_1fr_400px]">
        <div className="hidden space-y-2 border-r border-border p-4 lg:block">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
        <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-[50vh] bg-[hsl(222_22%_14%/0.15)]" /></div>
        <div className="hidden space-y-3 border-l border-border p-4 lg:block"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      </div>
    </div>
  );
}
