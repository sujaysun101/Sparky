---
name: Drizzle check-constraint sync
description: A live PostgreSQL check expression can drift even when Drizzle reports no schema changes.
---

When PostgreSQL rejects a row that satisfies the declared schema, inspect the live check-constraint definition directly. Drizzle's push reported no changes for a mismatched check expression with the same constraint name.

**Why:** The team-project acceptance flow exposed a development database constraint that excluded workspace-owned projects, although the declared schema allowed them.

**How to apply:** Before trusting a no-change result, compare the live constraint to the schema and check existing rows for compatibility. Correct only the development schema mismatch; do not use a test-only application auth bypass.
