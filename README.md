# TaskFlow AI - Private SaaS Enterprise Core

TaskFlow AI is a robust multi-tenant task and project management SaaS backend application built using Node.js 20, TypeScript, Express, PostgreSQL, and Prisma.

## Key Features

1. **Authentication:** Full JWT Auth lifecycle including registration, login, token refresh, and system/tenant roles.
2. **Organization Multi-Tenancy:** Role inheritance permissions checks (Owner, Admin, Member, Guest).
3. **Advanced Project/Task Engine:** Support priorities, due dates, statuses, labels, and assignment workflows.
4. **Sprint Planning:** Agile sprint lifecycle (planned → active → completed/cancelled) with a single-active-sprint invariant, task roll-over on completion, and burndown-style summaries.
5. **Transaction-Aware Event-Publisher:** Publishes Domain Events in-process to decouple audits, notifications, and search.
6. **Redis Cache Layer:** Ultra-fast metrics fetching and key decorator caches.
7. **Self-Contained AI Module:** Simulates robust LLM actions including latencies, billing accounting, and failure retries.
8. **Search Indexing:** Asynchronous in-app indexing.
9. **Background Jobs Engine:** Integrated runner executing analytics refresh, search index optimization, notification cleanup, and archival maintenance.
10. **Mock Integrations:** Clean abstractions and local drivers for Email, Webhooks, and Identity SSO providers.

## Tech Stack

* **Runtime:** Node.js v20+
* **Compiler:** TypeScript v5
* **Framework:** Express
* **Database:** PostgreSQL & Redis
* **ORM:** Prisma
* **Testing:** Vitest
* **Package Manager:** pnpm

## Setup & Running

1. **Start Services via Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Run Migrations & Seed Data:**
   ```bash
   pnpm prisma:migrate
   pnpm prisma:seed
   ```

3. **Start Development Server:**
   ```bash
   pnpm dev
   ```

4. **Execute Tests:**
   ```bash
   pnpm test
   ```

5. **Execute Background Jobs Manually:**
   Manually trigger all registered background jobs via administrative endpoints:
   ```bash
   curl -X POST http://localhost:3000/api/jobs/run-all -H "Authorization: Bearer <ADMIN_JWT>"
   ```
