import { test } from "node:test";
import assert from "node:assert/strict";
import { hasTeamOwnerAccess } from "../src/lib/workspace-access.ts";

test("workspace access requires an owner membership in a team", () => {
  assert.equal(hasTeamOwnerAccess({ kind: "team", role: "owner" }), true);
  assert.equal(hasTeamOwnerAccess({ kind: "team", role: "member" }), false);
  assert.equal(hasTeamOwnerAccess({ kind: "personal", role: "owner" }), false);
  assert.equal(hasTeamOwnerAccess(undefined), false);
});
