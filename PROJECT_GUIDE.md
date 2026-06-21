# c4t — Parent/Child Reward-Based To-Do App

> Developer build guide. Read this top to bottom before writing code. Modules are ordered by build sequence: each one assumes the ones above it exist. Do not skip ahead — auth and the family model are load-bearing for everything else.

---

## 1. What this product is

A family chore/task app where parents assign tasks to their children, and children earn a virtual currency called **carrots** for completing them. Carrots are redeemable against parent-defined rewards (toys, a movie, a trip). It imitates the real-world "do this and I'll get you that" dynamic, with structure: tasks can require review, review can require a photo/file as proof, and currency is approved and spent through a request/approval loop.

**This is not a generic to-do app.** The defining mechanics are: a parent/child authority boundary, a money-like currency, and human approval gates. Treat carrots as money. Treat the authority boundary as a security boundary.

### Core entities (plain English)
- **Family** — the container. Has many parents and many children. The aggregate root.
- **Parent** — a member with authority. Creates children, tasks, reward options. Reviews and approves.
- **Child** — a member with limited rights. Sees assigned tasks, marks them done, sets their own reminders, requests redemptions.
- **Task** — assigned by a parent to a child. May repeat, may have a due date, may require review, may require a file on review, carries a carrot value.
- **Carrot ledger** — append-only record of every carrot earned, spent, or reversed. Balance is derived, never stored as a mutable number.
- **Reward option** — a parent-defined thing a child can redeem carrots for.
- **Redemption request** — a child asking to spend carrots on a reward option; parent approves or rejects.

---

## 2. Key decisions already made (do not relitigate these mid-build)

These were debated and settled. Changing them later is expensive. If you think one is wrong, raise it before module 2, not during module 6.

1. **Family is the aggregate root.** Many parents, many children per family. Membership is role-based (a user is a member of a family *with a role*), not a foreign key from child to a single parent. This is the single most important schema decision. Building one-parent-owns-child first and migrating later is a multi-week trap. Do it right from the start.

2. **Child authentication uses a claimable invite + federated identity model.**
   - The parent creates the child profile. The child account exists immediately as a real account.
   - The system issues an invite (link or code).
   - The child opens the invite and *claims* the account by either setting a password or linking their own social account.
   - A social login attaches the OAuth `sub` (subject) to the existing child account as a federated identity row. It does not create a second account.
   - **Hard rule: a parent never attaches their own social identity to a child account.** The child links their own. Violating this is an impersonation vulnerability, not a convenience feature.

3. **Reminders are per-user.** In v1, only children set reminders, on their own assigned tasks. Parents do not set reminders in v1. The data model leaves room to add parent reminders later, but do not build them now.

4. **Carrots are an append-only ledger.** Every earn/spend/reversal is an immutable transaction row. A child's balance is `SUM(entries)`, computed, never a column you mutate. A kid who loses carrots will treat it as theft, so you need an audit trail.

5. **File attachments live in S3 (or S3-compatible: R2/MinIO).** Uploads use presigned URLs. Files never pass through your API as blobs and never live in Postgres.

6. **Web only for v1.** Monorepo is structured so a mobile client can slot in later without a backend refactor. Do not build mobile now. Do not pad the schema for it either, beyond keeping the API client-agnostic (which a clean REST/RPC boundary gives you for free).

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | Turborepo (or Nx) | pnpm workspaces. One repo, shared types. |
| Frontend | Next.js (App Router) + shadcn/ui + Tailwind | Two surfaces: parent dashboard, child dashboard. Same app, role-gated. |
| Backend | NestJS | Modular, maps cleanly to the modules below. |
| Database | PostgreSQL | |
| ORM | Prisma | Single schema, shared between API and any type consumers. |
| Auth | See module 2 | Recommend a battle-tested library over hand-rolling. Auth.js (NextAuth) on the web side, or a dedicated provider. Hand-rolled OAuth + sessions for a kids' money app is a bad use of your risk budget. |
| File storage | S3 / Cloudflare R2 | Presigned uploads. |
| Background jobs | BullMQ + Redis | For recurring task generation and reminder dispatch. You will need this by module 6; provision it early. |

