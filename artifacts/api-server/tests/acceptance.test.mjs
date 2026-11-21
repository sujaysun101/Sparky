import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.TEST_BASE_URL || "http://localhost:80/api";
const { Pool } = pg;

function visitor() {
  let cookie = "";
  return async (path, { method = "GET", data, raw = false, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(data ? { "Content-Type": "application/json" } : {}), ...headers },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(65000),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: res.status, headers: res.headers, data: raw ? await res.text() : await res.json() };
  };
}
async function terminal(v, id) {
  for (let i = 0; i < 180; i++) {
    const r = await v(`/runs/${id}`);
    assert.equal(r.status, 200);
    if (r.data.status !== "running") return r.data;
    await new Promise(resolve => setTimeout(resolve, 900));
  }
  throw new Error("Tutor run did not terminate within 162 seconds.");
}

async function clerkBackendRequest(secretKey, path, { method = "GET", data } = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  assert.ok(response.ok, `Clerk ${method} ${path} failed with ${response.status}: ${JSON.stringify(result)}`);
  return result;
}

test("real Clerk accounts can share teams without exposing private projects", {
  skip: process.env.RUN_CLERK_ACCEPTANCE !== "1",
}, async t => {
  // Opt in explicitly: this creates temporary Clerk users and requires the local dev database.
  const secretKey = process.env.CLERK_SECRET_KEY;
  assert.ok(secretKey?.startsWith("sk_test_"), "Set a development Clerk secret key before enabling this test.");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required to seed and clean up the expired invite.");
  const apiUrl = new URL(base);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname), "Run this test against the local API so invite expiry and cleanup use the same database.");

  const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const userIds = [];
  const sessions = new Map();

  t.after(async () => {
    const cleanupFailures = [];
    try {
      if (userIds.length) {
        await db.query("DELETE FROM workspaces WHERE created_by=ANY($1::text[])", [userIds]);
        await db.query("DELETE FROM app_users WHERE id=ANY($1::text[])", [userIds]);
      }
    } catch {
      cleanupFailures.push("test workspaces and membership rows");
    }
    for (const userId of userIds) {
      try {
        await clerkBackendRequest(secretKey, `/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      } catch {
        cleanupFailures.push("temporary Clerk test users");
      }
    }
    await db.end();
    assert.deepEqual(cleanupFailures, [], `Could not clean up ${cleanupFailures.join(" and ")}.`);
  });

  async function createTestUser(role) {
    const email = `sparky-acceptance-${randomUUID()}-${role}@example.com`;
    const user = await clerkBackendRequest(secretKey, "/users", {
      method: "POST",
      data: {
        email_address: [email],
        first_name: "Sparky",
        last_name: "Acceptance",
        password: randomBytes(24).toString("base64url"),
        skip_password_checks: true,
      },
    });
    userIds.push(user.id);
    const session = await clerkBackendRequest(secretKey, "/sessions", {
      method: "POST",
      data: { user_id: user.id },
    });
    sessions.set(role, session.id);
    return user.id;
  }

  async function signedIn(role, path, { method = "GET", data } = {}) {
    const sessionId = sessions.get(role);
    const token = await clerkBackendRequest(secretKey, `/sessions/${encodeURIComponent(sessionId)}/tokens`, {
      method: "POST",
      data: { expires_in_seconds: 60 },
    });
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token.jwt}`,
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(65000),
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  }

  const ownerId = await createTestUser("owner");
  const memberId = await createTestUser("member");
  const outsiderId = await createTestUser("outsider");

  const ownerWorkspaces = await signedIn("owner", "/workspaces");
  assert.equal(ownerWorkspaces.status, 200);
  const personalWorkspace = ownerWorkspaces.data.find(workspace => workspace.kind === "personal");
  assert.ok(personalWorkspace, "Clerk account should receive a private personal workspace.");

  const createdTeam = await signedIn("owner", "/workspaces", {
    method: "POST",
    data: { name: `Acceptance team ${randomUUID().slice(0, 8)}` },
  });
  assert.equal(createdTeam.status, 201, JSON.stringify(createdTeam.data));
  const teamId = createdTeam.data.id;

  const invite = await signedIn("owner", `/workspaces/${teamId}/invites`, { method: "POST", data: {} });
  assert.equal(invite.status, 201, JSON.stringify(invite.data));

  const expiredInvite = await signedIn("owner", `/workspaces/${teamId}/invites`, { method: "POST", data: {} });
  assert.equal(expiredInvite.status, 201, JSON.stringify(expiredInvite.data));
  const expiredHash = createHash("sha256").update(expiredInvite.data.token).digest("hex");
  const expiredRow = await db.query(
    "UPDATE workspace_invites SET created_at=now()-interval '8 days',expires_at=now()-interval '1 minute' WHERE token_hash=$1",
    [expiredHash],
  );
  assert.equal(expiredRow.rowCount, 1);
  const expiredAcceptance = await signedIn("member", "/invites/accept", {
    method: "POST",
    data: { token: expiredInvite.data.token },
  });
  assert.equal(expiredAcceptance.status, 410);

  const accepted = await signedIn("member", "/invites/accept", {
    method: "POST",
    data: { token: invite.data.token },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.id, teamId);
  assert.equal(accepted.data.role, "member");
  const repeatAcceptance = await signedIn("member", "/invites/accept", {
    method: "POST",
    data: { token: invite.data.token },
  });
  assert.equal(repeatAcceptance.status, 200, "The same account can safely retry an accepted invite.");
  assert.equal(repeatAcceptance.data.id, teamId);
  assert.equal((await signedIn("outsider", "/invites/accept", {
    method: "POST",
    data: { token: invite.data.token },
  })).status, 409, "A different account cannot redeem an already-used invite.");

  const memberships = await signedIn("owner", `/workspaces/${teamId}/members`);
  assert.equal(memberships.status, 200);
  assert.deepEqual(
    memberships.data.members.map(member => [member.userId, member.displayName, member.role]).sort(),
    [[ownerId, "Sparky Acceptance", "owner"], [memberId, "Sparky Acceptance", "member"]].sort(),
  );
  assert.equal((await signedIn("member", `/workspaces/${teamId}/members`)).status, 404);
  const memberWorkspaces = await signedIn("member", "/workspaces");
  assert.ok(memberWorkspaces.data.some(workspace => workspace.id === teamId && workspace.role === "member"));
  assert.equal((await signedIn("outsider", `/workspaces/${teamId}/members`)).status, 404);
  const nonOwnerTransfer = await signedIn("member", `/workspaces/${teamId}/ownership`, {
    method: "POST",
    data: { memberId: ownerId },
  });
  assert.equal(nonOwnerTransfer.status, 404, "A regular member cannot transfer team ownership.");
  const nonMemberTransfer = await signedIn("owner", `/workspaces/${teamId}/ownership`, {
    method: "POST",
    data: { memberId: outsiderId },
  });
  assert.equal(nonMemberTransfer.status, 404, "Ownership can only be transferred to an existing team member.");

  const ownershipTransferred = await signedIn("owner", `/workspaces/${teamId}/ownership`, {
    method: "POST",
    data: { memberId },
  });
  assert.equal(ownershipTransferred.status, 204);
  const transferredMembers = await signedIn("member", `/workspaces/${teamId}/members`);
  assert.deepEqual(
    transferredMembers.data.members.map(member => [member.userId, member.role]).sort(),
    [[ownerId, "member"], [memberId, "owner"]].sort(),
  );
  assert.equal((await signedIn("owner", `/workspaces/${teamId}/members`)).status, 404);
  const transferBack = await signedIn("member", `/workspaces/${teamId}/ownership`, {
    method: "POST",
    data: { memberId: ownerId },
  });
  assert.equal(transferBack.status, 204);
  const restoredMembers = await signedIn("owner", `/workspaces/${teamId}/members`);
  assert.deepEqual(
    restoredMembers.data.members.map(member => [member.userId, member.role]).sort(),
    [[ownerId, "owner"], [memberId, "member"]].sort(),
  );

  const privateProject = await signedIn("owner", "/projects", {
    method: "POST",
    data: { idea: "Build a small budget tracker.", language: "JavaScript", level: "beginner", sample: true },
  });
  assert.equal(privateProject.status, 201, JSON.stringify(privateProject.data));
  const privateProjectId = privateProject.data.project.id;
  assert.equal(privateProject.data.project.workspaceId, personalWorkspace.id);
  assert.equal((await signedIn("member", `/projects/${privateProjectId}`)).status, 404);

  const sharedProject = await signedIn("owner", "/projects", {
    method: "POST",
    data: { idea: "Build a shared budget tracker.", language: "JavaScript", level: "beginner", sample: true, workspaceId: teamId },
  });
  assert.equal(sharedProject.status, 201, JSON.stringify(sharedProject.data));
  const sharedProjectId = sharedProject.data.project.id;
  const moved = await signedIn("owner", `/projects/${privateProjectId}/workspace`, {
    method: "PATCH",
    data: { workspaceId: teamId },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  assert.equal(moved.data.project.workspaceId, teamId);

  const memberProjects = await signedIn("member", "/projects");
  assert.ok(memberProjects.data.some(project => project.id === sharedProjectId));
  assert.ok(memberProjects.data.some(project => project.id === privateProjectId));
  assert.equal((await signedIn("member", `/projects/${privateProjectId}`)).status, 200);
  assert.equal((await signedIn("member", `/projects/${sharedProjectId}`)).status, 200);
  assert.equal((await signedIn("member", `/projects/${sharedProjectId}/draft`, {
    method: "PUT",
    data: { code: "// shared edit", question: "What changed?" },
  })).status, 200);

  const outsiderProjects = await signedIn("outsider", "/projects");
  assert.deepEqual(outsiderProjects.data, []);
  assert.equal((await signedIn("outsider", `/projects/${sharedProjectId}`)).status, 404);
  assert.equal((await signedIn("outsider", `/projects/${sharedProjectId}/draft`, {
    method: "PUT",
    data: { code: "// unauthorized edit", question: "Can I change this?" },
  })).status, 404);
  assert.equal((await signedIn("outsider", "/projects", {
    method: "POST",
    data: { idea: "Create a forbidden project.", language: "JavaScript", level: "beginner", sample: true, workspaceId: teamId },
  })).status, 404);
  assert.equal((await signedIn("outsider", `/projects/${sharedProjectId}/workspace`, {
    method: "PATCH",
    data: { workspaceId: personalWorkspace.id },
  })).status, 404);

  const memberPersonal = memberWorkspaces.data.find(workspace => workspace.kind === "personal");
  assert.ok(memberPersonal);
  const memberCannotMoveSharedProject = await signedIn("member", `/projects/${sharedProjectId}/workspace`, {
    method: "PATCH",
    data: { workspaceId: memberPersonal.id },
  });
  assert.equal(memberCannotMoveSharedProject.status, 403);

  const movedBack = await signedIn("owner", `/projects/${privateProjectId}/workspace`, {
    method: "PATCH",
    data: { workspaceId: null },
  });
  assert.equal(movedBack.status, 200);
  assert.equal(movedBack.data.project.workspaceKind, "personal");
  assert.ok(!(await signedIn("member", "/projects")).data.some(project => project.id === privateProjectId));
  assert.equal((await signedIn("member", `/projects/${privateProjectId}`)).status, 404);
});

test("persistent isolated learning flow and real failure handling", async t => {
  const a = visitor();
  const b = visitor();
  let projectId;
  let runId;
  const code = "const expenses = [{ name: 'Lunch', amount: 12, category: 'Food' }];";
  const question = "How should I calculate the total without changing the original array?";
  await t.test("create sample plan and load it from PostgreSQL", async () => {
    const created = await a("/projects", { method: "POST", data: { idea: "Build a simple expense tracker.", language: "JavaScript", level: "beginner", sample: true } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    projectId = created.data.project.id;
    assert.equal(created.data.project.planSource, "curated");
    assert.equal(created.data.milestones.length, 3);
    assert.equal(created.data.project.totalTasks, 6);
    const loaded = await a(`/projects/${projectId}`);
    assert.equal(loaded.status, 200);
    assert.deepEqual(loaded.data.milestones, created.data.milestones);
  });
  await t.test("draft and task completion survive reloading", async () => {
    const saved = await a(`/projects/${projectId}/draft`, { method: "PUT", data: { code, question } });
    assert.equal(saved.status, 200);
    const before = (await a(`/projects/${projectId}`)).data;
    const taskId = before.milestones[0].tasks[0].id;
    assert.equal((await a(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", data: { completed: true } })).status, 200);
    const reload = (await a(`/projects/${projectId}`)).data;
    assert.equal(reload.draft.code, code);
    assert.equal(reload.draft.question, question);
    assert.equal(reload.project.completedTasks, 1);
    assert.equal(reload.milestones[0].tasks[0].completed, true);
  });
  await t.test("controlled database error rolls back and retry saves", async () => {
    const unsaved = code + "\n// not committed by failed transaction";
    const failed = await a(`/projects/${projectId}/draft`, { method: "PUT", data: { code: unsaved, question, simulateSaveFailure: true } });
    assert.equal(failed.status, 503);
    assert.match(failed.data.error, /could not be saved/i);
    assert.equal((await a(`/projects/${projectId}`)).data.draft.code, code);
    assert.equal((await a(`/projects/${projectId}/draft`, { method: "PUT", data: { code: unsaved, question } })).status, 200);
    assert.equal((await a(`/projects/${projectId}`)).data.draft.code, unsaved);
  });
  await t.test("separate guests cannot read or mutate another project", async () => {
    assert.deepEqual((await b("/projects")).data, []);
    assert.equal((await b(`/projects/${projectId}`)).status, 404);
    assert.equal((await b(`/projects/${projectId}/draft`, { method: "PUT", data: { code: "", question: "" } })).status, 404);
  });
  await t.test("guest sessions cannot create teams or redeem team invitations", async () => {
    assert.deepEqual((await a("/workspaces")).data, []);
    assert.equal((await a("/workspaces", { method: "POST", data: { name: "Not allowed" } })).status, 401);
    assert.equal((await a("/invites/accept", { method: "POST", data: { token: "a".repeat(64) } })).status, 401);
  });
  await t.test("validation rejects oversize, empty and cross-site requests", async () => {
    assert.equal((await a(`/projects/${projectId}/runs`, { method: "POST", data: { question: " ", code, mode: "hint", idempotencyKey: randomUUID() } })).status, 400);
    assert.equal((await a(`/projects/${projectId}/draft`, { method: "PUT", data: { code: "x".repeat(30001), question } })).status, 400);
    assert.equal((await a(`/projects/${projectId}/draft`, { method: "PUT", headers: { origin: "https://untrusted.example" }, data: { code, question } })).status, 403);
  });
  await t.test("simulated AI failure persists actual step timings and one message", async () => {
    assert.equal((await a(`/projects/${projectId}/draft`, { method: "PUT", data: { code, question } })).status, 200);
    const input = { question, code, mode: "hint", idempotencyKey: randomUUID(), simulateFailure: true };
    const started = await a(`/projects/${projectId}/runs`, { method: "POST", data: input });
    assert.equal(started.status, 202, JSON.stringify(started.data));
    runId = started.data.id;
    const duplicate = await a(`/projects/${projectId}/runs`, { method: "POST", data: input });
    assert.equal(duplicate.data.id, runId);
    const conflict = await a(`/projects/${projectId}/runs`, { method: "POST", data: { ...input, question: "Different question" } });
    assert.equal(conflict.status, 409);
    const run = await terminal(a, runId);
    assert.equal(run.status, "failed");
    assert.equal(run.simulated, true);
    assert.match(run.error, /Simulated AI failure/);
    assert.ok(run.events.some(e => e.step === "ai" && e.status === "failed"));
    assert.ok(run.events.some(e => e.step === "validation" && e.status === "completed"));
    for (const e of run.events) {
      assert.ok(Number.isFinite(Date.parse(e.startedAt)));
      if (e.endedAt) {
        assert.ok(Date.parse(e.endedAt) >= Date.parse(e.startedAt));
        assert.ok(e.durationMs >= 0);
      }
      assert.ok(!e.summary.includes(code));
      assert.ok(!e.summary.includes(question));
    }
    const reload = (await a(`/projects/${projectId}`)).data;
    assert.equal(reload.messages.filter(m => m.runId === runId && m.role === "user").length, 1);
    assert.equal(reload.draft.code, code);
    assert.equal(reload.draft.question, question);
    assert.ok(reload.runs.some(r => r.id === runId));
    const stream = await a(`/runs/${runId}/events`, { raw: true });
    assert.match(stream.headers.get("content-type"), /text\/event-stream/);
    assert.match(stream.data, /event: run/);
    assert.ok(stream.data.includes(runId));
    assert.equal((await b(`/runs/${runId}`)).status, 404);
    assert.equal((await b(`/runs/${runId}/events`, { raw: true })).status, 404);
    assert.equal((await b(`/runs/${runId}/retry`, { method: "POST" })).status, 404);
  });
  await t.test("retry preserves run ID and never duplicates the learner message", async () => {
    const retried = await a(`/runs/${runId}/retry`, { method: "POST" });
    assert.equal(retried.status, 202);
    assert.equal(retried.data.id, runId);
    const run = await terminal(a, runId);
    assert.equal(run.attempt, 2);
    assert.ok(["completed", "failed"].includes(run.status));
    assert.ok(run.events.some(e => e.attempt === 2 && e.step === "ai"));
    assert.ok(!run.error?.includes("Simulated AI failure"));
    const reload = (await a(`/projects/${projectId}`)).data;
    assert.equal(reload.messages.filter(m => m.runId === runId && m.role === "user").length, 1);
    assert.ok(reload.messages.filter(m => m.runId === runId && m.role === "assistant").length <= 1);
    if (process.env.RUN_LIVE_AI === "1") {
      assert.equal(run.status, "completed", run.error || "Expected a successful live AI retry");
      assert.equal(reload.messages.filter(m => m.runId === runId && m.role === "assistant").length, 1);
      assert.equal((await a(`/runs/${runId}/displayed`, { method: "POST" })).status, 200);
      assert.equal((await a(`/runs/${runId}/displayed`, { method: "POST" })).data.events.filter(e => e.step === "display").length, 1);
    } else if (run.status === "failed") {
      assert.match(run.error, /AI|integration|provider/i);
      t.diagnostic("Live AI success is not asserted; run with RUN_LIVE_AI=1 after configuring Anthropic.");
    }
  });
});

test("owner-only team access endpoints reject guests", async () => {
  const v = visitor();
  const teamId = randomUUID();
  const inviteId = randomUUID();
  const memberId = "user_not_signed_in";
  assert.equal((await v(`/workspaces/${teamId}/members`)).status, 401);
  assert.equal((await v(`/workspaces/${teamId}/invites`)).status, 401);
  assert.equal((await v(`/workspaces/${teamId}/ownership`, { method: "POST", data: { memberId } })).status, 401);
  assert.equal((await v(`/workspaces/${teamId}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" })).status, 401);
  assert.equal((await v(`/workspaces/${teamId}/invites/${inviteId}`, { method: "DELETE" })).status, 401);
});

test("live custom project planning", { skip: process.env.RUN_LIVE_AI !== "1" }, async () => {
  const v = visitor();
  const created = await v("/projects", { method: "POST", data: { idea: "Build a tiny JavaScript habit tracker with weekly totals.", language: "JavaScript", level: "beginner" } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.project.planSource, "ai");
  assert.ok(created.data.milestones.length >= 2);
});
