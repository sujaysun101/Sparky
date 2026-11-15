import { generateJson, guidanceSchema, ProviderFailure } from "./ai";
import { query, transaction, uid } from "./store";
import { logger } from "./logger";

export const workerId = uid();
const active = new Set<string>();
const labels: Record<string, string> = {
  browser: "Learner's browser", validation: "Express validates request", database: "PostgreSQL saves message & loads context",
  ai: "Anthropic generates guidance", response: "Validate & save AI response", display: "Browser displays response",
};
export async function event(runId: string, step: string, status: string, summary: string, attempt: number) {
  const id = uid();
  await query("INSERT INTO run_events (id,run_id,step,label,status,started_at,summary,attempt) VALUES ($1,$2,$3,$4,$5,clock_timestamp(),$6,$7)",
    [id, runId, step, labels[step] || step, status, summary, attempt]);
  return id;
}
export async function finish(id: string, status: string, summary: string) {
  await query("UPDATE run_events SET status=$2,ended_at=clock_timestamp(),duration_ms=GREATEST(0,EXTRACT(EPOCH FROM (clock_timestamp()-started_at))*1000)::integer,summary=$3 WHERE id=$1", [id, status, summary]);
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function launchRun(id: string, simulate: boolean) {
  if (active.has(id)) return;
  active.add(id);
  void processRun(id, simulate).finally(() => active.delete(id));
}
async function processRun(runId: string, simulate: boolean) {
  let stepId: string | undefined;
  let attempt = 1;
  try {
    const run = (await query("SELECT * FROM runs WHERE id=$1", [runId])).rows[0];
    attempt = run.attempt;
    stepId = await event(runId, "database", "running", "Loading only this guest's project, selected task and conversation.", attempt);
    const project = (await query("SELECT title,idea,language,level FROM projects WHERE id=$1", [run.project_id])).rows[0];
    const task = run.task_id ? (await query("SELECT t.title,t.description,t.concepts FROM tasks t JOIN milestones m ON t.milestone_id=m.id WHERE t.id=$1 AND m.project_id=$2", [run.task_id, run.project_id])).rows[0] : null;
    const history = (await query("SELECT role,content FROM tutor_messages WHERE project_id=$1 AND run_id<>$2 ORDER BY created_at DESC LIMIT 8", [run.project_id, runId])).rows.reverse();
    await finish(stepId, "completed", "Learner message is safely stored. Project context and recent conversation loaded.");
    let output: unknown;
    for (let providerAttempt = 0; providerAttempt < 3; providerAttempt++) {
      stepId = await event(runId, "ai", "running", simulate ? "Controlled demo: intentionally failing the AI step before any external request." : "Requesting contextual guidance from Anthropic. Private prompts and code are not included in this trace.", attempt);
      try {
        if (simulate) throw new ProviderFailure("Simulated AI failure (demo). No provider request was sent. Retry this run to make a real AI request.");
        output = await generateJson(
          `You are Sparky, a patient, encouraging coding and CS tutor. Use the supplied project and current task as context.
          Mode hint: give one concise Socratic hint, a useful next step, and NO complete solution or complete code.
          Mode explain: explain simply using the learner's project, and NO complete solution.
          Mode solution: the learner explicitly requests a solution; you may provide a complete solution with explanation.
          Never claim to have run code. Mention relevant safety considerations. Return JSON with fields explanation:string,
          nextStep:string, codeExample?:string (only if mode solution), concepts:string[], commonMistakes:string[],
          nextTopicsToLearn:string[], encouragement:string. Keep the explanation focused and the guidance friendly.`,
          { project, task, history, question: run.question, code: run.code, mode: run.mode },
        );
        await finish(stepId, "completed", "Anthropic returned a response. Its content must be validated before use.");
        break;
      } catch (err) {
        const failure = err instanceof ProviderFailure ? err : new ProviderFailure("The AI request failed. Retry this run.");
        await finish(stepId, failure.retryable && providerAttempt < 2 ? "retrying" : "failed", failure.message);
        if (!failure.retryable || providerAttempt === 2) throw failure;
        const backoffId = await event(runId, "ai", "retrying", `Transient provider failure; retry ${providerAttempt + 1} of 2 after bounded backoff.`, attempt);
        await sleep(1000 * 2 ** providerAttempt);
        await finish(backoffId, "completed", "Backoff finished. Retrying the provider request.");
      }
    }
    stepId = await event(runId, "response", "running", "Checking AI response structure and limits before saving.", attempt);
    const parsed = guidanceSchema.safeParse(output);
    if (!parsed.success) throw new ProviderFailure("The AI response did not match the required format. Nothing was displayed as valid guidance. Retry this run.");
    const guidance = parsed.data;
    // Even a provider instruction failure must not reveal full code in guided modes.
    if (run.mode !== "solution") delete guidance.codeExample;
    await transaction(async c => {
      await c.query("INSERT INTO tutor_messages (id,project_id,run_id,role,content,guidance) VALUES ($1,$2,$3,'assistant',$4,$5) ON CONFLICT (run_id,role) DO NOTHING",
        [uid(), run.project_id, runId, guidance.explanation, JSON.stringify(guidance)]);
      await c.query("UPDATE run_events SET status='completed',ended_at=clock_timestamp(),duration_ms=GREATEST(0,EXTRACT(EPOCH FROM(clock_timestamp()-started_at))*1000)::integer,summary='Response schema validated and one assistant message committed to PostgreSQL.' WHERE id=$1", [stepId]);
      await c.query("UPDATE runs SET status='completed',error=NULL,updated_at=now() WHERE id=$1", [runId]);
    });
  } catch (err) {
    const message = err instanceof ProviderFailure ? err.message : "The request could not be saved. Your original message and code are retained. Retry this run.";
    try {
      await transaction(async c => {
        if (stepId) await c.query("UPDATE run_events SET status='failed',ended_at=clock_timestamp(),duration_ms=GREATEST(0,EXTRACT(EPOCH FROM(clock_timestamp()-started_at))*1000)::integer,summary=$2 WHERE id=$1 AND status IN ('running','retrying')", [stepId, message]);
        await c.query("UPDATE runs SET status='failed',error=$2,updated_at=now() WHERE id=$1", [runId, message]);
      });
    } catch {
      logger.error({ runId, category: "database_unavailable" }, "Unable to persist terminal run state; stale-run recovery will mark it interrupted");
    }
    logger.warn({ runId, attempt, category: err instanceof ProviderFailure ? "provider_failure" : "save_failure" }, "Tutor run failed");
  }
}
