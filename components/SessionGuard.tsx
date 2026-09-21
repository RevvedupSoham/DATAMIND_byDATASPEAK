"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30 * 1000;
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Keeps the authenticated session alive while the user is active and logs
 * the user out after 10 minutes without activity. It also best-effort logs
 * out when the browser document is unloaded (tab/window close).
 *
 * The server remains authoritative: the signed cookie itself expires after
 * 10 minutes, and the heartbeat endpoint only rotates it while it is valid.
 */
export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (pathname === "/login") return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const redirectToLogin = () => {
      if (cancelled || loggingOutRef.current) return;
      loggingOutRef.current = true;
      router.replace("/login?reason=timeout");
      router.refresh();
    };

    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
    };

    const scheduleIdleLogout = () => {
      clearIdleTimer();
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivityRef.current));
      idleTimer = setTimeout(async () => {
        if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
          try {
            await fetch("/api/auth/logout", { method: "POST", keepalive: true });
          } finally {
            redirectToLogin();
          }
        } else {
          scheduleIdleLogout();
        }
      }, remaining + 50);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      scheduleIdleLogout();

      // Heartbeat is deliberately tied to real user activity rather than
      // the heartbeat timer itself, so an idle browser cannot stay signed in.
      if (now - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = now;
        void fetch("/api/auth/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).then((res) => {
          if (res.status === 401) redirectToLogin();
        }).catch(() => {
          // A transient network failure is not an immediate logout; the
          // server-side expiry and next heartbeat remain authoritative.
        });
      }
    };

    const handleUnload = () => {
      // sendBeacon is the browser-supported best-effort mechanism for sending
      // a request while a tab/window is being closed. The endpoint clears the
      // HttpOnly cookie server-side; it does not depend on awaiting a fetch.
      if (navigator.sendBeacon && !loggingOutRef.current) {
        loggingOutRef.current = true;
        navigator.sendBeacon("/api/auth/logout", new Blob([], { type: "application/json" }));
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    lastActivityRef.current = Date.now();
    lastHeartbeatRef.current = Date.now();
    scheduleIdleLogout();

    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current < IDLE_TIMEOUT_MS) {
        // Only heartbeat if the user has actually interacted recently.
        if (Date.now() - lastHeartbeatRef.current >= HEARTBEAT_INTERVAL_MS) {
          lastHeartbeatRef.current = Date.now();
          void fetch("/api/auth/heartbeat", { method: "POST" }).then((res) => {
            if (res.status === 401) redirectToLogin();
          }).catch(() => {});
        }
      }
      scheduleIdleLogout();
    }, 30 * 1000);

    return () => {
      cancelled = true;
      clearIdleTimer();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [pathname, router]);

  return null;
}
