# Bintang Tech Studio — Disaster Recovery & Rollback Runbook

## Version: 1.0 (Milestone M15)

This document establishes the recovery protocols, backup procedures, rollback runbooks, and incident response boundaries for the Bintang Tech Studio production pilot.

---

## 1. BACKUP STRATEGY & CADENCE

### 1.1 PostgreSQL Database Backups (Supabase: `nowyzlyruzlokiejvtne`)

- **Automated Snapshots:** Supabase daily physical base backups retained across standard retention windows.
- **Continuous Archiving:** Write-Ahead Logging (WAL) archiving enabled for point-in-time recovery (PITR).
- **Pre-Pilot Manual Logical Dump:** Before deploying migrations or pilot seed data, take a logical schema + data dump:
  ```bash
  # Secure logical export of public schema
  pg_dump "postgresql://postgres:[PASSWORD]@db.nowyzlyruzlokiejvtne.supabase.co:5432/postgres" \
    --schema=public \
    --format=custom \
    --file="backup_pilot_predeploy_$(date +%Y%m%d_%H%M%S).dump"
  ```

### 1.2 Target Recovery Metrics (Status: TBD)

- **RPO (Recovery Point Objective):** Formally marked **TBD** until active staging/pilot benchmark measurements are executed under production load.
- **RTO (Recovery Time Objective):** Formally marked **TBD** until restore drills are timed against the target infrastructure.

---

## 2. RESTORE PROCEDURE

### 2.1 Full Database Restore from Logical Backup

```bash
# 1. Terminate active application connections to prevent partial writes
# In Supabase Dashboard or psql:
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid();

# 2. Restore schema and data from custom dump
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="postgresql://postgres:[PASSWORD]@db.nowyzlyruzlokiejvtne.supabase.co:5432/postgres" \
  backup_pilot_predeploy_YYYYMMDD_HHMMSS.dump
```

### 2.2 Point-In-Time Recovery (PITR)

1. Navigate to Supabase Project Settings -> Database -> Backups.
2. Select target recovery timestamp prior to the incident.
3. Trigger PITR clone/restore.
4. Update `DATABASE_URL` / `SUPABASE_URL` connection strings if a new database instance is provisioned.

---

## 3. APPLICATION ROLLBACK PROTOCOL

If a deployed pilot version introduces critical defects:

### Step 1: Revert Git Commit on VPS

```bash
cd /opt/bintang-tech-studio
git status  # verify no dirty files
git checkout tags/v-pilot-baseline  # or specific known-good commit hash
```

### Step 2: Rebuild & Reinstall Dependencies

```bash
npm ci
npm run build
```

### Step 3: Scoped PM2 Process Reload

> [!CAUTION]
> **DO NOT RUN `pm2 restart all` or `pm2 delete all`. Protect `abang-gtc`!**

```bash
pm2 reload bintang-api --update-env
pm2 reload bintang-worker --update-env
pm2 reload bintang-bot --update-env
```

### Step 4: Health Verification

```bash
curl -f http://127.0.0.1:4000/health/readiness || echo "Rollback health check failed!"
```

---

## 4. DATABASE MIGRATION ROLLBACK PROTOCOL

- In Bintang Tech Studio, all database schema migrations in `database/migrations/` are forward-compatible and additive where possible.
- **Zero Migrations in M15:** M15 requires 0 new migrations because M02 schema is completely sufficient.
- If a future migration must be rolled back:
  1. Inspect the migration SQL file for explicit down-steps.
  2. Verify that dropping columns/constraints does not break running services.
  3. Execute transactional SQL rollback scripts only in maintenance mode.

---

## 5. SECRET ROTATION RUNBOOK

### 5.1 Supabase Service Role & Anon Keys

1. Generate new API keys in Supabase Dashboard (API settings).
2. Update `/opt/bintang-tech-studio/.env.production` on VPS with `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Reload API and worker processes:
   ```bash
   pm2 reload bintang-api --update-env
   pm2 reload bintang-worker --update-env
   ```
4. Verify `/health/readiness`.
5. Revoke old keys in Supabase Dashboard.

### 5.2 Telegram Bot Tokens

1. Request new token via `@BotFather`.
2. Update `TELEGRAM_BOT_TOKEN` in VPS environment.
3. Reload bot engine:
   ```bash
   pm2 reload bintang-bot --update-env
   ```
4. Verify `/start` responds.

### 5.3 Webhook Secrets (Payment Provider)

1. Rotate webhook secret in provider merchant dashboard (Tipzy/Midtrans).
2. Update `PAYMENT_WEBHOOK_SECRET` in VPS environment.
3. Reload webhook receiver:
   ```bash
   pm2 reload bintang-api --update-env
   ```

---

## 6. INCIDENT RESPONSE BOUNDARY

- **P0 Incidents (Data breach, cross-tenant leak, financial discrepancy):**
  - Immediate action: Set store status to `SUSPENDED` via Owner Console or database update:
    ```sql
    UPDATE public.stores SET status = 'SUSPENDED' WHERE id = '<store_id>';
    ```
  - Stop affected ingress processes: `pm2 stop bintang-api`, `pm2 stop bintang-bot`.
  - Isolate logs and audit entries from `security_events` and `activity_logs`.
- **P1 Incidents (Worker stuck, provider API downtime):**
  - Worker will automatically retry jobs up to `max_attempts` (3) before moving to `FAILED`.
  - Check `public.jobs` for error messages:
    ```sql
    SELECT id, job_type, attempts, error FROM public.jobs WHERE status = 'FAILED';
    ```
