import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { clerkClient } from "@clerk/express";
import {
  AcceptWorkspaceInviteBody,
  AcceptWorkspaceInviteResponse,
  CreateWorkspaceBody,
  CreateWorkspaceResponse,
  CreateWorkspaceInviteResponse,
  ListWorkspacesResponse,
  ListWorkspaceInvitesResponse,
  ListWorkspaceMembersResponse,
  TransferWorkspaceOwnershipBody,
} from "@workspace/api-zod";
import { guest } from "../middlewares/guest";
import { HttpError, query, transaction, uid } from "../lib/store";
import { hasTeamOwnerAccess } from "../lib/workspace-access";

const router: IRouter = Router();

function signedIn(req: Request) {
  if (req.owner.kind !== "user") throw new HttpError(401, "Sign in to use team workspaces.");
  return req.owner;
}

function workspaceId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) {
    throw new HttpError(400, "Invalid workspace identifier.");
  }
  return value;
}

function memberId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 255) {
    throw new HttpError(400, "Invalid member identifier.");
  }
  return value;
}

async function assertTeamOwner(id: string, userId: string): Promise<void> {
  const owner = (await query(
    `SELECT w.kind,wm.role
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id=w.id
     WHERE w.id=$1 AND wm.user_id=$2`,
    [id, userId],
  )).rows[0];
  if (!hasTeamOwnerAccess(owner)) throw new HttpError(404, "Team workspace not found.");
}

router.get("/workspaces", guest, async (req, res): Promise<void> => {
  if (req.owner.kind === "guest") {
    res.json(ListWorkspacesResponse.parse([]));
    return;
  }
  const { rows } = await query(
    `SELECT w.id,w.name,w.kind,wm.role,w.created_at
     FROM workspace_members wm
     JOIN workspaces w ON w.id=wm.workspace_id
     WHERE wm.user_id=$1
     ORDER BY CASE WHEN w.kind='personal' THEN 0 ELSE 1 END,w.name`,
    [req.owner.id],
  );
  res.json(ListWorkspacesResponse.parse(rows.map(w => ({
    id: w.id,
    name: w.name,
    kind: w.kind,
    role: w.role,
    createdAt: w.created_at.toISOString(),
  }))));
});

router.get("/workspaces/:workspaceId/members", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  await assertTeamOwner(id, owner.id);
  const { rows } = await query(
    "SELECT user_id,role,created_at FROM workspace_members WHERE workspace_id=$1 ORDER BY CASE WHEN role='owner' THEN 0 ELSE 1 END,created_at,user_id",
    [id],
  );
  const displayNames = new Map<string, string | null>();
  const userIds = rows.map(member => member.user_id as string);
  for (let offset = 0; offset < userIds.length; offset += 100) {
    const users = await clerkClient.users.getUserList({
      userId: userIds.slice(offset, offset + 100),
      limit: Math.min(userIds.length - offset, 100),
    });
    for (const user of users.data) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      displayNames.set(user.id, name || user.username || null);
    }
  }
  res.json(ListWorkspaceMembersResponse.parse({
    members: rows.map(member => ({
      userId: member.user_id,
      displayName: displayNames.get(member.user_id) ?? null,
      role: member.role,
      joinedAt: member.created_at.toISOString(),
    })),
  }));
});

router.post("/workspaces", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter a team name between 2 and 80 characters.");
  const name = parsed.data.name.trim();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Enter a team name between 2 and 80 characters.");
  const count = (await query(
    "SELECT count(*)::int AS n FROM workspaces WHERE created_by=$1 AND kind='team'",
    [owner.id],
  )).rows[0].n;
  if (count >= 10) throw new HttpError(429, "This account has reached its 10-team limit.");

  const created = await transaction(async c => {
    const id = uid();
    await c.query(
      "INSERT INTO workspaces (id,name,kind,created_by) VALUES ($1,$2,'team',$3)",
      [id, name, owner.id],
    );
    await c.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner')",
      [id, owner.id],
    );
    return (await c.query(
      "SELECT w.id,w.name,w.kind,wm.role,w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
      [id, owner.id],
    )).rows[0];
  });
  res.status(201).json(CreateWorkspaceResponse.parse({
    id: created.id,
    name: created.name,
    kind: created.kind,
    role: created.role,
    createdAt: created.created_at.toISOString(),
  }));
});

router.post("/workspaces/:workspaceId/invites", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  const membership = (await query(
    "SELECT w.kind,wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
    [id, owner.id],
  )).rows[0];
  if (!hasTeamOwnerAccess(membership)) {
    throw new HttpError(404, "Team workspace not found.");
  }
  const recent = (await query(
    "SELECT count(*)::int AS n FROM workspace_invites WHERE workspace_id=$1 AND created_by=$2 AND created_at>now()-interval '24 hours'",
    [id, owner.id],
  )).rows[0].n;
  if (recent >= 5) throw new HttpError(429, "This team has reached its limit of five invite links per day.");

  const token = randomBytes(32).toString("hex");
  const invite = (await query(
    "INSERT INTO workspace_invites (id,workspace_id,token_hash,created_by,expires_at) VALUES ($1,$2,$3,$4,now()+interval '7 days') RETURNING expires_at",
    [uid(), id, createHash("sha256").update(token).digest("hex"), owner.id],
  )).rows[0];
  res.status(201).json(CreateWorkspaceInviteResponse.parse({
    token,
    expiresAt: invite.expires_at.toISOString(),
  }));
});

