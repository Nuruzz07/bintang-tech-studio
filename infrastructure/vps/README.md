# infrastructure/vps

Process definitions and operational safety rules for VPS-hosted backend services.

## Dedicated Service Processes

The following services are executed as isolated Node processes managed by PM2 on the VPS:

1. `bintang-api` (REST API service)
2. `bintang-worker` (Background job & outbox processor)
3. `bintang-bot` (Telegram Bot Engine daemon)
4. `bintang-webhook` (Inbound provider webhooks)

---

## CRITICAL SAFETY RULES (INFRA-07)

> [!CAUTION]
> **NEVER EXECUTE GLOBAL PM2 COMMANDS ON SHARED VPS INFRASTRUCTURE.**

1. **Strictly Forbidden:**
   ```bash
   # DO NOT EXECUTE:
   pm2 restart all
   pm2 delete all
   pm2 stop all
   ```
2. **Mandatory Scoped Syntax:**
   All PM2 commands must explicitly specify the process name:
   ```bash
   pm2 restart bintang-api
   pm2 restart bintang-worker
   pm2 restart bintang-bot
   ```
3. **Protection of Existing Services:**
   - The existing service `abang-gtc` runs on the same infrastructure and must remain completely untouched and isolated.
