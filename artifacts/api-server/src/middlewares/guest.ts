import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "@clerk/express";
import { query, transaction, uid, HttpError, ensurePersonalWorkspace, type ProjectOwner } from "../lib/store";

declare global {
  namespace Express { interface Request { owner: ProjectOwner } }
}
const buckets = new Map<string, { count: number; reset: number }>();
export async function guest(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Cross-site writes are not allowed.");
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host") && new URL(origin).host !== req.get("x-forwarded-host")) {
        throw new HttpError(403, "This request must come from Sparky.");
      }
    }
    const ip = req.ip || "unknown";
    const now = Date.now();
    if (buckets.size > 10000) for (const [key, value] of buckets) if (value.reset < now) buckets.delete(key);
    const bucket = buckets.get(ip);
    if (bucket && bucket.reset > now) {
      bucket.count++;
      if (bucket.count > 300) throw new HttpError(429, "Too many requests. Please wait a minute.");
    } else buckets.set(ip, { count: 1, reset: now + 60000 });
    const userId = getAuth(req).userId;
    let token: unknown = req.cookies?.sparky_guest;
    if (userId) {
      const personalWorkspaceId = await transaction(async c => {
        await c.query("INSERT INTO app_users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [userId]);
        const personalId = await ensurePersonalWorkspace(c, userId);
        if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
          const hash = createHash("sha256").update(token).digest("hex");
          const session = (await c.query("SELECT id FROM guest_sessions WHERE token_hash=$1 AND expires_at>now()", [hash])).rows[0];
          if (session) {
            await c.query(
              "UPDATE projects SET workspace_id=$1,guest_id=NULL,user_id=NULL,created_by=COALESCE(created_by,$2) WHERE guest_id=$3 AND workspace_id IS NULL",
              [personalId, userId, session.id],
            );
          }
        }
        return personalId;
      });
      req.owner = { kind: "user", id: userId, personalWorkspaceId };
      next();
      return;
    }
    if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
      const hash = createHash("sha256").update(token).digest("hex");
      const row = (await query("SELECT id FROM guest_sessions WHERE token_hash=$1 AND expires_at>now()", [hash])).rows[0];
      if (row) {
        req.owner = { kind: "guest", id: row.id };
        next();
        return;
      }
    }
    token = randomBytes(32).toString("hex");
    const guestId = uid();
    await query("INSERT INTO guest_sessions (id,token_hash,expires_at) VALUES ($1,$2,now()+interval '30 days')",
      [guestId, createHash("sha256").update(token as string).digest("hex")]);
    res.cookie("sparky_guest", token, {
      httpOnly: true, secure: req.secure || req.get("x-forwarded-proto") === "https",
      sameSite: "lax", maxAge: 30 * 86400000, path: "/",
    });
    req.owner = { kind: "guest", id: guestId };
    next();
  } catch (err) { next(err); }
}