router.get("/workspaces/:workspaceId/invites", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  await assertTeamOwner(id, owner.id);
  const { rows } = await query(
    "SELECT id,created_at,expires_at FROM workspace_invites WHERE workspace_id=$1 AND accepted_at IS NULL ORDER BY created_at DESC",
    [id],
  );
  res.json(ListWorkspaceInvitesResponse.parse({
    invites: rows.map(invite => ({
      id: invite.id,
      createdAt: invite.created_at.toISOString(),
      expiresAt: invite.expires_at.toISOString(),
    })),
  }));
});

router.delete("/workspaces/:workspaceId/invites/:inviteId", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  const invite = memberId(req.params.inviteId);
  const deleted = (await query(
    `DELETE FROM workspace_invites wi
     WHERE wi.id=$1 AND wi.workspace_id=$2 AND wi.accepted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id=w.id
         WHERE w.id=wi.workspace_id AND w.kind='team'
           AND wm.user_id=$3 AND wm.role='owner'
       )
     RETURNING wi.id`,
    [invite, id, owner.id],
  )).rows[0];
  if (!deleted) throw new HttpError(404, "Unredeemed team invite not found.");
  res.sendStatus(204);
});

router.delete("/workspaces/:workspaceId/members/:memberId", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  const member = memberId(req.params.memberId);
  const deleted = (await query(
    `DELETE FROM workspace_members target
     WHERE target.workspace_id=$1 AND target.user_id=$2 AND target.role='member'
       AND EXISTS (
         SELECT 1 FROM workspaces w
         JOIN workspace_members actor ON actor.workspace_id=w.id
         WHERE w.id=target.workspace_id AND w.kind='team'
           AND actor.user_id=$3 AND actor.role='owner'
       )
     RETURNING target.user_id`,
    [id, member, owner.id],
  )).rows[0];
  if (!deleted) throw new HttpError(404, "Team member not found.");
  res.sendStatus(204);
});

router.post("/workspaces/:workspaceId/ownership", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const id = workspaceId(req.params.workspaceId);
  const parsed = TransferWorkspaceOwnershipBody.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Choose a current team member to receive ownership.");
  const member = memberId(parsed.data.memberId);

  await transaction(async c => {
    const currentOwner = (await c.query(
      `SELECT w.id
       FROM workspaces w
       JOIN workspace_members wm ON wm.workspace_id=w.id
       WHERE w.id=$1 AND w.kind='team' AND wm.user_id=$2 AND wm.role='owner'
       FOR UPDATE OF w,wm`,
      [id, owner.id],
    )).rows[0];
    if (!currentOwner) throw new HttpError(404, "Team workspace not found.");

    const nextOwner = (await c.query(
      "SELECT user_id FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role='member' FOR UPDATE",
      [id, member],
    )).rows[0];
    if (!nextOwner) throw new HttpError(404, "Team member not found.");

    const demoted = await c.query(
      "UPDATE workspace_members SET role='member' WHERE workspace_id=$1 AND user_id=$2 AND role='owner'",
      [id, owner.id],
    );
    if (demoted.rowCount !== 1) throw new HttpError(404, "Team workspace not found.");

    const promoted = await c.query(
      "UPDATE workspace_members SET role='owner' WHERE workspace_id=$1 AND user_id=$2 AND role='member'",
      [id, member],
    );
    if (promoted.rowCount !== 1) throw new HttpError(404, "Team member not found.");
  });
  res.sendStatus(204);
});

router.post("/invites/accept", guest, async (req, res): Promise<void> => {
  const owner = signedIn(req);
  const parsed = AcceptWorkspaceInviteBody.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "This invitation link is invalid.");
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const accepted = await transaction(async c => {
    const invite = (await c.query(
      "SELECT id,workspace_id,accepted_by,accepted_at,expires_at FROM workspace_invites WHERE token_hash=$1 FOR UPDATE",
      [tokenHash],
    )).rows[0];
    if (!invite) throw new HttpError(404, "This invitation link is invalid.");
    if (invite.accepted_at) {
      if (invite.accepted_by !== owner.id) throw new HttpError(409, "This invitation link has already been used.");
      const existing = (await c.query(
        "SELECT w.id,w.name,w.kind,wm.role,w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
        [invite.workspace_id, owner.id],
      )).rows[0];
      if (!existing) throw new HttpError(409, "This invitation has already been redeemed.");
      return existing;
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new HttpError(410, "This invitation link has expired.");
    }
    await c.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'member') ON CONFLICT (workspace_id,user_id) DO NOTHING",
      [invite.workspace_id, owner.id],
    );
    await c.query(
      "UPDATE workspace_invites SET accepted_by=$2,accepted_at=now() WHERE id=$1 AND accepted_at IS NULL",
      [invite.id, owner.id],
    );
    return (await c.query(
      "SELECT w.id,w.name,w.kind,wm.role,w.created_at FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
      [invite.workspace_id, owner.id],
    )).rows[0];
  });
  res.json(AcceptWorkspaceInviteResponse.parse({
    id: accepted.id,
    name: accepted.name,
    kind: accepted.kind,
    role: accepted.role,
    createdAt: accepted.created_at.toISOString(),
  }));
});

export default router;
