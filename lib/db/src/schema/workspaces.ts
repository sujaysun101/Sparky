import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  createdBy: text("created_by").notNull().references(() => appUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  check("workspaces_kind_check", sql`${t.kind} IN ('personal', 'team')`),
  uniqueIndex("workspaces_personal_owner_idx").on(t.createdBy).where(sql`${t.kind} = 'personal'`),
  index("workspaces_creator_idx").on(t.createdBy),
]);

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
  check("workspace_members_role_check", sql`${t.role} IN ('owner', 'member')`),
  index("workspace_members_user_idx").on(t.userId),
]);

export const workspaceInvites = pgTable("workspace_invites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  acceptedBy: text("accepted_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, t => [
  index("workspace_invites_workspace_idx").on(t.workspaceId, t.createdAt),
  check("workspace_invites_expiration_check", sql`${t.expiresAt} > ${t.createdAt}`),
]);
