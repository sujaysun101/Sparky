import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateWorkspace,
  useCreateWorkspaceInvite,
  useListWorkspaceInvites,
  useListWorkspaceMembers,
  useMoveProjectToWorkspace,
  useRemoveWorkspaceMember,
  useRevokeWorkspaceInvite,
  getListProjectsQueryKey,
  getListWorkspaceInvitesQueryKey,
  getListWorkspaceMembersQueryKey,
  getListWorkspacesQueryKey,
  type OwnerWorkspace,
  type Project,
} from "@workspace/api-client-react";
import { ArrowRightLeft, Ban, Building2, Check, Copy, Loader2, Plus, Send, UserMinus } from "lucide-react";
import { errMsg } from "@/lib/sparky";
import { trackEvent } from "@/lib/analytics";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type WorkspaceControlsProps = {
  workspaces: OwnerWorkspace[];
  selectedWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
  loading: boolean;
};

export function WorkspaceControls({ workspaces, selectedWorkspaceId, onSelect, loading }: WorkspaceControlsProps) {
  const queryClient = useQueryClient();
  const createWorkspace = useCreateWorkspace();
  const createInvite = useCreateWorkspaceInvite();
  const teamForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const [error, setError] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, { url: string; expiresAt: string }>>({});
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const fieldCls = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  async function createTeam(values: { name: string }) {
    setError(null);
    try {
      const created = await createWorkspace.mutateAsync({ data: { name: values.name.trim() } });
      trackEvent("team_created");
      await queryClient.invalidateQueries({ queryKey: getListWorkspacesQueryKey() });
      teamForm.reset();
      onSelect(created.id);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function makeInvite(workspace: OwnerWorkspace) {
    setError(null);
    setCopiedTeamId(null);
    try {
      const invite = await createInvite.mutateAsync({ workspaceId: workspace.id });
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const url = `${window.location.origin}${basePath}/invite/${invite.token}`;
      setInviteLinks(current => ({ ...current, [workspace.id]: { url, expiresAt: invite.expiresAt } }));
      void queryClient.invalidateQueries({ queryKey: getListWorkspaceInvitesQueryKey(workspace.id) });
      try {
        await navigator.clipboard.writeText(url);
        setCopiedTeamId(workspace.id);
      } catch {
        setError("Invite created. Copy the link shown below to share it.");
      }
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-xl border border-border/80 bg-background/75 p-3.5">
        <label htmlFor="project-workspace" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project visibility
        </label>
        <select
          id="project-workspace"
          data-testid="select-project-workspace"
          aria-label="Choose where to save the project"
          className={fieldCls}
          value={selectedWorkspaceId}
          onChange={event => onSelect(event.target.value)}
          disabled={loading}
        >
          <option value="">Personal workspace · only you</option>
          {workspaces.filter(workspace => workspace.kind === "team").map(workspace => (
            <option key={workspace.id} value={workspace.id}>{workspace.name} · shared with team</option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Choose a team only when you want collaborators to see this project.</p>
      </div>

      <details className="group rounded-xl border border-border bg-background/75 p-3.5 open:bg-card">
        <summary data-testid="summary-team-workspaces" className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold marker:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Building2 className="h-4 w-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block">Team workspaces</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Invite people to build together</span>
          </span>
          <span className="text-xs font-medium text-primary group-open:hidden">Manage</span>
          <span className="hidden text-xs font-medium text-primary group-open:inline">Close</span>
        </summary>
        <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
          <Form {...teamForm}>
            <form onSubmit={teamForm.handleSubmit(createTeam)} className="flex flex-col gap-2 sm:flex-row">
              <FormField
                control={teamForm.control}
                name="name"
                rules={{
                  required: "Enter a team name.",
                  minLength: { value: 2, message: "Use at least 2 characters." },
                  maxLength: { value: 80, message: "Keep the name under 80 characters." },
                }}
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1">
                    <FormLabel className="sr-only">New team name</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        data-testid="input-team-name"
                        className={fieldCls}
                        placeholder="Team name"
                        aria-label="New team name"
                        minLength={2}
                        maxLength={80}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button
                type="submit"
                data-testid="button-create-team"
                disabled={createWorkspace.isPending}
                aria-label="Create team workspace"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
              >
                {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Create team
              </button>
            </form>
          </Form>

          {workspaces.filter(workspace => workspace.kind === "team").length === 0 ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Create a team to share selected projects with collaborators. Your personal workspace stays private.</p>
          ) : (
            <ul className="space-y-3">
              {workspaces.filter(workspace => workspace.kind === "team").map(workspace => (
                <li key={workspace.id} className="rounded-xl border border-border/80 bg-card p-3.5" data-testid={`team-${workspace.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold">{workspace.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Shared workspace</span>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">{workspace.role}</span>
                  </div>
                  {workspace.role === "owner" && (
                    <button
                      type="button"
                      data-testid={`button-invite-${workspace.id}`}
                      disabled={createInvite.isPending}
                      onClick={() => void makeInvite(workspace)}
                      aria-label={`Create invite link for ${workspace.name}`}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                      Create single-use invite link
                    </button>
                  )}
                  {inviteLinks[workspace.id] && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium text-muted-foreground" htmlFor={`invite-link-${workspace.id}`}>
                        Invite link · expires {new Date(inviteLinks[workspace.id]!.expiresAt).toLocaleDateString()}
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`invite-link-${workspace.id}`}
                          data-testid={`input-invite-link-${workspace.id}`}
                          readOnly
                          value={inviteLinks[workspace.id]!.url}
                           aria-label={`Invite link for ${workspace.name}`}
                           className={fieldCls + " min-w-0 text-xs"}
                        />
                        <button
                          type="button"
                          data-testid={`button-copy-invite-${workspace.id}`}
                          onClick={() => {
                            void navigator.clipboard.writeText(inviteLinks[workspace.id]!.url).then(
                              () => setCopiedTeamId(workspace.id),
                              () => setError("Clipboard access is unavailable. Select and copy the invite link."),
                            );
                          }}
                           className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm transition-colors hover:bg-muted"
                           aria-label={copiedTeamId === workspace.id ? "Invite link copied" : `Copy invite link for ${workspace.name}`}
                        >
                          {copiedTeamId === workspace.id ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                          <span className="sr-only">{copiedTeamId === workspace.id ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      {copiedTeamId === workspace.id && <p role="status" data-testid={`text-invite-copied-${workspace.id}`} className="text-xs font-medium text-emerald-700">Invite link copied. Share it only with the intended teammate.</p>}
                    </div>
                  )}
                  {workspace.role === "owner" && <TeamAccessManager workspace={workspace} />}
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" data-testid="text-team-error" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">{error}</p>}
          <p className="text-xs leading-5 text-muted-foreground">Invite links can be used once and expire after seven days. Share only with the person you intend to add.</p>
        </div>
      </details>
    </div>
  );
}

function TeamAccessManager({ workspace }: { workspace: OwnerWorkspace }) {
  const queryClient = useQueryClient();
  const membersQuery = useListWorkspaceMembers(workspace.id, {
    query: { enabled: workspace.role === "owner", staleTime: 30_000, refetchOnMount: "always" },
  });
  const invitesQuery = useListWorkspaceInvites(workspace.id, {
    query: { enabled: workspace.role === "owner", staleTime: 30_000, refetchOnMount: "always" },
  });
  const removeMember = useRemoveWorkspaceMember();
  const revokeInvite = useRevokeWorkspaceInvite();
  const [error, setError] = useState<string | null>(null);

  async function remove(userId: string) {
    const confirmed = window.confirm(
      `Remove ${userId} from ${workspace.name}? They will immediately lose access to this team's projects.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await removeMember.mutateAsync({ workspaceId: workspace.id, memberId: userId });
      await queryClient.invalidateQueries({ queryKey: getListWorkspaceMembersQueryKey(workspace.id) });
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function revoke(inviteId: string) {
    const confirmed = window.confirm(
      `Revoke this invite for ${workspace.name}? Anyone holding the link will no longer be able to use it.`,
    );
    if (!confirmed) return;
    setError(null);
    try {
      await revokeInvite.mutateAsync({ workspaceId: workspace.id, inviteId });
      await queryClient.invalidateQueries({ queryKey: getListWorkspaceInvitesQueryKey(workspace.id) });
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <section className="mt-4 space-y-4 border-t border-border/70 pt-4" aria-label={`Manage access to ${workspace.name}`}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team members</h3>
        {membersQuery.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading members…</p>
        ) : membersQuery.isError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">Members could not be loaded.</p>
        ) : membersQuery.data?.members.length ? (
          <ul className="mt-2 space-y-2">
            {membersQuery.data.members.map(member => (
              <li key={member.userId} data-testid={`member-${workspace.id}-${member.userId}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <span className="min-w-0 flex-1 break-all text-xs font-medium">{member.userId}</span>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase text-secondary-foreground">{member.role}</span>
                {member.role === "member" && (
                  <button
                    type="button"
                    data-testid={`button-remove-member-${workspace.id}-${member.userId}`}
                    onClick={() => void remove(member.userId)}
                    disabled={removeMember.isPending}
                    aria-label={`Remove member ${member.userId}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {removeMember.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserMinus className="h-3.5 w-3.5" aria-hidden />}
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No members found.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unredeemed invite links</h3>
        {invitesQuery.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading invites…</p>
        ) : invitesQuery.isError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">Invite links could not be loaded.</p>
        ) : invitesQuery.data?.invites.length ? (
          <ul className="mt-2 space-y-2">
            {invitesQuery.data.invites.map(invite => {
              const expired = Date.parse(invite.expiresAt) <= Date.now();
              return (
                <li key={invite.id} data-testid={`invite-${workspace.id}-${invite.id}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                    Created {new Date(invite.createdAt).toLocaleDateString()} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                    {expired ? " · expired" : ""}
                  </span>
                  <button
                    type="button"
                    data-testid={`button-revoke-invite-${workspace.id}-${invite.id}`}
                    onClick={() => void revoke(invite.id)}
                    disabled={revokeInvite.isPending}
                    aria-label={`Revoke invite link for ${workspace.name}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {revokeInvite.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Ban className="h-3.5 w-3.5" aria-hidden />}
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No unredeemed invite links.</p>
        )}
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
    </section>
  );
}

export function ProjectWorkspaceMove({ project, workspaces }: { project: Project; workspaces: OwnerWorkspace[] }) {
  const queryClient = useQueryClient();
  const moveProject = useMoveProjectToWorkspace();
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const source = workspaces.find(workspace => workspace.id === project.workspaceId);
  const targets = workspaces.filter(workspace => workspace.id !== project.workspaceId);

  if (!project.workspaceId || (source?.kind === "team" && source.role !== "owner") || targets.length === 0) return null;

  async function move() {
    if (!targetId) return;
    setError(null);
    try {
      await moveProject.mutateAsync({ projectId: project.id, data: { workspaceId: targetId } });
      if (workspaces.find(workspace => workspace.id === targetId)?.kind === "team") {
        trackEvent("project_shared");
      }
      await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setTargetId("");
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
      <label className="sr-only" htmlFor={`move-project-${project.id}`}>Move project to a workspace</label>
      <select
        id={`move-project-${project.id}`}
        data-testid={`select-move-project-${project.id}`}
        aria-label={`Choose destination workspace for ${project.title}`}
        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-2 text-xs"
        value={targetId}
        onChange={event => setTargetId(event.target.value)}
      >
        <option value="">Move to…</option>
        {targets.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      <button
        type="button"
        data-testid={`button-move-project-${project.id}`}
        onClick={() => void move()}
        disabled={!targetId || moveProject.isPending}
        aria-label={`Move ${project.title} to selected workspace`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
      >
        {moveProject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />}
        Move
      </button>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
