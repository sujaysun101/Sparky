export type WorkspaceMembership = {
  kind: unknown;
  role: unknown;
} | null | undefined;

export function hasTeamOwnerAccess(membership: WorkspaceMembership): boolean {
  return membership?.kind === "team" && membership.role === "owner";
}
