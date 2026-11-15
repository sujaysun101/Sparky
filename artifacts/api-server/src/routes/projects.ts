import { Router, type IRouter, type Request } from "express";
import { CreateProjectBody, SaveDraftBody, SaveDraftResponse, UpdateTaskBody, UpdateTaskResponse, StartRunBody, MoveProjectToWorkspaceBody } from "@workspace/api-zod";
import { createHash } from "node:crypto";
import { guest } from "../middlewares/guest";
import { query, uid, transaction, ownedProject, ownedRun, runView, workspace, projectList, recoverInterrupted, HttpError } from "../lib/store";
import { curatedPlan, generateJson, planSchema, ProviderFailure } from "../lib/ai";
import { launchRun, workerId } from "../lib/run-engine";

const router: IRouter = Router();
router.use(guest);
const idParam = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/.test(value)) throw new HttpError(400, "Invalid identifier.");
  return value;
};
function validate<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, "Please check the request fields and size limits.");
  return result.data;
}

router.get("/projects", async (req, res): Promise<void> => {
  res.json(await projectList(req.owner));
});
router.post("/projects", async (req, res): Promise<void> => {
  const input = validate(CreateProjectBody, req.body);
  if (!input.idea.trim()) throw new HttpError(400, "Describe something you want to build.");
  let projectWorkspaceId: string | null = null;
  let projectGuestId: string | null = null;
  let column: "guest_id" | "workspace_id";
  let scopeId: string;
  if (req.owner.kind === "user") {
    projectWorkspaceId = input.workspaceId ?? req.owner.personalWorkspaceId;
    const member = (await query(
      "SELECT workspace_id FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
      [projectWorkspaceId, req.owner.id],
    )).rows[0];
    if (!member) throw new HttpError(404, "Workspace not found.");
    column = "workspace_id";
    scopeId = projectWorkspaceId;
  } else {
    if (input.workspaceId) throw new HttpError(401, "Sign in to create a team project.");
    projectGuestId = req.owner.id;
    column = "guest_id";
    scopeId = req.owner.id;
  }
  const count = (await query(`SELECT count(*)::int AS n FROM projects WHERE ${column}=$1`, [scopeId])).rows[0].n;
  if (count >= 10) throw new HttpError(429, "This workspace allows up to 10 projects.");
  let plan = curatedPlan;
  if (!input.sample) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        plan = planSchema.parse(await generateJson(
          `Create a small achievable learning project plan for the supplied idea, programming language and experience.
          Use 2-4 milestones of 1-4 short actionable tasks. Explain why every concept matters for this particular project.
          Respect the preferred language. No arbitrary code execution. Return JSON:
          {"title":"short project title","milestones":[{"title":"milestone","tasks":[{"title":"task","description":"actionable instruction","concepts":[{"name":"concept","why":"its relevance"}]}]}]}`,
          input,
        ));
        break;
      } catch (err) {
        if (err instanceof ProviderFailure && err.retryable && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
          continue;
        }
        if (err instanceof ProviderFailure) throw new HttpError(503, err.message);
        throw new HttpError(502, "The AI plan did not match the required format. Your idea is still in the form; please retry.");
      }
    }
  }
  const projectId = uid();
  await transaction(async c => {
    await c.query("INSERT INTO projects (id,guest_id,user_id,workspace_id,created_by,title,idea,language,level,plan_source) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9)",
      [projectId, projectGuestId, projectWorkspaceId, req.owner.kind === "user" ? req.owner.id : null, plan.title, input.sample ? "Build a simple expense tracker." : input.idea, input.language, input.level, input.sample ? "curated" : "ai"]);
    for (let mi = 0; mi < plan.milestones.length; mi++) {
      const m = plan.milestones[mi]!;
      const mid = uid();
      await c.query("INSERT INTO milestones (id,project_id,title,position) VALUES ($1,$2,$3,$4)", [mid, projectId, m.title, mi]);
      for (let ti = 0; ti < m.tasks.length; ti++) {
        const t = m.tasks[ti]!;
        await c.query("INSERT INTO tasks (id,milestone_id,title,description,concepts,position) VALUES ($1,$2,$3,$4,$5,$6)",
          [uid(), mid, t.title, t.description, JSON.stringify(t.concepts), ti]);
      }
    }
    const starter = input.language === "Python"
      ? "# Your expense tracker starts here.\n# Describe an expense with a name, amount, and category.\n\nexpenses = []\n"
      : ["JavaScript", "TypeScript", "React"].includes(input.language)
        ? "// Your expense tracker starts here.\n// Describe an expense with a name, amount, and category.\n\nconst expenses = [];\n"
        : "";
    await c.query("INSERT INTO drafts (project_id,code,question) VALUES ($1,$2,'')", [projectId, input.sample ? starter : ""]);
  });
  res.status(201).json(await workspace(projectId, req.owner));
});
router.get("/projects/:projectId", async (req, res): Promise<void> => {
  res.json(await workspace(idParam(req.params.projectId), req.owner));
});
router.patch("/projects/:projectId/workspace", async (req, res): Promise<void> => {
  const projectId = idParam(req.params.projectId);
  const input = validate(MoveProjectToWorkspaceBody, req.body);
  if (req.owner.kind !== "user") throw new HttpError(401, "Sign in to move a project between workspaces.");
  const project = await ownedProject(projectId, req.owner);
  const targetWorkspaceId = input.workspaceId ?? req.owner.personalWorkspaceId;
  const target = (await query(
    "SELECT w.id FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
    [targetWorkspaceId, req.owner.id],
  )).rows[0];
  if (!target) throw new HttpError(404, "Workspace not found.");

  if (project.workspace_id && project.workspace_id !== targetWorkspaceId) {
    const source = (await query(
      "SELECT w.kind,wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE w.id=$1 AND wm.user_id=$2",
      [project.workspace_id, req.owner.id],
    )).rows[0];
    if (source?.kind === "team" && source.role !== "owner") {
      throw new HttpError(403, "Only a team owner can move a shared project out of that team.");
    }
  }
  await query(
    "UPDATE projects SET workspace_id=$2,guest_id=NULL,user_id=NULL,created_by=COALESCE(created_by,$3) WHERE id=$1",
    [projectId, targetWorkspaceId, req.owner.id],
  );
  res.json(await workspace(projectId, req.owner));
});
router.put("/projects/:projectId/draft", async (req, res): Promise<void> => {
  const projectId = idParam(req.params.projectId);
  await ownedProject(projectId, req.owner);
  const input = validate(SaveDraftBody, req.body);
  await transaction(async c => {
    await c.query("UPDATE drafts SET code=$2,question=$3,updated_at=clock_timestamp() WHERE project_id=$1", [projectId, input.code, input.question]);
    // Safe actual database error: the transaction rolls back the draft update.
    if (input.simulateSaveFailure) await c.query("SELECT 1 / 0");
  });
  const row = (await query("SELECT * FROM drafts WHERE project_id=$1", [projectId])).rows[0];
  res.json(SaveDraftResponse.parse({ code: row.code, question: row.question, updatedAt: row.updated_at.toISOString() }));
});
router.patch("/projects/:projectId/tasks/:taskId", async (req, res): Promise<void> => {
  const projectId = idParam(req.params.projectId);
  const taskId = idParam(req.params.taskId);
  await ownedProject(projectId, req.owner);
  const input = validate(UpdateTaskBody, req.body);
  const { rows } = await query("UPDATE tasks t SET completed=$3 FROM milestones m WHERE t.milestone_id=m.id AND t.id=$1 AND m.project_id=$2 RETURNING t.*", [taskId, projectId, input.completed]);
  const t = rows[0];
  if (!t) throw new HttpError(404, "Task not found in this project.");
  res.json(UpdateTaskResponse.parse({ id: t.id, title: t.title, description: t.description, completed: t.completed, concepts: t.concepts }));
});
router.post("/projects/:projectId/runs", async (req, res): Promise<void> => {
  const received = new Date();
  const projectId = idParam(req.params.projectId);
  const input = validate(StartRunBody, req.body);
  if (!input.question.trim()) throw new HttpError(400, "Enter a question for your tutor.");
  const project = await ownedProject(projectId, req.owner);
  if (input.taskId) {
    const task = (await query("SELECT t.id FROM tasks t JOIN milestones m ON t.milestone_id=m.id WHERE t.id=$1 AND m.project_id=$2", [input.taskId, projectId])).rows[0];
    if (!task) throw new HttpError(400, "Choose a task belonging to this project.");
  }
  await recoverInterrupted(projectId);
  const hash = createHash("sha256").update(JSON.stringify({ question: input.question, code: input.code, mode: input.mode, taskId: input.taskId ?? null, simulateFailure: input.simulateFailure ?? false })).digest("hex");
  const validated = new Date();
  const column = req.owner.kind === "guest" ? "guest_id" : "workspace_id";
  const scopeId = req.owner.kind === "guest" ? req.owner.id : project.workspace_id ?? req.owner.personalWorkspaceId;
  const result = await transaction(async c => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${column}:${scopeId}`]);
    const previous = (await c.query("SELECT id,input_hash FROM runs WHERE project_id=$1 AND idempotency_key=$2", [projectId, input.idempotencyKey])).rows[0];
    if (previous) {
      if (previous.input_hash !== hash) throw new HttpError(409, "This request key was already used for different content. Start a new request.");
      return { id: previous.id as string, created: false };
    }
    const count = (await c.query(`SELECT count(*)::int AS n FROM runs r JOIN projects p ON r.project_id=p.id WHERE p.${column}=$1 AND r.created_at>now()-interval '10 minutes'`, [scopeId])).rows[0].n;
    if (count >= 15) throw new HttpError(429, "Public-demo limit reached: 15 tutor requests per 10 minutes. Please wait before sending another.");
    const running = (await c.query(`SELECT r.id FROM runs r JOIN projects p ON r.project_id=p.id WHERE p.${column}=$1 AND r.status='running' AND r.updated_at>now()-interval '3 minutes'`, [scopeId])).rows;
    if (running.length >= 2) throw new HttpError(429, "Two tutor requests are already running. Please wait for one to finish.");
    const runId = uid();
    await c.query("INSERT INTO runs (id,project_id,idempotency_key,input_hash,question,code,mode,task_id,simulated,worker_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [runId, projectId, input.idempotencyKey, hash, input.question, input.code, input.mode, input.taskId ?? null, input.simulateFailure ?? false, workerId]);
    await c.query("INSERT INTO tutor_messages (id,project_id,run_id,role,content) VALUES ($1,$2,$3,'user',$4)", [uid(), projectId, runId, input.question]);
    const finished = new Date();
    for (const e of [
      { step: "browser", label: "Learner's browser", start: received, end: received, summary: "Browser request received by Express. This timestamp is server receipt time, not network travel time." },
      { step: "validation", label: "Express validates request", start: received, end: validated, summary: "Input limits, mode, project ownership, task membership and idempotency key checked." },
      { step: "database", label: "PostgreSQL saves learner message", start: validated, end: finished, summary: "One run, one learner message and the submitted code were committed together." },
    ]) await c.query("INSERT INTO run_events (id,run_id,step,label,status,started_at,ended_at,duration_ms,summary,attempt) VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,$8,1)",
      [uid(), runId, e.step, e.label, e.start, e.end, e.end.getTime() - e.start.getTime(), e.summary]);
    return { id: runId, created: true };
  });
  if (result.created) launchRun(result.id, !!input.simulateFailure);
  res.status(202).json(await runView(result.id));
});
router.get("/runs/:runId", async (req, res): Promise<void> => {
  const id = idParam(req.params.runId);
  const run = await ownedRun(id, req.owner);
  await recoverInterrupted(run.project_id);
  res.json(await runView(id));
});
router.post("/runs/:runId/retry", async (req, res): Promise<void> => {
  const id = idParam(req.params.runId);
  const original = await ownedRun(id, req.owner);
  await recoverInterrupted(original.project_id);
  const column = req.owner.kind === "guest" ? "guest_id" : "workspace_id";
  const scopeId = req.owner.kind === "guest" ? req.owner.id : original.workspace_id ?? req.owner.personalWorkspaceId;
  const shouldLaunch = await transaction(async c => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${column}:${scopeId}`]);
    const run = (await c.query("SELECT * FROM runs WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (run.status === "running" || run.status === "completed") return false;
    if (run.attempt >= 5) throw new HttpError(429, "Retry limit reached for this run. Please send a new, focused question.");
    const other = (await c.query(`SELECT r.id FROM runs r JOIN projects p ON r.project_id=p.id WHERE p.${column}=$1 AND r.status='running' AND r.updated_at>now()-interval '3 minutes'`, [scopeId])).rows;
    if (other.length >= 2) throw new HttpError(429, "Please wait for a running request to finish.");
    await c.query("UPDATE runs SET status='running',error=NULL,attempt=attempt+1,worker_id=$2,updated_at=now() WHERE id=$1", [id, workerId]);
    return true;
  });
  if (shouldLaunch) launchRun(id, false);
  res.status(202).json(await runView(id));
});
router.post("/runs/:runId/displayed", async (req, res): Promise<void> => {
  const id = idParam(req.params.runId);
  await ownedRun(id, req.owner);
  await transaction(async c => {
    const run = (await c.query("SELECT status,attempt FROM runs WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (run.status !== "completed") throw new HttpError(409, "Only a completed response can be acknowledged.");
    const exists = (await c.query("SELECT id FROM run_events WHERE run_id=$1 AND step='display'", [id])).rows.length;
    if (!exists) await c.query("INSERT INTO run_events (id,run_id,step,label,status,started_at,ended_at,duration_ms,summary,attempt) VALUES ($1,$2,'display','Browser displays response','completed',statement_timestamp(),clock_timestamp(),GREATEST(0,EXTRACT(EPOCH FROM(clock_timestamp()-statement_timestamp()))*1000)::integer,'Browser confirmed that the saved assistant message was rendered. Duration is acknowledgement processing, not browser paint time.',$3)", [uid(), id, run.attempt]);
  });
  res.json(await runView(id));
});
router.get("/runs/:runId/events", async (req, res): Promise<void> => {
  const id = idParam(req.params.runId);
  const owned = await ownedRun(id, req.owner);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let closed = false;
  req.on("close", () => { closed = true; });
  let last = "";
  // Bounded connection lifetime; EventSource automatically reconnects and rehydrates.
  for (let tick = 0; tick < 100 && !closed; tick++) {
    try {
      if (tick % 20 === 0) await recoverInterrupted(owned.project_id);
      const run = await runView(id);
      const snapshot = JSON.stringify(run);
      if (snapshot !== last) { res.write(`event: run\ndata: ${snapshot}\n\n`); last = snapshot; }
      else if (tick % 10 === 0) res.write(": heartbeat\n\n");
      if (run.status !== "running") break;
    } catch {
      res.write("event: stream-error\ndata: {\"error\":\"Connection interrupted. Reconnecting will reload saved events.\"}\n\n");
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  res.end();
});

export default router;