### Suggested monorepo layout
```
/apps
  /web        → Next.js (parent + child UI)
  /api        → NestJS
/packages
  /db         → Prisma schema + generated client + migrations
  /types      → shared DTOs / zod schemas / enums
  /config     → eslint, tsconfig, tailwind preset
```
Keep all domain enums (roles, task status, ledger entry type, redemption status) in `/packages/types` and import them everywhere. Stringly-typed status fields scattered across two apps is how this rots.

---

## 4. Build modules, in order

Each module lists: what it delivers, what it depends on, and the traps specific to it.

### Module 0 — Foundation
**Deliver:** Monorepo scaffolded, Turborepo + pnpm running, Next.js and NestJS apps booting, Prisma connected to a local Postgres, shared `/types` package wired, CI running lint + typecheck + test on every push. Dockerized local Postgres + Redis.

**Trap:** Teams skip CI and the shared types package "for now." Both compound into pain by module 4. Set them up while the repo is empty and cheap.

---

### Module 1 — Family & membership model
**Deliver:** The core schema. `User`, `Family`, `FamilyMembership` (join table carrying `role`). A user can belong to a family as PARENT or CHILD. CRUD for creating a family and adding members at the data layer.

**Depends on:** Module 0.

**Schema sketch:**
```
User              id, email?, displayName, createdAt
Family            id, name, createdAt
FamilyMembership  id, userId, familyId, role(PARENT|CHILD), createdAt
                  unique(userId, familyId)
```
Note `email` is nullable — a child may never have one. Authorization throughout the app is "is this user a PARENT member of the family that owns this resource?" Build a single authorization helper for this now and reuse it everywhere. Do not scatter role checks.

**Trap:** Modeling `child.parentId` as a foreign key. You decided against this. A child belongs to a *family*, and parents are members of that family. Resist the shortcut every single time it tempts you.

---

### Module 2 — Authentication & account claiming
**Deliver:** Three flows.
1. **Parent signup/login** — email/password and/or social (Google, etc.). Straightforward.
2. **Parent creates a child** — produces a real child `User` + `FamilyMembership(role=CHILD)` in an `unclaimed` state, plus an invite token.
3. **Child claims account** — opens invite, sets password *or* links a social identity. Linking writes a `FederatedIdentity` row. Subsequent logins resolve provider `sub` → `FederatedIdentity` → `User`.

**Depends on:** Module 1.

**Schema additions:**
```
Credential        userId, passwordHash            (nullable path)
FederatedIdentity id, userId, provider, providerSub, createdAt
                  unique(provider, providerSub)
InviteToken       id, userId, familyId, tokenHash, expiresAt, consumedAt
```
**Traps, in priority order:**
- **The impersonation boundary.** The endpoint that links a social identity to a child must verify the actor is the child claiming via a valid, unconsumed invite — never a parent acting on the child's behalf. Write this test first.
- **Invite tokens are credentials.** Store hashes, expire them, make them single-use, rate-limit redemption.
- **Don't hand-roll OAuth.** Use a library. Your custom code surface for auth should be as small as possible.
- **Session model must carry role + familyId** so downstream authorization is cheap and consistent.

This module is the hardest and the most security-sensitive. Do not rush it to get to the fun parts. Everything downstream trusts it.

---

### Module 3 — Reward options & the carrot ledger (currency core)
**Deliver:** The ledger and the reward catalog — *before* tasks, because tasks pay into the ledger and you want the money primitive solid first.

**Depends on:** Modules 1–2.

**Schema:**
```
LedgerEntry   id, familyId, childUserId, type(EARN|SPEND|REVERSAL|ADJUST),
              amount(int, signed), sourceType, sourceId, note, createdById, createdAt
RewardOption  id, familyId, title, description, costCarrots, isActive, createdById
```
**Rules:**
- Balance = `SUM(amount)` for a child. Never store a balance column. If performance ever demands it, add a *cached* projection you can rebuild from the ledger — but not in v1.
- Every entry references its source (`sourceType`/`sourceId`): a task completion, a redemption, a manual adjustment. This is your audit trail.
- Amounts are integers. No floats for currency, ever.
- Spends and reversals are entries too, not deletions. Nothing in this table is ever mutated or deleted.

