import { pool, type PoolClient } from "@workspace/db";
import { GetWorkspaceResponse, GetRunResponse, ListProjectsResponse } from "@workspace/api-zod";
import { randomUUID } from "node:crypto";

export const uid = () => randomUUID();
export const query = pool.query.bind(pool);
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally { client.release(); }
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ProjectOwner =
  | { kind: "guest"; id: string }
  | { kind: "user"; id: string; personalWorkspaceId: string };

export async function ensurePersonalWorkspace(client: PoolClient, userId: string): Promise<string> {
  await client.query(
    "INSERT INTO workspaces (id,name,kind,created_by) VALUES ($1,'Personal workspace','personal',$2) ON CONFLICT (created_by) WHERE kind='personal' DO NOTHING",
    [uid(), userId],
  );
  const personal = (await client.query(
    "SELECT id FROM workspaces WHERE created_by=$1 AND kind='personal'",
    [userId],
  )).rows[0];
  if (!personal) throw new Error("Could not establish the personal workspace.");

  await client.query(
    "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT (workspace_id,user_id) DO UPDATE SET role='owner'",
    [personal.id, userId],
  );
  await client.query(
    "UPDATE projects SET workspace_id=$1,user_id=NULL,created_by=COALESCE(created_by,$2) WHERE user_id=$2 AND guest_id IS NULL AND workspace_id IS NULL",
    [personal.id, userId],
  );
  return personal.id as string;
}

export async function ownedProject(projectId: string, owner: ProjectOwner) {
  const { rows } = owner.kind === "guest"
    ? await query("SELECT * FROM projects WHERE id=$1 AND guest_id=$2", [projectId, owner.id])
    : await query(
      `SELECT p.* FROM projects p
       WHERE p.id=$1 AND (
         p.user_id=$2 OR EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id=p.workspace_id AND wm.user_id=$2
         )
       )`,
      [projectId, owner.id],
    );
  if (!rows[0]) throw new HttpError(404, "Project not found in this session.");
  return rows[0];
}
export async function ownedRun(runId: string, owner: ProjectOwner) {
  const { rows } = owner.kind === "guest"
    ? await query(
      "SELECT r.* FROM runs r JOIN projects p ON r.project_id=p.id WHERE r.id=$1 AND p.guest_id=$2",
      [runId, owner.id],
    )
    : await query(
      `SELECT r.*,p.workspace_id FROM runs r JOIN projects p ON r.project_id=p.id
       WHERE r.id=$1 AND (
         p.user_id=$2 OR EXISTS (
           SELECT 1 FROM workspace_members wm
           WHERE wm.workspace_id=p.workspace_id AND wm.user_id=$2
         )
       )`,
      [runId, owner.id],
    );
  if (!rows[0]) throw new HttpError(404, "Run not found in this session.");
  return rows[0];
}
export async function recoverInterrupted(projectId: string) {
  await transaction(async c => {
    const stale = await c.query(
      "UPDATE runs SET status='interrupted', error='This request was interrupted. Your message and code are safe. Retry this run.',updated_at=now() WHERE project_id=$1 AND status='running' AND updated_at < now()-interval '3 minutes' RETURNING id",
      [projectId],
    );
    for (const row of stale.rows) {
      await c.query("UPDATE run_events SET status='failed', ended_at=now(),duration_ms=GREATEST(0,EXTRACT(EPOCH FROM (now()-started_at))*1000)::integer,summary='The server stopped before this step finished. Retry the run.' WHERE run_id=$1 AND status IN ('running','retrying')", [row.id]);
    }
  });
}
export async function runView(runId: string) {
  const r = (await query("SELECT * FROM runs WHERE id=$1", [runId])).rows[0];
  if (!r) throw new HttpError(404, "Run not found.");
  const { rows: events } = await query("SELECT * FROM run_events WHERE run_id=$1 ORDER BY started_at,id", [runId]);
  return GetRunResponse.parse({
    id: r.id, projectId: r.project_id, status: r.status, createdAt: r.created_at.toISOString(), error: r.error,
    attempt: r.attempt, simulated: r.simulated,
    events: events.map(e => ({
      id: e.id, step: e.step, label: e.label, status: e.status,
      startedAt: e.started_at.toISOString(), endedAt: e.ended_at?.toISOString() ?? null,
      durationMs: e.duration_ms, summary: e.summary, attempt: e.attempt,
      details: e.details ?? null,
    })),
  });
}
export async function projectList(owner: ProjectOwner) {
  const access = owner.kind === "guest"
    ? "p.guest_id=$1"
    : `(p.user_id=$1 OR EXISTS (
         SELECT 1 FROM workspace_members wm
         WHERE wm.workspace_id=p.workspace_id AND wm.user_id=$1
       ))`;
  const { rows } = await query(`SELECT p.*, w.name AS workspace_name, w.kind AS workspace_kind,
    (SELECT count(*)::int FROM tasks t JOIN milestones m ON t.milestone_id=m.id WHERE m.project_id=p.id) AS total_tasks,
    (SELECT count(*)::int FROM tasks t JOIN milestones m ON t.milestone_id=m.id WHERE m.project_id=p.id AND t.completed) AS completed_tasks
    FROM projects p LEFT JOIN workspaces w ON w.id=p.workspace_id
    WHERE ${access} ORDER BY p.created_at DESC`, [owner.id]);
  return ListProjectsResponse.parse(rows.map(p => ({
    id: p.id, title: p.title, idea: p.idea, language: p.language, level: p.level, createdAt: p.created_at.toISOString(),
    planSource: p.plan_source, totalTasks: p.total_tasks, completedTasks: p.completed_tasks,
    workspaceId: p.workspace_id ?? null,
    workspaceName: p.workspace_name ?? (p.user_id ? "Personal workspace" : null),
    workspaceKind: p.workspace_kind ?? (p.user_id ? "personal" : null),
  })));
}
export async function workspace(projectId: string, owner: ProjectOwner) {
  await ownedProject(projectId, owner);
  await recoverInterrupted(projectId);
  const project = (await projectList(owner)).find(p => p.id === projectId)!;
  const { rows: ms } = await query("SELECT * FROM milestones WHERE project_id=$1 ORDER BY position", [projectId]);
  const { rows: ts } = await query("SELECT t.* FROM tasks t JOIN milestones m ON m.id=t.milestone_id WHERE m.project_id=$1 ORDER BY t.position", [projectId]);
  const draft = (await query("SELECT * FROM drafts WHERE project_id=$1", [projectId])).rows[0];
  const { rows: messages } = await query("SELECT * FROM tutor_messages WHERE project_id=$1 ORDER BY created_at,id", [projectId]);
  const { rows: runs } = await query("SELECT id FROM runs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20", [projectId]);
  return GetWorkspaceResponse.parse({
    project,
    milestones: ms.map(m => ({ id: m.id, title: m.title, tasks: ts.filter(t => t.milestone_id === m.id).map(t => ({
      id: t.id, title: t.title, description: t.description, completed: t.completed, concepts: t.concepts,
    })) })),
    draft: { code: draft.code, question: draft.question, updatedAt: draft.updated_at.toISOString() },
    messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at.toISOString(), runId: m.run_id, ...(m.guidance ? { guidance: m.guidance } : {}) })),
    runs: await Promise.all(runs.map(r => runView(r.id))),
  });
}
