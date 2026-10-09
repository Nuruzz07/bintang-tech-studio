# Bintang Tech Studio — Production Pilot Operational Runbook

## Version: 1.0 (Milestone M15)

This runbook defines the operational contracts, execution procedures, and safety boundaries for the Bintang Tech Studio VPS runtime plane.

---

## 1. ARCHITECTURE & SERVICE TOPOLOGY

```
Internet
   │
   ▼
Cloudflare (WAF, SSL termination, DDoS defense)
   │
   ├──▶ Vercel Edge / Frontends (Customer Store, Seller Dashboard, Owner Console)
   │
   └──▶ VPS Runtime (Reverse proxy: Nginx)
           ├── bintang-api      (Node.js REST API & Edge Proxy)
           ├── bintang-worker   (Background Outbox & Durable Job Processor)
           ├── bintang-bot      (Telegram Bot Engine daemon)
           └── bintang-webhook  (Inbound Provider Webhook Ingress)
                   │
                   ▼
         Supabase PostgreSQL (nowyzlyruzlokiejvtne)
         - RLS isolation
         - Composite foreign keys
         - Invariant constraints
```

---

## 2. STRICT PM2 SAFETY MANDATE (INFRA-07)

> [!CAUTION]
> **NEVER EXECUTE GLOBAL PM2 COMMANDS ON THIS SERVER.**
> A preexisting production service (`abang-gtc`) runs on this host.
> Running global process commands will kill or restart `abang-gtc`, causing an immediate production outage.

### Strictly Forbidden Commands

```bash
# FORBIDDEN — DO NOT RUN UNDER ANY CIRCUMSTANCES
pm2 restart all
pm2 stop all
pm2 delete all
pm2 reload all
pm2 kill
```

### Mandatory Scoped Process Syntax

Always explicitly target the specific service name:

```bash
# Permitted and Required:
pm2 restart bintang-api
pm2 restart bintang-worker
pm2 restart bintang-bot
pm2 restart bintang-webhook

# Status and inspection:
pm2 status bintang-api
pm2 logs bintang-api --lines 100
```

---

## 3. PROCESS DEFINITIONS & CONTRACTS

| Service Name      | Description                             | Entry Point                         | Memory Limit | Restart Policy                          |
| :---------------- | :-------------------------------------- | :---------------------------------- | :----------- | :-------------------------------------- |
| `bintang-api`     | Public REST API & Seller Management API | `services/api/dist/index.js`        | 512MB        | `max-restarts: 10`, exponential backoff |
| `bintang-worker`  | Durable jobs & transactional outbox     | `services/worker/dist/index.js`     | 256MB        | `max-restarts: 10`, exponential backoff |
| `bintang-bot`     | Telegram Bot Engine webhook/polling     | `services/bot-engine/dist/index.js` | 256MB        | `max-restarts: 10`, exponential backoff |
| `bintang-webhook` | Ingress for payment/channel webhooks    | `services/api/dist/webhook.js`      | 256MB        | `max-restarts: 10`, exponential backoff |

---

## 4. HEALTH CHECK & READINESS ENDPOINTS

Every service exposes standardized JSON health endpoints:

### Liveness Probe (`GET /health/liveness`)

- Verifies process is alive and event loop is responding.
- Expected HTTP Status: `200 OK`
- Format:
  ```json
  { "status": "UP", "timestamp": "2026-10-08T12:00:00Z" }
  ```

### Readiness Probe (`GET /health/readiness`)

- Performs active upstream dependency checks (PostgreSQL connectivity via `ping()`).
- Expected HTTP Status:
  - `200 OK` if all critical dependencies are `UP`.
  - `503 Service Unavailable` if PostgreSQL or critical dependency is `DOWN`.
- Format:
  ```json
  {
    "status": "UP",
    "version": "0.1.0",
    "uptimeSeconds": 1420,
    "components": {
      "database": {
        "name": "database",
        "status": "UP",
        "isCritical": true,
        "latencyMs": 18
      }
    }
  }
  ```

---

## 5. STANDARD DEPLOYMENT PROCEDURE (ZERO-DOWNTIME PILOT)

1. **Pre-flight Check:**
   - Verify working tree is clean.
   - Run typecheck, lint, and tests:
     ```bash
     npm run typecheck
     npm run test
     ```
2. **Build Release Artifacts:**
   ```bash
   npm run build
   ```
3. **Scoped Service Deployment:**
   Deploy sequentially to prevent concurrent restarts:
   ```bash
   pm2 reload bintang-api --update-env
   pm2 reload bintang-worker --update-env
   pm2 reload bintang-bot --update-env
   ```
4. **Post-Deployment Verification:**
   - Verify health endpoints return `200 OK`.
   - Inspect logs for errors:
     ```bash
     pm2 logs bintang-api --lines 50 --nostream
     ```

---

## 6. LOGGING & OBSERVABILITY

- Logs are emitted to `stdout`/`stderr` as newline-delimited JSON.
- Every request carries `requestId` and optional `correlationId`.
- Sensitive fields (`password`, `token`, `secret`, `credit_card`) are automatically redacted by `@bintang/observability`.
- Security anomalies are logged with `[SECURITY:HIGH]` or `[SECURITY:CRITICAL]` prefixes.