**Trap:** The temptation to "just add a `carrots` integer to the child for speed." That decision was already rejected. A mutable balance with no history is unauditable and unrecoverable when a dispute happens, and disputes are the whole emotional point of this app.

---

### Module 4 — Tasks (assignment, no lifecycle yet)
**Deliver:** Parents create tasks and assign them to a child in the family. Single, non-repeating tasks first. Due date, carrot value, `requiresReview` flag, `requiresFileOnReview` flag. Child can view tasks assigned to them.

**Depends on:** Modules 1–3.

**Schema:**
```
Task          id, familyId, assignedToUserId, createdById, title, description,
              dueAt?, carrotValue, requiresReview(bool), requiresFileOnReview(bool),
              status, recurrenceRuleId?, createdAt
```
**Permission rules (enforce server-side, not just in UI):**
- Only a PARENT in the family can create/edit/delete a task.
- A CHILD can read tasks assigned to them and can transition status (next module). A child can **never** edit a task's content, value, or flags.

**Trap:** Enforcing "child can't edit" only by hiding buttons in the UI. The API must reject it. Assume the child will open dev tools — kids do.

---

### Module 5 — Task lifecycle, review, and earning carrots
**Deliver:** The status machine that ties tasks to the ledger.

**Depends on:** Module 4 (and the module 3 ledger).

**Status flow:**
```
ASSIGNED → child marks done → 
   if !requiresReview:  COMPLETED  → EARN entry written immediately
   if requiresReview:   PENDING_REVIEW → parent approves → COMPLETED → EARN entry
                                       → parent rejects  → back to ASSIGNED (with note)
```
- If `requiresFileOnReview`, the child cannot move into PENDING_REVIEW without an attached file (see module 7 for the upload; sequence-wise you can stub the attachment requirement here and wire real S3 in module 7, or do 7 first if you prefer).
- The EARN ledger entry is written **only** at the COMPLETED transition, in the **same database transaction** as the status change. Never write carrots optimistically before approval.

**Traps:**
- **Double-credit.** If a parent approves twice, or the request is retried, you must not write two EARN entries. Make the transition idempotent: guard on current status inside the transaction.
- **Status + ledger must be atomic.** A crash between "mark completed" and "write carrots" must not leave a completed task with no payout, or carrots with no task. One DB transaction.

---

### Module 6 — Recurrence & reminders
**Deliver:** Repeating tasks and child-set reminders.

**Depends on:** Module 5, plus BullMQ/Redis from module 0.

- **Recurrence:** store a recurrence rule (RRULE-style is fine). A scheduled job materializes the next concrete `Task` instance when due. Do not generate infinite future instances up front — generate the next occurrence on a rolling basis.
- **Reminders:** per-user, child-only in v1. A child adds reminders to their own assigned task; a scheduled job dispatches them (email/push later). Model leaves room for parent reminders but you are not building them.

**Schema:**
```
RecurrenceRule  id, rule(rrule string), startAt, endAt?
Reminder        id, taskId, userId, remindAt, channel, sentAt?
```
**Traps:**
- Recurrence + carrots: each materialized instance is its own task with its own payout. Don't let one recurring definition pay out repeatedly off a single completion.
- Timezones. Store UTC, render local. Families can span zones; "due tomorrow" must mean the child's tomorrow.
- Idempotent job runs. A reminder job that retries must not send three copies.

---

### Module 7 — File attachments (S3 presigned)
**Deliver:** Real file upload for review-gated tasks.

**Depends on:** Module 5.

**Flow:** client requests a presigned upload URL from the API → uploads directly to S3 → posts the resulting object key back to the API → API stores an `Attachment` row linked to the task. Downloads/views use presigned GET URLs, time-limited.

