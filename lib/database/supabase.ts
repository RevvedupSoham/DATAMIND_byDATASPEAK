import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { QueryResult, QueryResultRow } from "@/types/query";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedConfig = "";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Supabase now recommends the server-only secret key. Keep the legacy
  // service-role variable as a fallback so existing setups keep working.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    throw new DatabaseError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY) in .env.local."
    );
  }

  const config = `${url}\n${secretKey}`;
  if (cachedClient && cachedConfig === config) return cachedClient;

  try {
    cachedClient = createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    cachedConfig = config;
    return cachedClient;
  } catch (error) {
    console.error("[DataMind] Failed to initialize Supabase client:", error);
    throw new DatabaseError("The Supabase connection settings are invalid.");
  }
}

function inferColumnType(value: unknown): "number" | "date" | "boolean" | "string" | "null" {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) return "date";
    return "string";
  }
  return "string";
}

function inferColumnTypes(rows: QueryResultRow[], columns: string[]) {
  const types: QueryResult["columnTypes"] = {};
  for (const col of columns) {
    const sample = rows.find((row) => row[col] !== null && row[col] !== undefined);
    types[col] = sample ? inferColumnType(sample[col]) : "null";
  }
  return types;
}

/**
 * Executes a validated read-only SQL statement through the Supabase RPC
 * function created by setup.sql. The secret/service-role key is used only on
 * the server and this module is explicitly server-only.
 */
export async function executeReadonlyQuery(sql: string): Promise<QueryResult> {
  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_readonly_sql", { query: sql });
    data = response.data;
    error = response.error;
  } catch (err) {
    console.error("[DataMind] Supabase RPC/network error:", err);
    throw new DatabaseError(
      "DataMind could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL, the server API key, and your network connection."
    );
  }

  if (error) {
    console.error("[DataMind] Supabase execution error:", error);

    const message = error.message ?? "unknown Supabase error";
    if (/execute_readonly_sql|function .* does not exist|404/i.test(message)) {
      throw new DatabaseError(
        "The Supabase read-only function is missing. Open Supabase SQL Editor and run setup.sql once."
      );
    }

    throw new DatabaseError(
      "Supabase rejected the database query. Check that setup.sql has been run and that the database schema matches DataMind."
    );
  }

  const rows = (Array.isArray(data) ? data : []) as QueryResultRow[];
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  return {
    rows,
    rowCount: rows.length,
    columns,
    columnTypes: inferColumnTypes(rows, columns),
  };
}

/**
 * Executes an HR/Manager/Owner-authorized statement (including DDL/DML) through the
 * `execute_privileged_sql` RPC (see auth_setup.sql). This must ONLY ever be
 * called after the route handler has verified, from a signed session
 * cookie, that the request is from an authenticated hr_manager — this function
 * itself does not and cannot re-check that.
 *
 * For a SELECT/WITH statement this behaves like executeReadonlyQuery. For a
 * write statement (INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE) it
 * returns an empty result set — there are no rows to show, only the fact
 * that the statement ran.
 */
export async function executePrivilegedQuery(sql: string): Promise<QueryResult> {
  const client = getServiceClient();

  let data: unknown;
  let error: { message?: string; code?: string; details?: string } | null = null;

  try {
    const response = await client.rpc("execute_privileged_sql", { query: sql });
    data = response.data;
    error = response.error;
  } catch (err) {
    console.error("[DataMind] Supabase privileged RPC/network error:", err);
    throw new DatabaseError(
      "DataMind could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL, the server API key, and your network connection."
    );
  }

  if (error) {
    console.error("[DataMind] Supabase privileged execution error:", error);

    const message = error.message ?? "unknown Supabase error";
    if (/execute_privileged_sql|function .* does not exist|404/i.test(message)) {
      throw new DatabaseError(
        "The Supabase hr_manager execution function is missing. Open the SQL Editor and run auth_setup.sql once."
      );
    }
    if (/not permitted|restricted|disallowed|Multiple statements|Unrecognized/i.test(message)) {
      throw new DatabaseError(message);
    }

    throw new DatabaseError(
      "Supabase rejected the statement. Check that auth_setup.sql has been run and that the statement is valid for the current schema."
    );
  }

  const rows = (Array.isArray(data) ? data : []) as QueryResultRow[];
  const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];

  return {
    rows,
    rowCount: rows.length,
    columns,
    columnTypes: inferColumnTypes(rows, columns),
  };
}

