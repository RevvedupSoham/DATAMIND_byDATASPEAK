# DataMind

**A natural-language database interface with role-based authorization, SQL validation, and database-driven visualization.**

## Live Deployment

DataMind is deployed and available online. The live application provides the complete user-facing experience, including authentication, natural-language database queries, SQL generation, server-side validation, Supabase PostgreSQL execution, result visualization, role-based access control, and the Owner workspace.

**Live Application:** [https://datamind-bydataspeak.onrender.com/](https://datamind-bydataspeak.onrender.com/)

**Source Repository:** [https://github.com/RevvedupSoham/DATAMIND_byDATASPEAK](https://github.com/RevvedupSoham/DATAMIND_byDATASPEAK)

## Overview

DataMind allows users to interact with a PostgreSQL employee database using natural language instead of writing SQL manually.

A user submits a question, the configured LLM translates it into SQL, the application independently validates the generated statement, and the approved query is executed against the real Supabase PostgreSQL database. Returned data is presented through a result table and, where appropriate, automatically generated visualizations.

The database remains the source of truth. The LLM is used for SQL generation and is not treated as a security or data-generation layer.

## Application Roles

DataMind currently supports three application roles:

| Role | Database Access | Write Access | Owner Workspace | CSV Export |
|---|---|---|---|---|
| **Owner** | Read and privileged operations | Yes | Yes | Yes |
| **HR/Manager** | Read and approved writes | Yes | No | Yes |
| **Employee** | Read-only | No | No | No |

Authorization is derived from the verified server-side session. A client request cannot select a role to obtain additional privileges.

## Live Application Flow

```
Login
  |
  v
Role-specific credential verification
  |
  v
Signed server-side session
  |
  v
Natural-language database question
  |
  v
Groq LLM
  |
  v
Generated PostgreSQL statement
  |
  v
Independent SQL validation
  |
  +----------------------------+
  |                            |
  v                            v
Read operation             Write operation
  |                            |
  v                            v
Read-only RPC             Explicit confirmation
  |                            |
  |                            v
  |                       Privileged RPC
  |                            |
  +-------------+--------------+
                |
                v
        Supabase PostgreSQL
                |
                v
       Result table and charts
```

Owner operations use an additional Owner-only route and server-side role check.

## Core Features

### Natural-Language to SQL

DataMind converts ordinary-language questions into PostgreSQL queries using the Groq API and the configured `GROQ_MODEL`.

The model returns structured output containing the generated SQL and an explanation. The generated SQL is independently validated before execution.

### Role-Based Authorization

Authentication uses separate role-specific account tables:

- `owner_users`
- `hr_manager_users`
- `employee_users`

The authenticated role is stored in a signed server-side session and is used to determine which operations the user is permitted to perform.

### SQL Validation

Generated SQL passes through an independent application-level validator.

The validation layer checks:

- Statement type
- Query length
- Multiple statements
- Dangerous PostgreSQL functions
- Privilege and administrative operations
- Role-specific write permissions
- Unrestricted `UPDATE` and `DELETE` operations
- Access to protected DataMind system tables
- Suspicious SQL comments and control sequences

Write operations are returned for review and require explicit confirmation before execution.

### Database Execution

DataMind uses Supabase PostgreSQL as its database layer.

Read operations use a dedicated read-only RPC. Privileged operations use a separate database RPC that applies its own restrictions. These functions are available only to the server-side service role.

### Automatic Visualization

The visualization engine examines the actual rows returned by PostgreSQL and determines whether the result supports a chart.

Supported visualizations include:

- Bar charts
- Line charts
- Pie charts

If the returned data does not support a reliable visualization, DataMind falls back to the table view.

### CSV Export

HR/Manager and Owner users can export the currently displayed query result as CSV. The export is generated client-side from data already returned to the authenticated session.

Employees do not receive the CSV export control.

## Owner Workspace

The Owner workspace is available at:

```
/owner
```

It provides:

- Overview of employees, HR/Managers, queries, database status, and recent activity
- Database table and column information
- Employee account management
- HR/Manager account management
- Password reset and account status operations
- Audit activity inspection
- Workspace settings

Owner operations are handled through `/api/owner` and require an authenticated Owner session.

## Audit Logging

Important application and database operations are recorded in `audit_logs`.

Recorded information includes:

- Actor username
- Actor role
- Operation type
- Operation target
- Execution status
- Affected row count
- Metadata
- Timestamp

The Owner workspace uses these records for activity monitoring.

## Security Architecture

DataMind uses multiple independent layers of protection:

1. Role-specific authentication
2. Signed server-side sessions
3. Server-derived authorization
4. Role-aware LLM prompting
5. Independent application-level SQL validation
6. Explicit confirmation for write operations
7. Database-level SQL validation
8. Service-role-only RPC execution
9. Owner-only workspace authorization
10. Audit logging

The LLM is therefore treated as a translation component rather than the security boundary.

Session cookies are signed using HMAC-SHA256 and configured as `httpOnly`, `sameSite=lax`, and secure in production. Sessions also use inactivity expiry and authenticated heartbeats.

## Technology Stack

**Frontend**
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts

**Backend**
- Next.js App Router API routes
- Server-only Supabase client
- Web Crypto API

**Database**
- Supabase
- PostgreSQL
- PostgreSQL functions and RPCs
- pgcrypto

**AI**
- Groq API
- OpenAI-compatible chat completion interface
- Configurable `GROQ_MODEL`
- Intended model: `openai/gpt-oss-120b`

**Deployment**
- Render

## Project Structure

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
  QueryInterface.tsx
  ResultView.tsx
  ResultTable.tsx
  ChartRenderer.tsx
  SQLViewer.tsx
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

types/

middleware.ts
setup.sql
auth_setup.sql
managing-accounts.md
```

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local`:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=
```

The Supabase server key, Groq API key, and session secret must remain server-side.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Configure Supabase

Run the following files in order in the existing DataMind Supabase project:

1. `setup.sql`
2. `auth_setup.sql`

These files configure the database execution RPCs, authentication tables, account-management functions, password hashing, login verification, privileged execution, and audit infrastructure.

### 4. Start the Application

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

Unauthenticated users are redirected to `/login`.

### Health Check

Once the application is running:

```
http://localhost:3000/api/health
```

The endpoint can be used to verify application and database connectivity.

## Demo Accounts

The current `auth_setup.sql` seeds the following accounts if the usernames do not already exist:

| Role | Username | Initial Password |
|---|---|---|
| Owner | `owner` | `change-me-owner` |
| HR/Manager | `admin` | `change-me-admin` |
| Employee | `member` | `change-me-member` |

Change the seeded passwords before using the application outside a local or controlled demonstration environment.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

## Example Queries

### Read

- "How many people work in each department?"
- "Which city has the most employees?"
- "Who earns the second highest salary?"
- "Who is working in more than one department?"
- "Show me a pie chart of employees by department."
- "Compare average salary across departments as a bar chart."
- "Plot hiring over the last five years."

### Write

Authorized HR/Manager and Owner users can submit supported database modification requests.

Examples:

- "Add a new department called Legal."
- "Update employee 12's salary."
- "Delete the job history row for employee 7."

Write requests are presented for review and require explicit confirmation before execution.

## Database Defense in Depth

### Read-only RPC

`setup.sql` creates:

```
execute_readonly_sql(query text)
```

The function accepts only read operations, rejects multiple statements, applies an 8-second statement timeout, and is callable only by `service_role`.

### Privileged RPC

`auth_setup.sql` creates:

```
execute_privileged_sql()
```

The privileged function applies its own statement-type and dangerous-operation checks and is restricted to `service_role`.

The application independently verifies the authenticated role before calling the privileged RPC.

## Repository

**GitHub:** https://github.com/RevvedupSoham/DATAMIND_byDATASPEAK

The repository contains the application source code, database setup scripts, authentication and authorization logic, SQL validation layer, visualization engine, account-management functionality, and deployment configuration.

## Deployment Notes

The live deployment is intended to provide a publicly accessible demonstration of DataMind.

The application requires valid server-side Groq and Supabase credentials. Sensitive credentials are not stored in the repository or exposed to the browser.

For deployments accessible to external users, seeded demonstration passwords should be replaced with appropriate credentials and the database should be configured for the intended access scope.