**Schema:**
```
Attachment  id, taskId, uploadedByUserId, s3Key, contentType, sizeBytes, createdAt
```
**Traps:**
- Validate content type and size **server-side at presign time**, and ideally re-check after upload. A presigned URL the client controls is a hole if you trust client-declared type/size blindly.
- Never expose the bucket publicly. Always presign reads.
- Scope access: only family members tied to that task can fetch the file.

---

### Module 8 — Redemptions (spending carrots)
**Deliver:** The request/approval loop for spending.

**Depends on:** Modules 3 (ledger) and 2 (auth/roles).

**Flow:**
```
child requests redemption of RewardOption →
   REQUESTED → parent approves → check balance ≥ cost (server-side, from ledger sum)
                               → write SPEND entry (negative) in a transaction → APPROVED
             → parent rejects  → REJECTED, no ledger change
```
**Schema:**
```
RedemptionRequest  id, familyId, childUserId, rewardOptionId, costAtRequest,
                   status(REQUESTED|APPROVED|REJECTED|CANCELLED), decidedById, createdAt, decidedAt
```
**Traps:**
- **Balance check at approval time, inside the transaction**, computed from the ledger — not from a cached number, not from the balance shown when the child requested. Carrots may have moved.
- **Snapshot the cost at request** (`costAtRequest`) so a parent editing the reward's price later doesn't retroactively change a pending request, but **re-verify funds against live balance at approval**.
- No negative balances, ever. The SPEND that would push below zero must be rejected atomically.

---

### Module 9 — Dashboards & polish
**Deliver:** The two real UIs.
- **Parent:** family overview, children, create/assign tasks, review queue (with file preview), reward catalog, redemption approvals, ledger view per child, manual carrot adjustments.
- **Child:** my tasks (by status), mark done / upload proof, my carrot balance + history, reward catalog, request redemption, my reminders.

**Depends on:** everything above.

**Trap:** Treating this as "just frontend." The review queue and redemption approvals are where the authority boundary is most visible to users; get the empty states, the rejection-with-reason flows, and the balance-history clarity right. This is the product, not chrome.

---

## 5. Cross-cutting rules (apply in every module)

- **Authorization is server-side and centralized.** One helper answers "can this user do this to this resource in this family." UI gating is cosmetic and never trusted.
- **Carrots are integers, in a transaction, in a ledger.** No floats, no mutable balances, no deletes.
- **State transitions that touch carrots are atomic and idempotent.** Assume retries and double-clicks.
- **The parent/child boundary is a security boundary**, not a UX preference. Test it adversarially.
- **Store UTC. Render local.**
- **Shared enums and DTOs live in `/packages/types`** and are imported by both apps.

---

## 6. Suggested milestone order (for planning, not just building)

1. M0 Foundation + M1 Family model + M2 Auth → you have accounts and the authority boundary. *This is the hard half. Do not underestimate it.*
2. M3 Ledger + M4 Tasks + M5 Lifecycle → the core loop earns carrots.
3. M7 Attachments + M8 Redemptions → the full economy closes.
4. M6 Recurrence/Reminders + M9 Dashboards → it becomes a real product.

You can ship a usable internal alpha after step 2. Resist demoing before auth (M2) is solid — a broken authority boundary in a kids' money app is the one bug you cannot ship.

---

## 7. Honest risk callouts

- **Auth is your biggest risk and your least glamorous module.** The child-claiming + federated-identity flow is genuinely fiddly and security-critical. Budget more time than feels reasonable. Use libraries.
- **The ledger feels like over-engineering until the first dispute.** It isn't. Build it as specified.
- **"Web first, mobile later" only stays cheap if the API stays a clean client-agnostic boundary.** The moment you leak Next.js server-side assumptions into business logic, mobile gets expensive. Keep domain logic in NestJS, not in Next route handlers.
- **Scope creep magnet: notifications.** Email/push/SMS reminders can swallow weeks. v1 reminders can be in-app only. Decide the channel scope explicitly before module 6 instead of discovering it.
