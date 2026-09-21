import { NextRequest, NextResponse } from "next/server";
import {
  createManagedAccount,
  DatabaseError,
  deleteManagedAccount,
  getAuditLogs,
  getDatabaseMetadata,
  getOwnerOverview,
  listManagedAccounts,
  listOwnerAccounts,
  resetManagedAccountPassword,
  setManagedAccountActive,
  writeAuditLog,
} from "@/lib/database/supabase";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { UserRole } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireOwner(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) return { error: error("Please log in.", 401) } as const;
  if (session.role !== "owner") return { error: error("Owner access required.", 403) } as const;
  return { session } as const;
}

function validRole(value: unknown): value is "hr_manager" | "employee" {
  return value === "hr_manager" || value === "employee";
}

function validUsername(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{2,64}$/.test(value.trim());
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if ("error" in auth) return auth.error;

  const action = req.nextUrl.searchParams.get("action") ?? "overview";
  try {
    if (action === "overview") return NextResponse.json(await getOwnerOverview());
    if (action === "users") return NextResponse.json({ users: await listManagedAccounts() });
    if (action === "owners") return NextResponse.json({ owners: await listOwnerAccounts() });
    if (action === "activity") return NextResponse.json({ activity: await getAuditLogs() });
    if (action === "database") return NextResponse.json(await getDatabaseMetadata());
    return error("Unknown Owner dashboard section.", 404);
  } catch (err) {
    if (err instanceof DatabaseError) return error(err.message, 502);
    console.error("[DataMind] Owner GET error:", err);
    return error("Could not load the Owner dashboard.", 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Request body must be valid JSON.");
  }

  const data = (body as Record<string, unknown>) ?? {};
  const action = data.action;

  try {
    if (action === "create_account") {
      if (!validRole(data.role)) return error("Only HR/Manager or Employee accounts can be created.");
      if (!validUsername(data.username)) return error("Username must be 2–64 characters and use letters, numbers, dots, dashes, or underscores.");
      if (!validPassword(data.password)) return error("Password must be between 8 and 128 characters.");

      await createManagedAccount(data.role, data.username.trim(), data.password);
      await writeAuditLog({
        actorUsername: auth.session.username,
        actorRole: "owner",
        action: "account_created",
        targetType: data.role,
        targetIdentifier: data.username.trim(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_active") {
      if (!validRole(data.role) || !validUsername(data.username) || typeof data.isActive !== "boolean") {
        return error("Invalid account status request.");
      }
      await setManagedAccountActive(data.role, data.username.trim(), data.isActive);
      await writeAuditLog({
        actorUsername: auth.session.username,
        actorRole: "owner",
        action: data.isActive ? "account_reactivated" : "account_disabled",
        targetType: data.role,
        targetIdentifier: data.username.trim(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_account") {
      if (!validRole(data.role) || !validUsername(data.username)) return error("Invalid account removal request.");
      await deleteManagedAccount(data.role, data.username.trim());
      await writeAuditLog({
        actorUsername: auth.session.username,
        actorRole: "owner",
        action: "account_removed",
        targetType: data.role,
        targetIdentifier: data.username.trim(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_password") {
      if (!validRole(data.role) || !validUsername(data.username) || !validPassword(data.password)) {
        return error("Invalid password reset request.");
      }
      await resetManagedAccountPassword(data.role, data.username.trim(), data.password);
      await writeAuditLog({
        actorUsername: auth.session.username,
        actorRole: "owner",
        action: "password_reset",
        targetType: data.role,
        targetIdentifier: data.username.trim(),
      });
      return NextResponse.json({ ok: true });
    }

    return error("Unknown Owner action.", 404);
  } catch (err) {
    if (err instanceof DatabaseError) return error(err.message, 502);
    console.error("[DataMind] Owner POST error:", err);
    return error("The Owner operation could not be completed.", 500);
  }
}
