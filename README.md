# DataMind

**Ask your database in plain English.**

DataMind turns natural-language questions into PostgreSQL queries, validates them independently, executes them against a real Supabase PostgreSQL database, and presents the returned data with SQL and supported visualizations.

The database is the source of truth. The LLM translates the question into SQL; it does not invent database results.

## What DataMind provides

- Natural-language database querying
- Role-aware SQL generation
- Independent server-side SQL validation
- Real-time execution against Supabase PostgreSQL
- Explicit confirmation before privileged writes
- Automatic bar, line, and pie visualization when the returned data supports it
- SQL inspection and result-table views
- Role-based CSV export for HR/Manager users
- Owner workspace for account management, database inspection, and audit activity
- Signed server-side sessions with inactivity expiry
- Audit logging for important database and account operations

## Roles and authorization

DataMind currently has three application roles:

| Role | Database access | Write access | Owner workspace | CSV export |
|---|---|---|---|---|
| **Owner** | Read + privileged operations | Yes | Yes | Yes |
| **HR/Manager** | Read + approved writes | Yes | No | Yes |
| **Employee** | Read-only | No | No | No |

Authorization is derived from the verified server-side session. The client cannot choose a role to obtain additional privileges.

### Authorization flow

```
Login
  ↓
Role-specific credential verification
  ↓
Signed session cookie
  ↓
Server verifies session + role
  ↓
Role-aware SQL generation
  ↓
Independent SQL validation
  ↓
Read → execute immediately
Write → show SQL → explicit confirmation
  ↓
Supabase PostgreSQL
  ↓
Real rows → table / supported chart
```

For owner operations, the flow is additionally protected by an owner-only route check and server-side role verification.

## Core architecture

```
app/
  layout.tsx
  page.tsx
  login/page.tsx
  owner/page.tsx

  api/
    auth/
      login/route.ts
      logout/route.ts
      me/route.ts
      heartbeat/route.ts
    query/route.ts
    query/confirm/route.ts
    owner/route.ts
    health/route.ts

components/
  Navigation.tsx
  Hero.tsx
  HowItWorks.tsx
  QueryInterface.tsx
  SuggestedQuestions.tsx
  SQLViewer.tsx
  ResultView.tsx
  ResultTable.tsx
  ChartRenderer.tsx
  Examples.tsx
  VisualizationSection.tsx
  SessionGuard.tsx
  ThemeToggle.tsx

lib/
  auth/session.ts
  database/supabase.ts
  llm/groq.ts
  sql/schema.ts
  sql/validator.ts
  visualization/engine.ts
  csv.ts
  ask-bridge.ts

types/
  auth.ts
  database.ts
  query.ts
  visualization.ts

middleware.ts
setup.sql
auth_setup.sql
managing-accounts.md
```

## Natural language → SQL

The LLM is accessed through Groq using the configured `GROQ_MODEL`, currently intended for `openai/gpt-oss-120b`.

The verified database schema is supplied by `lib/sql/schema.ts`. The application uses role-aware prompting so that the generated SQL reflects the authenticated user's permissions.

The model is instructed to return structured JSON containing:

```json
{
  "sql": "...",
  "explanation": "..."
}
```

The generated SQL is not trusted. It passes through the independent application validator before execution.

## SQL validation

`lib/sql/validator.ts` is the application's primary SQL safety boundary.

Validation includes:

- statement-type checks
- maximum query length
- multiple-statement detection
- dangerous PostgreSQL function detection
- forbidden administrative/privilege operations
- role-aware write restrictions
- protection against unrestricted `UPDATE`/`DELETE`
- restrictions on DataMind system tables for non-owner roles
- additional checks for SQL comments and suspicious control sequences

The authenticated role is taken from the verified session, not from the request body.

### Read requests

Employee, HR/Manager, and Owner read requests are validated before being sent to the read-only database RPC.

### Write requests

HR/Manager and Owner write requests do not execute immediately from the initial query route.

The generated SQL is returned as a pending operation. The user reviews it and explicitly chooses **Confirm & Run**. The confirmation route validates the SQL again and only then calls the privileged database RPC.

## Database-level defense in depth

DataMind does not rely solely on application code.

### `setup.sql`

Creates:

`execute_readonly_sql(query text)`

This function:

- accepts only `SELECT`/ `WITH` statements
- rejects multiple statements
- applies an 8-second statement timeout
- is callable only by `service_role`

### `auth_setup.sql`

Creates the authentication/account tables:

- `owner_users`
- `hr_manager_users`
- `employee_users`
- `audit_logs`

It also creates:

- `hash_datamind_password()`
- `verify_owner_login()`
- `verify_hr_manager_login()`
- `verify_employee_login()`
- `execute_privileged_sql()`

Account tables and management functions are restricted from browser roles.

The privileged SQL RPC applies its own statement-type and dangerous-operation checks and is granted only to `service_role`. The application must independently verify the authenticated role before calling it.

