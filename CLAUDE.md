# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**c4t** — a family chore/task app where parents assign tasks to children who earn **carrots** (virtual currency) for completing them. Carrots are redeemable for parent-defined rewards. The defining mechanics are: a parent/child authority boundary (treat as a security boundary, not a UX preference), a money-like ledger currency, and human approval gates. See `PROJECT_GUIDE.md` for the full product spec and module build order.

## Package manager & monorepo

This is a **Turborepo** monorepo using **bun** (not npm or pnpm).

```bash
# Install all dependencies
bun install

# Run everything in dev mode (all apps in parallel)
bun dev

# Run a specific app
bun dev --filter=web
bun dev --filter=api

# Build, lint, typecheck across all packages
bun run build
bun run lint
bun run typecheck
```

To run scripts scoped to a single workspace:
```bash
cd apps/api && bun dev       # NestJS API on :8000
cd apps/web && bun dev       # Next.js on :3000
```

## Architecture

```
/apps
  /api   → NestJS backend (port 8000)
  /web   → Next.js 16 App Router frontend (port 3000)
/packages
  /ui                  → Shared React component library (shadcn/ui + Tailwind 4 + Radix)
  /eslint-config       → Shared ESLint configs (base, next, react-internal)
  /typescript-config   → Shared tsconfig presets (base, nextjs, nestjs, react-library)
```

### API (`apps/api`)

NestJS modular architecture. CORS is configured to accept `http://localhost:3000` only. Currently has a stub `UsersModule` — this will be replaced by proper domain modules as per the build guide.

New domain modules belong in `apps/api/src/<module>/` following the NestJS pattern: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`.

### Web (`apps/web`)

Next.js App Router. Pages live in `apps/web/app/`. Shared UI components from `@workspace/ui` are imported as:
```ts
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import "@workspace/ui/globals.css"  // in root layout only
```

Local (web-only) components go in `apps/web/components/`. Hooks in `apps/web/hooks/`, utilities in `apps/web/lib/`.

### Shared DB package (`packages/db`)

Prisma 7 setup. Schema is at [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma). The datasource URL is configured in [packages/db/prisma.config.ts](packages/db/prisma.config.ts) (Prisma 7 pattern — `url` is no longer in the schema file).

The generated client lives in `packages/db/generated/prisma/` (gitignored). After cloning or schema changes:
```bash
# Must set DATABASE_URL — prisma generate validates it even for codegen
DATABASE_URL="postgresql://..." bun --filter=db run db:generate
# or from packages/db:
cd packages/db && DATABASE_URL="..." bunx prisma generate
```

Running migrations requires a real PostgreSQL instance:
```bash
cd packages/db && DATABASE_URL="postgresql://..." bunx prisma migrate dev --name <name>
```

`packages/db/src/index.ts` re-exports the `PrismaClient` class and all generated types from the generated client. The `prisma` singleton (with `PrismaPg` adapter) is also exported for non-NestJS consumers. In the NestJS API, `PrismaService` extends `PrismaClient` directly and is a `@Global()` provider — inject it anywhere with `PrismaService`.

### Shared types package (`packages/types`)

Domain enums (`MemberRole`, `TaskStatus`, `LedgerEntryType`, `RedemptionStatus`) defined as `const` objects — structurally identical to what Prisma generates, so they're fully type-compatible with Prisma fields without any casting. Import from `@workspace/types` everywhere, never from `@workspace/db` directly in application code.

### Shared UI package (`packages/ui`)

Exports components, hooks, and utilities via path exports (see `packages/ui/package.json`). Add new shadcn components here, not in `apps/web`. The `cn()` utility is `clsx` + `tailwind-merge`.

## Key architectural rules (from product spec)

- **Authorization is server-side and centralized.** Build one helper that answers "can this user do this in this family" and reuse it everywhere. UI gating is cosmetic only.
- **Carrots are an append-only ledger.** Never store a mutable balance column. Balance = `SUM(amount)` from ledger entries. No floats — integers only.
- **Status transitions that touch the ledger must be atomic** — single DB transaction. No optimistic carrot writes before approval.
- **`Family` is the aggregate root.** Users belong to a family with a role (`PARENT` | `CHILD`). Never model `child.parentId` as a foreign key.
- **Shared domain enums and DTOs belong in a `/packages/types` package** (not yet created). Do not scatter status strings across apps.
- **Store UTC, render local.** Reminders and due dates must respect the child's timezone.