/**
 * Lightweight server-side connection test used by /api/health.
 * It verifies that the configured credentials can call the DataMind RPC.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await executeReadonlyQuery("SELECT 1 AS connected");
}

/**
 * Verifies a username/password against exactly the selected role table.
 * The returned role is the server-verified role, never a client assertion.
 */
export interface VerifiedCredentials {
  username: string;
  role: "owner" | "hr_manager" | "employee";
  workforceId: number | null;
}

export async function verifyCredentials(
  username: string,
  password: string,
  panel: "owner" | "hr_manager" | "employee"
): Promise<VerifiedCredentials | null> {
  const client = getServiceClient();
  const rpcName =
    panel === "owner"
      ? "verify_owner_login"
      : panel === "hr_manager"
        ? "verify_hr_manager_login"
        : "verify_employee_login";

  const { data, error } = await client.rpc(rpcName, {
    p_username: username,
    p_password: password,
  });

  if (error) {
    console.error(`[DataMind] ${rpcName} RPC error:`, error.message);
    return null;
  }

  if (data !== true) return null;

  if (panel === "owner") {
    return { username, role: panel, workforceId: null };
  }

  const accountTable = panel === "hr_manager" ? "hr_manager_users" : "employee_users";
  const { data: account, error: accountError } = await client
    .from(accountTable)
    .select("workforce_id")
    .eq("username", username)
    .eq("is_active", true)
    .maybeSingle();

  if (accountError) {
    console.error(`[DataMind] Failed to load ${panel} workforce identity:`, accountError.message);
    return null;
  }

  const workforceId = account?.workforce_id;
  if (!Number.isInteger(workforceId) || workforceId < 1) {
    console.error(`[DataMind] ${panel} account is missing a valid workforce_id.`);
    return null;
  }

  return { username, role: panel, workforceId };
}

export interface AuditLogInput {
  actorUsername: string;
  actorRole: "owner" | "hr_manager" | "employee";
  action: string;
  targetType?: string;
  targetIdentifier?: string;
  details?: Record<string, unknown>;
  executionStatus?: "success" | "failed";
  affectedRows?: number | null;
}

export interface ManagedAccount {
  id: number;
  username: string;
  role: "hr_manager" | "employee";
  isActive: boolean;
  createdAt: string;
}

export interface OwnerAccount {
  id: string;
  username: string;
  isActive: boolean;
  createdAt: string;
}

export interface OwnerActivity {
  id: string;
  actor_username: string;
  actor_role: "owner" | "hr_manager" | "employee";
  action: string;
  target_type: string | null;
  target_identifier: string | null;
  execution_status: string;
  affected_rows: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const client = getServiceClient();
    const target = input.targetType
      ? input.targetIdentifier
        ? `${input.targetType}:${input.targetIdentifier}`
        : input.targetType
      : input.targetIdentifier ?? null;

    const { error } = await client.from("audit_logs").insert({
      actor_username: input.actorUsername,
      actor_role: input.actorRole,
      operation_type: input.action,
      operation_target: target,
      execution_status: input.executionStatus ?? "success",
      affected_rows: input.affectedRows ?? null,
      metadata: input.details ?? {},
    });
    if (error) console.error("[DataMind] Audit log error:", error.message);
  } catch (error) {
    console.error("[DataMind] Audit log failure:", error);
  }
}

