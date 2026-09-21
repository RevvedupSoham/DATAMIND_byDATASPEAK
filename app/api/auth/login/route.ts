import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/database/supabase";
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import type { LoginRequestBody } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { username, password, panel } = (body as Partial<LoginRequestBody>) ?? {};

  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter a username and password." }, { status: 400 });
  }

  if (panel !== "owner" && panel !== "hr_manager" && panel !== "employee") {
    return NextResponse.json({ error: "Select Owner, HR/Manager, or Employee before signing in." }, { status: 400 });
  }

  const verifiedUser = await verifyCredentials(username.trim(), password, panel);

  if (!verifiedUser) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const token = await createSessionToken(
    verifiedUser.username,
    verifiedUser.role,
    verifiedUser.workforceId
  );

  const response = NextResponse.json({
    username: verifiedUser.username,
    role: verifiedUser.role,
    workforceId: verifiedUser.workforceId,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
