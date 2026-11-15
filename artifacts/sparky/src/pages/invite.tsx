import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { useAcceptWorkspaceInvite, getListProjectsQueryKey, getListWorkspacesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Loader2, Users, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { errMsg } from "@/lib/sparky";
import { trackEvent } from "@/lib/analytics";

export default function InvitePage({ token }: { token: string }) {
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const acceptInvite = useAcceptWorkspaceInvite();
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const attemptedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || attemptedToken.current === token) return;
    attemptedToken.current = token;
    acceptInvite.mutateAsync({ data: { token } }).then(async () => {
      trackEvent("invite_accepted");
      if (sessionStorage.getItem("sparky.pendingInvite") === token) {
        sessionStorage.removeItem("sparky.pendingInvite");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
      ]);
      setLocation("/user-portal");
    }).catch(err => {
      setError(errMsg(err));
    });
  }, [acceptInvite.mutateAsync, isLoaded, isSignedIn, queryClient, retry, setLocation, token]);

  function continueToAuth(path: string) {
    sessionStorage.setItem("sparky.pendingInvite", token);
    setLocation(path);
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top_left,hsl(var(--secondary)/.7),transparent_34rem)] px-4 py-10">
      <section className="surface-shadow w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 sm:p-10">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Building2 className="h-6 w-6" aria-hidden />
        </div>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[.2em] text-primary">A Sparky workspace invite</p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Learn better, together.</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
          You’ve been invited to a shared team workspace. Projects you create there are visible to its members; your personal workspace remains private.
        </p>

        {!isLoaded ? (
          <div className="mt-8 flex animate-pulse items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground" role="status" data-testid="status-auth-loading">
            <span className="h-8 w-8 rounded-lg bg-muted" aria-hidden />
            <span className="h-3 w-40 rounded-full bg-muted" aria-hidden />
            <span className="sr-only">Checking your account…</span>
          </div>
        ) : isSignedIn ? (
          error ? (
            <div className="mt-7 space-y-3">
              <p role="alert" data-testid="text-invite-error" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
              <button
                type="button"
                data-testid="button-retry-invite"
                onClick={() => {
                  attemptedToken.current = null;
                  setError(null);
                  setRetry(value => value + 1);
                }}
                aria-label="Retry accepting this team invitation"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Try again <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="mt-8 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground" role="status" data-testid="text-accepting-invite">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> <span>Adding this team to your workspace list…</span>
            </div>
          )
        ) : (
          <div className="mt-8 space-y-5">
            <div className="grid gap-3 rounded-xl border border-border/80 bg-background/70 p-4 sm:grid-cols-2">
              <p className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                Work together on projects shared with this team.
              </p>
              <p className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                You can keep personal work separate.
              </p>
            </div>
            <p className="text-sm font-medium">Sign in or create an account to accept the invite.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                data-testid="button-invite-sign-in"
                onClick={() => continueToAuth("/sign-in")}
                aria-label="Sign in to accept this team invitation"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Sign in <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                data-testid="button-invite-sign-up"
                onClick={() => continueToAuth("/sign-up")}
                aria-label="Create an account to accept this team invitation"
                className="flex-1 rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Create an account
              </button>
            </div>
            <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden /> Invite links can be used once and expire after seven days.</p>
          </div>
        )}
      </section>
    </main>
  );
}
