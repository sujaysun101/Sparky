import { pgTable, text, timestamp, integer, boolean, jsonb, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appUsers, workspaces } from "./workspaces";

export const guestSessions = pgTable("guest_sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").references(() => guestSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => appUsers.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: text("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  idea: text("idea").notNull(),
  language: text("language").notNull(),
  level: text("level").notNull(),
  planSource: text("plan_source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("projects_guest_idx").on(t.guestId),
  index("projects_user_idx").on(t.userId),
  index("projects_workspace_idx").on(t.workspaceId),
  check("projects_single_owner_check", sql`num_nonnulls(${t.guestId}, ${t.userId}, ${t.workspaceId}) = 1`),
]);
export const milestones = pgTable("milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull(),
});
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  milestoneId: text("milestone_id").notNull().references(() => milestones.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  concepts: jsonb("concepts").notNull(),
  completed: boolean("completed").notNull().default(false),
  position: integer("position").notNull(),
});
export const drafts = pgTable("drafts", {
  projectId: text("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  code: text("code").notNull().default(""),
  question: text("question").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  inputHash: text("input_hash").notNull(),
  question: text("question").notNull(),
  code: text("code").notNull(),
  mode: text("mode").notNull(),
  taskId: text("task_id"),
  status: text("status").notNull().default("running"),
  error: text("error"),
  attempt: integer("attempt").notNull().default(1),
  simulated: boolean("simulated").notNull().default(false),
  workerId: text("worker_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("runs_idempotency_idx").on(t.projectId, t.idempotencyKey)]);
export const tutorMessages = pgTable("tutor_messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  guidance: jsonb("guidance"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("messages_run_role_idx").on(t.runId, t.role)]);
export const runEvents = pgTable("run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  step: text("step").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  summary: text("summary").notNull(),
  attempt: integer("attempt").notNull(),
  details: jsonb("details"),
}, t => [index("events_run_idx").on(t.runId)]);