function mapAccount(row: { id: number; username: string; is_active: boolean; created_at: string }, role: "hr_manager" | "employee"): ManagedAccount {
  return {
    id: row.id,
    username: row.username,
    role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listManagedAccounts(): Promise<ManagedAccount[]> {
  const client = getServiceClient();
  const [employees, hr_managers] = await Promise.all([
    client.from("employee_users").select("id, username, is_active, created_at").order("created_at", { ascending: false }),
    client.from("hr_manager_users").select("id, username, is_active, created_at").order("created_at", { ascending: false }),
  ]);

  if (employees.error || hr_managers.error) {
    throw new DatabaseError("Could not load workspace users.");
  }

  return [
    ...(employees.data ?? []).map((row) => mapAccount(row, "employee")),
    ...(hr_managers.data ?? []).map((row) => mapAccount(row, "hr_manager")),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listOwnerAccounts(): Promise<OwnerAccount[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("owner_users")
    .select("id, username, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new DatabaseError("Could not load owner accounts.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    username: row.username,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function createManagedAccount(
  role: "hr_manager" | "employee",
  username: string,
  password: string
): Promise<void> {
  const client = getServiceClient();
  const table = role === "hr_manager" ? "hr_manager_users" : "employee_users";
  const { error } = await client.from(table).insert({
    username,
    password_hash: await hashPasswordInDatabase(password),
    display_name: username,
    is_active: true,
  });
  if (error) {
    if (error.code === "23505") throw new DatabaseError("That username already exists in this role.");
    throw new DatabaseError("Could not create the account.");
  }
}

async function hashPasswordInDatabase(password: string): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.rpc("hash_datamind_password", { p_password: password });
  if (error || typeof data !== "string") {
    throw new DatabaseError("Password hashing is not configured. Run the latest auth_setup.sql.");
  }
  return data;
}

export async function setManagedAccountActive(
  role: "hr_manager" | "employee",
  username: string,
  isActive: boolean
): Promise<void> {
  const client = getServiceClient();
  const table = role === "hr_manager" ? "hr_manager_users" : "employee_users";
  const { error } = await client.from(table).update({ is_active: isActive }).eq("username", username);
  if (error) throw new DatabaseError("Could not update the account status.");
}

export async function deleteManagedAccount(role: "hr_manager" | "employee", username: string): Promise<void> {
  const client = getServiceClient();
  const table = role === "hr_manager" ? "hr_manager_users" : "employee_users";
  const { error } = await client.from(table).delete().eq("username", username);
  if (error) throw new DatabaseError("Could not remove the account.");
}

export async function resetManagedAccountPassword(
  role: "hr_manager" | "employee",
  username: string,
  password: string
): Promise<void> {
  const client = getServiceClient();
  const table = role === "hr_manager" ? "hr_manager_users" : "employee_users";
  const { error } = await client
    .from(table)
    .update({ password_hash: await hashPasswordInDatabase(password) })
    .eq("username", username);
  if (error) throw new DatabaseError("Could not update the password.");
}

function normalizeAuditRow(row: {
  id: string;
  actor_username: string;
  actor_role: "owner" | "hr_manager" | "employee";
  operation_type: string;
  operation_target: string | null;
  execution_status: string;
  affected_rows: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}): OwnerActivity {
  const separator = row.operation_target?.indexOf(":") ?? -1;
  return {
    id: String(row.id),
    actor_username: row.actor_username,
    actor_role: row.actor_role,
    action: row.operation_type,
    target_type: separator >= 0 ? row.operation_target!.slice(0, separator) : row.operation_target,
    target_identifier: separator >= 0 ? row.operation_target!.slice(separator + 1) : null,
    execution_status: row.execution_status,
    affected_rows: row.affected_rows,
    details: row.metadata,
    created_at: row.created_at,
  };
}

export async function getOwnerOverview() {
  const client = getServiceClient();
  const [employees, hr_managers, queries, audit] = await Promise.all([
    client.from("employee_users").select("id", { count: "exact", head: true }),
    client.from("hr_manager_users").select("id", { count: "exact", head: true }),
    client.from("audit_logs").select("id", { count: "exact", head: true }).in("operation_type", ["query_read", "query_write"]),
    client.from("audit_logs").select("id, actor_username, actor_role, operation_type, operation_target, execution_status, affected_rows, metadata, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  if (employees.error || hr_managers.error || queries.error || audit.error) {
    throw new DatabaseError("Could not load the workspace overview.");
  }

  return {
    employees: employees.count ?? 0,
    hr_managers: hr_managers.count ?? 0,
    queries: queries.count ?? 0,
    database: "Connected",
    recentActivity: (audit.data ?? []).map(normalizeAuditRow),
  };
}

export async function getAuditLogs(limit = 100): Promise<OwnerActivity[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("audit_logs")
    .select("id, actor_username, actor_role, operation_type, operation_target, execution_status, affected_rows, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 250));
  if (error) throw new DatabaseError("Could not load the activity log.");
  return (data ?? []).map(normalizeAuditRow);
}

export async function getDatabaseMetadata() {
  const tables = await executeReadonlyQuery(`
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  const columns = await executeReadonlyQuery(`
    select table_name, column_name, data_type, is_nullable, ordinal_position
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `);

  return { tables: tables.rows, columns: columns.rows };
}
