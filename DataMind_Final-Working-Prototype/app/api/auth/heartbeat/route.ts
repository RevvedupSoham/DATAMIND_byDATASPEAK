import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sliding-session heartbeat. The existing signed session must still be valid;
 * if it is, issue a fresh 10-minute token. The client only calls this while
 * the user has recently interacted with the application.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const refreshed = await createSessionToken(
    session.username,
    session.role,
    session.workforceId
  );

  const response = NextResponse.json({
    authenticated: true,
    expiresInSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  response.cookies.set(SESSION_COOKIE_NAME, refreshed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return response;
}