## Authentication and sessions

Authentication uses separate role-specific account tables rather than a shared username/password table with a client-controlled role.

Passwords are stored as PostgreSQL `crypt()` hashes.

After successful login, DataMind creates a signed stateless session cookie containing:

- username
- role
- workforce ID where applicable
- issued-at timestamp
- expiry timestamp

The session is signed with HMAC-SHA256 using `SESSION_SECRET`.

The cookie is:

- `httpOnly`
- `sameSite=lax`
- secure in production
- limited to a 10-minute inactivity window

Authenticated heartbeats renew active sessions. Inactivity causes the session to expire.

`middleware.ts` protects application routes and returns JSON `401` responses for unauthenticated API requests. The `/owner` route is restricted to the Owner role.

## Owner workspace

The Owner dashboard is available at `/owner`.

It currently provides:

- **Overview** — employee count, HR/Manager count, query count, database status, recent activity
- **Database** — database table and column metadata
- **Employees** — create, activate/deactivate, reset password, and remove employee accounts
- **HR/Managers** — create, activate/deactivate, reset password, and remove HR/Manager accounts
- **Activity** — audit log inspection and print support
- **Settings** — workspace settings interface

Owner operations are routed through `/api/owner` and require an authenticated Owner session.

## Audit logging

Important operations are recorded in `audit_logs`.

The current schema records:

- actor username
- actor role
- operation type
- operation target
- execution status
- affected row count
- metadata
- timestamp

The Owner dashboard uses this information for workspace activity monitoring.

## Automatic visualization

`lib/visualization/engine.ts` examines the actual returned query result.

It can generate valid:

- **Bar charts** for categorical comparisons
- **Pie charts** for small categorical distributions
- **Line charts** for temporal/trend data

The visualization engine does not invent values. It derives chart data from the actual returned rows and validates the selected fields before rendering.

If the returned data does not support a reliable visualization, DataMind falls back to the table view.

## CSV export

HR/Manager and Owner users can export the current result table as CSV.

The export is generated client-side from the rows already returned by the authenticated query. There is no separate database-export endpoint.

Employees do not receive the CSV export control.

## Project stack

**Frontend**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts

**Backend**
- Next.js App Router API routes
- Server-only Supabase client
- Web Crypto API for session signing

**Database**
- Supabase
- PostgreSQL
- PostgreSQL functions / RPCs
- `pgcrypto`

**AI**
- Groq API
- OpenAI-compatible chat completion interface
- Configurable `GROQ_MODEL`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local`:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
# Optional legacy fallback:
# SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=
```

Generate a strong session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The Supabase secret/service-role key, Groq key, and session secret must remain server-side.

### 3. Configure the existing Supabase project

Run these files in order in the SQL Editor of the existing DataMind Supabase project:

1. `setup.sql`
2. `auth_setup.sql`

`setup.sql` installs the read-only execution RPC.

`auth_setup.sql` installs the current authentication, account-management, audit, password-hashing, login-verification, and privileged-execution infrastructure.

Do not create a second Supabase project just to run these migrations.

### 4. Start DataMind

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

Unauthenticated users are sent to `/login`.

### Health check

After the application is running:

```
http://localhost:3000/api/health
```

A working database connection should return a successful health response.

## Demo accounts

The current `auth_setup.sql` seeds these accounts if the usernames do not already exist:

| Role | Username | Initial password |
|---|---|---|
| Owner | `owner` | `change-me-owner` |
| HR/Manager | `admin` | `change-me-admin` |
| Employee | `member` | `change-me-member` |

**Change the seeded passwords before using the application outside a local/demo environment.**

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## Example questions

### Read

- "How many people work in each department?"
- "Which city has the most employees?"
- "Who earns the second highest salary?"
- "Who is working in more than one department?"
- "Show me a pie chart of employees by department."
- "Compare average salary across departments as a bar chart."
- "Plot hiring over the last five years."

### Write

Available to authorized HR/Manager and Owner users.

Examples:

- "Add a new department called Legal."
- "Update employee 12's salary."
- "Delete the job history row for employee 7."

Writes are presented for review and require explicit confirmation before execution.

## Security model

DataMind uses multiple independent controls:

1. **Role-specific authentication**
2. **Signed server-side session**
3. **Server-derived authorization**
4. **LLM role-aware prompting**
5. **Application-level SQL validation**
6. **Explicit confirmation for writes**
7. **Database-level SQL validation**
8. **Service-role-only RPC execution**
9. **Owner-only workspace authorization**
10. **Audit logging**

This layered design means the LLM is never treated as the security boundary.

## Current limitations

- SQL generation depends on the quality and capabilities of the configured LLM.
- Visualization selection is heuristic and based on the actual result shape.
- Query history is maintained locally rather than as a server-side history system.
- The application requires valid Groq and Supabase credentials for full end-to-end operation.
- Seeded demo credentials are intended for demonstration and must be changed before broader deployment.
