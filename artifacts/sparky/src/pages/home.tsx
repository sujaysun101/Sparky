import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  getListProjectsQueryKey,
  useCreateProject,
  useListWorkspaces,
  getListWorkspacesQueryKey,
  ProjectInputLanguage,
  ProjectInputLevel,
} from "@workspace/api-client-react";
import { UserButton } from "@clerk/react";
import { ArrowRight, Sparkles, Receipt, AlertTriangle, RotateCw, FolderOpen, Loader2, LogIn, UserPlus, ShieldCheck, BookOpen, Users, LockKeyhole, Clock3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectWorkspaceMove, WorkspaceControls } from "@/components/workspace-controls";
import { SettingsControls } from "@/components/settings-modal";
import { errMsg } from "@/lib/sparky";

const SAMPLE_IDEA =
  "An expense tracker where I can add expenses with an amount, category and date, see a running total, and filter by category.";

export default function Home({ accountMode = false }: { accountMode?: boolean }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const projects = useListProjects();
  const workspaceQuery = useListWorkspaces({
    query: { enabled: accountMode, queryKey: getListWorkspacesQueryKey() },
  });
  const create = useCreateProject();
  const [idea, setIdea] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [language, setLanguage] = useState<ProjectInputLanguage>("JavaScript");
  const [level, setLevel] = useState<ProjectInputLevel>("beginner");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<"sample" | "custom" | null>(null);

  async function submit(sample: boolean) {
    setFormError(null);
    const text = sample ? SAMPLE_IDEA : idea.trim();
    if (!sample && text.length < 5) {
      setFormError("Describe your idea in at least a few words.");
      return;
    }
    setPendingKind(sample ? "sample" : "custom");
    try {
      const ws = await create.mutateAsync({
        data: { idea: text, language, level, sample, ...(accountMode && selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {}) },
      });
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setLocation(`/projects/${ws.project.id}`);
    } catch (e) {
      setFormError(errMsg(e));
    } finally {
      setPendingKind(null);
    }
  }

  const fieldCls =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="min-h-[100dvh] grid-paper">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2.5">
          <SettingsControls />
          {accountMode ? (
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
                Private by default
              </span>
              <UserButton />
            </div>
          ) : (
            <nav aria-label="Account" className="flex items-center gap-2">
              <Link href="/sign-in" data-testid="link-sign-in" className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card">
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </Link>
              <Link href="/sign-up" data-testid="link-sign-up" className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                <UserPlus className="h-4 w-4" aria-hidden /> Get started
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:gap-16">
        <section className="rise">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> A better way to learn by making
          </div>
          <h1 className="font-display max-w-xl text-[3.35rem] font-bold leading-[.92] sm:text-7xl">
            Make something.
            <br />
            <span className="text-primary">Know how it works.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            Turn a real idea into a small coding project. Learn the concepts as you go, one useful step at a time.
          </p>
          {!accountMode && (
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={create.isPending}
              data-testid="link-continue-guest"
              className="focus-ring mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_24px_-14px_hsl(var(--primary))] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {pendingKind === "sample" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting guest project...
                </>
              ) : (
                <>
                  Try a project as a guest <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          )}
          <ol className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["01", "Start with an idea", "A sentence is enough to begin."],
              ["02", "Build in small steps", "Each task teaches a useful concept."],
              ["03", "See the thinking", "Ask for a hint, then inspect how it works."],
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-3 border-l border-primary/30 pl-4">
                <span className="font-mono text-[11px] font-medium text-primary pt-1">{n}</span>
                <div>
                  <p className="text-sm font-semibold">{t}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          {!accountMode && (
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5 text-secondary-foreground" aria-hidden /> Guest work stays in this browser</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-secondary-foreground" aria-hidden /> Teams are private until invited</span>
            </div>
          )}
        </section>

        <section id="start-guest" className="rise surface-shadow rounded-2xl border border-card-border/90 bg-card p-5 sm:p-7" style={{ animationDelay: "80ms" }} aria-labelledby="project-form-title">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[.18em] text-primary">{accountMode ? "Your learning desk" : "No setup needed"}</p>
              <h2 id="project-form-title" className="font-display mt-1 text-2xl font-bold sm:text-[1.8rem]">Start a project</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {accountMode ? "Your work will be saved to your account." : "Continue as a guest, or sign in to move this browser’s guest projects into your account."}
              </p>
            </div>
            {!accountMode && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><ShieldCheck className="h-5 w-5" aria-hidden /></div>}
          </div>
          {accountMode && (
            <>
              <WorkspaceControls
                workspaces={workspaceQuery.data ?? []}
                selectedWorkspaceId={selectedWorkspaceId}
                onSelect={setSelectedWorkspaceId}
                loading={workspaceQuery.isLoading}
              />
              {workspaceQuery.isError && <div role="alert" data-testid="text-workspaces-error" className="mt-3 flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <span>Couldn’t load your workspaces.</span>
                <button type="button" data-testid="button-retry-workspaces" onClick={() => workspaceQuery.refetch()} className="inline-flex items-center gap-1 font-semibold"><RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry</button>
              </div>}
            </>
          )}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="language" className="mb-1 block text-xs font-medium text-muted-foreground">Language</label>
              <select id="language" data-testid="select-language" className={fieldCls} value={language} onChange={(e) => setLanguage(e.target.value as ProjectInputLanguage)}>
                {Object.values(ProjectInputLanguage).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="level" className="mb-1 block text-xs font-medium text-muted-foreground">Your level</label>
              <select id="level" data-testid="select-level" className={fieldCls} value={level} onChange={(e) => setLevel(e.target.value as ProjectInputLevel)}>
                {Object.values(ProjectInputLevel).map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <button
            type="button"
            data-testid="button-sample"
            onClick={() => submit(true)}
            disabled={create.isPending}
            aria-label="Create the sample expense tracker project"
            className="group mt-5 flex w-full items-center gap-4 rounded-xl border border-secondary-foreground/15 bg-secondary/80 p-4 text-left transition-transform hover:-translate-y-0.5 hover:bg-secondary disabled:opacity-60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-md bg-card text-secondary-foreground"><Receipt className="h-5 w-5" aria-hidden /></span>
            <span className="flex-1">
              <span className="block font-semibold text-secondary-foreground">Try the expense tracker</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">A guided example, ready to explore</span>
            </span>
            {pendingKind === "sample" ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Creating" /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" />or make your own<span className="h-px flex-1 bg-border" /></div>

          <label htmlFor="idea" className="mb-1 block text-xs font-medium text-muted-foreground">What do you want to build?</label>
          <textarea id="idea" data-testid="input-idea" aria-label="Describe the project you want to build" rows={4} maxLength={2000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="A habit tracker that shows my streak and celebrates small wins..." className={fieldCls + " resize-none rounded-lg"} />
          <button
            type="button"
            data-testid="button-create"
            onClick={() => submit(false)}
            disabled={create.isPending}
            aria-label="Plan your project with AI"
            className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pendingKind === "custom" ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Planning with AI…</> : <><Sparkles className="h-4 w-4" aria-hidden /> Plan it with AI</>}
          </button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden /> Custom plans are generated live and may take a moment.</p>
          {formError && (
            <p role="alert" data-testid="text-create-error" className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {formError}
            </p>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="saved">
          <div className="flex items-end justify-between gap-4 border-b border-border/70 pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Keep your momentum</p>
              <h2 id="saved" className="font-display mt-1 text-2xl font-bold sm:text-3xl">{accountMode ? "Your projects" : "Recent projects"}</h2>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">{projects.data?.length ? `${projects.data.length} saved ${projects.data.length === 1 ? "project" : "projects"}` : "Your next idea starts above"}</span>
          </div>
          <div className="mt-4">
            {projects.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : projects.isError ? (
              <div role="alert" data-testid="text-projects-error" className="mt-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-card p-4 text-sm">
                <span className="text-destructive">Couldn't load projects: {errMsg(projects.error)}</span>
                <button data-testid="button-retry-projects" onClick={() => projects.refetch()} className="inline-flex items-center gap-1 font-medium"><RotateCw className="h-4 w-4" aria-hidden /> Retry</button>
              </div>
            ) : !projects.data?.length ? (
              <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:p-8" data-testid="empty-projects">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><FolderOpen className="h-6 w-6" aria-hidden /></div>
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">A blank page is a good place to begin.</p>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    {accountMode ? "Start a project above and it will be saved to your account." : "Guest projects stay in this browser. Create an account whenever you’re ready to keep learning across devices."}
                  </p>
                  {!accountMode && <Link href="/sign-up" data-testid="link-empty-sign-up" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4">Create a free account <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>}
                </div>
              </div>
            ) : (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {projects.data.map((p) => {
                  const pct = p.totalTasks ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0;
                  return (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} data-testid={`link-project-${p.id}`} className="focus-ring group block h-full rounded-xl border border-card-border/90 bg-card p-5 transition-transform hover:-translate-y-1 hover:shadow-[0_16px_36px_-28px_hsl(218_28%_20%/.4)]">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-display text-lg font-semibold leading-tight group-hover:text-primary">{p.title}</p>
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{p.planSource === "curated" ? "GUIDED" : "AI PLAN"}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{p.idea}</p>
                        <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          <span>{p.language}</span><span>{p.level}</span>
                          <span className="ml-auto">{p.completedTasks}/{p.totalTasks} steps</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Project progress, ${pct}% complete`}>
                          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                      {accountMode && (
                        <div className="px-1">
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {p.workspaceKind === "team" ? <Users className="h-3.5 w-3.5 text-secondary-foreground" aria-hidden /> : <LockKeyhole className="h-3.5 w-3.5 text-secondary-foreground" aria-hidden />}
                            {p.workspaceName ?? "Guest browser"}{p.workspaceKind === "team" ? " · shared team" : ""}
                          </p>
                          <ProjectWorkspaceMove project={p} workspaces={workspaceQuery.data ?? []} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export function Logo() {
  return (
    <Link href="/" data-testid="link-home" className="flex items-center gap-2 font-display text-xl font-bold">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="hsl(var(--primary))" /></svg>
      Sparky
    </Link>
  );
}
