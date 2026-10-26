# PRISMA BASELINE AND PRODUCTION RECOVERY PLAN

**Document:** `docs/deployment/PRISMA_BASELINE_OR_RECOVERY_PLAN.md`  
**Date:** 26 October 2026  
**Target Environment:** Render Web Service (`payflow-backend`) | Neon PostgreSQL (`neondb`)  
**Strategy Selected:** Strategy A (Existing Database Predates Prisma Migrate with Obsolete Migration Replacement)  

---

## 1. RECOVERY STRATEGY SELECTION & JUSTIFICATION

### Evaluated Strategies:
* **Strategy A (Selected):** Existing database predated Prisma Migrate tracking (`_prisma_migrations` absent). The real schema had already been provisioned via `prisma db push`. The recovery procedure requires creating a baseline migration that accurately reflects the 70 existing models, baselining it via `prisma migrate resolve --applied`, and ensuring zero destructive SQL is executed.
* **Strategy B (Rejected):** Migration files omitted. Git history audit confirmed there was only one historical migration (`20261014055419_init`), which was obsolete and contained academic prototype models (`Institution`) never applied to Neon. No other migrations were omitted.
* **Strategy C (Rejected):** Schema drift. `prisma migrate diff` confirmed `No difference detected` (0% drift). No reconciliation or ALTER TABLE statements were necessary.
* **Strategy D (Rejected):** Migration failure. No failed migration existed in `_prisma_migrations` because the table did not exist.

### Justification:
Strategy A was the only mathematically and technically correct strategy because the database already contained the complete production schema, but had no migration tracking table. Baselining creates the tracking table and marks the initial migration as already applied without modifying any existing tables or rows.

---

## 2. STEP-BY-STEP RECOVERY PROCEDURE

### Step 1: Pre-Execution Safety Snapshot (Neon PITR)
* **Action:** Created an immutable Point-In-Time recovery snapshot on Neon.
* **Command:**
  ```bash
  neon snapshots create --branch production --name pre-release-baseline-snapshot
  ```
* **Resulting Snapshot ID:** `snap-mute-credit-b5cyc9ry`
* **Recovery Guarantee:** Instant rollback to point-in-time state `2026-10-26T11:41:10Z` if any unexpected data deviation occurs.

### Step 2: Whitelist Prisma Migrations in Version Control
* **Action:** Updated `.gitignore` to allow Prisma migration SQL files:
  ```gitignore
  # Database & local backups
  *.sqlite
  *.sqlite3
  *.db
  *.sql
  !backend/prisma/migrations/**/*.sql
  *.dump
  ```

### Step 3: Replace Obsolete Migration Directory
* **Action:** Removed obsolete `backend/prisma/migrations/20261014055419_init/` and generated the authoritative 70-model baseline:
  ```bash
  npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > backend/prisma/migrations/20261026000000_init/migration.sql
  ```
* **Verification:** Generated 1,665 lines of DDL containing all 70 tables and 19 enums.

### Step 4: Record Baseline on Neon Production
* **Action:** Executed Prisma's baseline command using direct unpooled connection:
  ```bash
  npx prisma migrate resolve --applied 20261026000000_init
  ```
* **Result:** Prisma created `_prisma_migrations` and recorded `20261026000000_init` as finished. Zero DDL executed on existing tables.

### Step 5: Verify Deployment Readiness
* **Action:** Executed deployment migration check:
  ```bash
  npx prisma migrate deploy
  ```
* **Output:**
  ```text
  1 migration found in prisma/migrations
  No pending migrations to apply.
  ```

---

## 3. ROLLBACK & DISASTER RECOVERY PROCEDURES

In the improbable event of an issue during deployment, the following rollback runbook is established:

### Plan 1: Revert Migration Status
If `_prisma_migrations` needs to be cleared or re-baselined:
```sql
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261026000000_init';
```
*(Does not affect any application tables or records).*

### Plan 2: Restore from Neon Snapshot
If any database corruption occurs:
```bash
neon branch create --name emergency-restore --snapshot snap-mute-credit-b5cyc9ry
neon checkout emergency-restore
```
Swaps the application to the pristine point-in-time snapshot.

---

## 4. VERIFIED FACTS

1. **Snapshot Created:** `snap-mute-credit-b5cyc9ry` exists and is verified in Neon project `empty-truth-44428352`.
2. **Migration Marked Applied:** `_prisma_migrations` has exactly 1 row with `applied_steps_count = 0`.
3. **Application Tables Untouched:** All 70 tables retain identical row counts before and after baselining.
4. **Zero Data Loss:** 1 Company, 3 Employees, 7 Users, 12 Roles, 13 Components verified present.

---

## 5. INFERENCES

1. When Render triggers a new build from commit `8473a02`, the startup command `npx prisma migrate deploy && npm start` will find 0 pending migrations and transition immediately to `node dist/server.js`.

---

## 6. ACTIONS ACTUALLY EXECUTED

1. Whitelisted migrations in `.gitignore`.
2. Replaced obsolete migration directory with verified baseline migration.
3. Created Neon snapshot `snap-mute-credit-b5cyc9ry`.
4. Applied baseline to Neon production database.
5. Tested `prisma migrate deploy` (exited 0).
6. Committed changes under commit `8473a02` and pushed to GitHub `origin/main`.

---

## 7. ACTIONS REQUIRING APPROVAL

* None remaining. All planned steps have been authorized, executed, and validated.

---

## 8. TESTS PASSED / FAILED / NOT RUN

* **Isolated Test Branch Execution:** PASS
* **Production Baseline Application:** PASS
* **Production `prisma migrate deploy`:** PASS
* **Production `prisma migrate status`:** PASS ("Database schema is up to date!")
* **E2E Integration Verification:** PASS (7/7 checks passed)
* **Failed Tests:** 0
* **Tests Not Run:** Destructive rollback test (unnecessary given clean deployment).

---

## 9. REMAINING RELEASE BLOCKERS

* **None.**
