"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { UserRole } from "@/types/auth";

type Section = "overview" | "database" | "users" | "hr_managers" | "activity" | "settings";
type ManagedUser = { id: number; username: string; role: "hr_manager" | "employee"; isActive: boolean; createdAt: string };
type Activity = { id: string; actor_username: string; actor_role: UserRole; action: string; target_type: string | null; target_identifier: string | null; details: Record<string, unknown> | null; created_at: string };
type Overview = { employees: number; hr_managers: number; queries: number; database: string; recentActivity: Activity[] };
type DatabaseMeta = { tables: Record<string, unknown>[]; columns: Record<string, unknown>[] };

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "database", label: "Database" },
  { id: "users", label: "Employees" },
  { id: "hr_managers", label: "HR/Managers" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

function Icon({ name }: { name: Section | "home" | "download" | "print" | "logout" | "menu" | "close" | "arrow" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "menu") return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...common} d="M4 7h16M4 12h16M4 17h16" /></svg>;
  if (name === "close") return <svg viewBox="0 0 24 24" className="h-5 w-5"><path {...common} d="M6 6l12 12M18 6L6 18" /></svg>;
  if (name === "arrow") return <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M5 12h13M13 7l5 5-5 5" /></svg>;
  if (name === "logout") return <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M10 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19H10M14 8l4 4-4 4M18 12H9" /></svg>;
  if (name === "home") return <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6h-4v6H5a1 1 0 01-1-1v-9.5z" /></svg>;
  if (name === "download") return <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 4v10M8 10l4 4 4-4M5 19h14" /></svg>;
  if (name === "print") return <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M7 9V4h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v6H7z" /></svg>;
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect {...common} x="4" y="4" width="6" height="6" rx="1"/><rect {...common} x="14" y="4" width="6" height="6" rx="1"/><rect {...common} x="4" y="14" width="6" height="6" rx="1"/><rect {...common} x="14" y="14" width="6" height="6" rx="1"/></>,
    database: <><ellipse {...common} cx="12" cy="5.5" rx="7" ry="3"/><path {...common} d="M5 5.5v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7M5 12.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    users: <><circle {...common} cx="9" cy="8" r="3"/><path {...common} d="M3.5 20c.8-3.4 2.8-5 5.5-5s4.7 1.6 5.5 5M16 5.5a3 3 0 010 5.8M16.5 15c2.2.3 3.7 1.9 4 4.5"/></>,
    hr_managers: <><path {...common} d="M12 3l7 3v5c0 4.2-2.7 7.7-7 10-4.3-2.3-7-5.8-7-10V6l7-3z"/><path {...common} d="M9 12l2 2 4-4"/></>,
    activity: <><path {...common} d="M4 14h4l2-7 4 12 2-5h4"/></>,
    settings: <><circle {...common} cx="12" cy="12" r="3"/><path {...common} d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V20h-2.5v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H6v-2.5h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1L9 6.7l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V5h2.5v.6a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1V14h-.1a1.7 1.7 0 00-1.5 1z"/></>,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4">{paths[name]}</svg>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function actionLabel(action: string) {
  return action.replaceAll("_", " ");
}

export default function OwnerPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [username, setUsername] = useState("owner");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [database, setDatabase] = useState<DatabaseMeta | null>(null);
  const [accountForm, setAccountForm] = useState({ username: "", password: "" });
  const [printingActivity, setPrintingActivity] = useState(false);

  const currentUsers = useMemo(() => users.filter((user) => user.role === (section === "hr_managers" ? "hr_manager" : "employee")), [users, section]);

  async function api<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "The request could not be completed.");
    return data as T;
  }

  async function load(sectionToLoad: Section = section) {
    setLoading(true);
    setError(null);
    try {
      const me = await api<{ authenticated: boolean; username: string; role: UserRole }>("/api/auth/me");
      if (me.role !== "owner") { router.replace("/"); return; }
      setUsername(me.username);
      if (sectionToLoad === "overview") setOverview(await api<Overview>("/api/owner?action=overview"));
      if (sectionToLoad === "users" || sectionToLoad === "hr_managers") setUsers((await api<{ users: ManagedUser[] }>("/api/owner?action=users")).users);
      if (sectionToLoad === "activity") setActivity((await api<{ activity: Activity[] }>("/api/owner?action=activity")).activity);
      if (sectionToLoad === "database") setDatabase(await api<DatabaseMeta>("/api/owner?action=database"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the Owner dashboard.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load("overview"); }, []);

  useEffect(() => {
    if (section !== "settings") void load(section);
  }, [section]);

  useEffect(() => {
    if (!printingActivity) return;
    const handleAfterPrint = () => setPrintingActivity(false);
    window.addEventListener("afterprint", handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 120);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printingActivity]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const role = section === "hr_managers" ? "hr_manager" : "employee";
      await api("/api/owner", { method: "POST", body: JSON.stringify({ action: "create_account", role, username: accountForm.username, password: accountForm.password }) });
      setAccountForm({ username: "", password: "" });
      await load(section);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the account."); }
    finally { setBusy(false); }
  }

  async function toggleUser(user: ManagedUser) {
    setBusy(true); setError(null);
    try {
      await api("/api/owner", { method: "POST", body: JSON.stringify({ action: "set_active", role: user.role, username: user.username, isActive: !user.isActive }) });
      await load(section);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update the account."); }
    finally { setBusy(false); }
  }

  async function removeUser(user: ManagedUser) {
    if (!window.confirm(`Remove ${user.username} from DataMind? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      await api("/api/owner", { method: "POST", body: JSON.stringify({ action: "delete_account", role: user.role, username: user.username }) });
      await load(section);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove the account."); }
    finally { setBusy(false); }
  }

  async function resetPassword(user: ManagedUser) {
    const password = window.prompt(`Enter a new password for ${user.username} (8+ characters):`);
    if (password === null) return;
    setBusy(true); setError(null);
    try {
      await api("/api/owner", { method: "POST", body: JSON.stringify({ action: "reset_password", role: user.role, username: user.username, password }) });
      window.alert("Password updated.");
      await load(section);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not reset the password."); }
    finally { setBusy(false); }
  }

  function selectSection(id: Section) { setSection(id); setMobileNav(false); }

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.035]" />
      <div className="pointer-events-none fixed -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-accent-500/10 blur-[120px]" />
      <div className="relative flex min-h-screen print:hidden">
        <aside className={`${mobileNav ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-800 bg-ink-950/95 p-6 backdrop-blur-sm transition-transform duration-300 lg:relative lg:translate-x-0`}>
          <div className="flex items-center justify-between">
            <a href="/" className="font-display text-xl italic tracking-tight text-ink-100">Data<span className="text-accent-400 not-italic">Mind</span></a>
            <button className="text-ink-400 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation"><Icon name="close" /></button>
          </div>
          <div className="mt-10">
            <p className="eyebrow">Workspace</p>
            <p className="mt-2 text-xs uppercase tracking-widest2 text-ink-500">Owner control</p>
          </div>
          <nav className="mt-8 space-y-1">
            <button onClick={() => { setMobileNav(false); router.push("/"); }} className="mb-2 flex w-full items-center gap-3 rounded-sm border border-ink-800 px-3 py-3 text-left text-sm text-ink-300 transition-colors hover:border-accent-500/50 hover:bg-ink-900 hover:text-ink-100">
              <Icon name="home" />
              <span className="font-semibold uppercase tracking-wider">Home</span>
            </button>
            <div className="my-3 border-t border-ink-800/80" />
            {sections.map((item) => (
              <button key={item.id} onClick={() => selectSection(item.id)} className={`flex w-full items-center gap-3 rounded-sm px-3 py-3 text-left text-sm transition-colors ${section === item.id ? "bg-accent-500 text-accent-contrast" : "text-ink-400 hover:bg-ink-900 hover:text-ink-100"}`}>
                <Icon name={item.id} />
                <span className="font-semibold uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-ink-800 pt-5">
            <p className="truncate text-sm text-ink-200">{username}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest2 text-accent-400">Owner</p>
            <button onClick={logout} className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-100"><Icon name="logout" /> Sign out</button>
          </div>
        </aside>

        {mobileNav && <button className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation overlay" />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-sm">
            <div className="flex h-20 items-center justify-between px-6 md:px-10">
              <div className="flex items-center gap-4">
                <button className="text-ink-400 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="menu" /></button>
                <div>
                  <p className="eyebrow">DataMind / Owner</p>
                  <h1 className="mt-1 font-display text-2xl text-ink-100 md:text-3xl">{sections.find((s) => s.id === section)?.label}</h1>
                </div>
              </div>
              <div className="flex items-center gap-4"><ThemeToggle /><span className="hidden text-xs uppercase tracking-widest2 text-ink-500 sm:inline">Owner</span></div>
            </div>
          </header>

          <div className="relative mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-12">
            {error && <div className="alert-danger mb-8 rounded-sm border px-4 py-3 text-sm text-ink-200"><span className="alert-heading font-semibold">Action failed. </span>{error}</div>}
            {loading ? <div className="py-24 text-center text-xs uppercase tracking-widest2 text-ink-500">Loading workspace…</div> : (
              <>
                {section === "overview" && overview && <OverviewView overview={overview} onActivity={() => selectSection("activity")} />}
                {section === "database" && database && <DatabaseView database={database} />}
                {(section === "users" || section === "hr_managers") && <AccountsView title={section === "hr_managers" ? "HR/Managers" : "Employees"} role={section === "hr_managers" ? "hr_manager" : "employee"} users={currentUsers} busy={busy} onToggle={toggleUser} onRemove={removeUser} onReset={resetPassword} form={accountForm} setForm={setAccountForm} onCreate={createAccount} />}
                {section === "activity" && <ActivityView activity={activity} onPrint={() => setPrintingActivity(true)} />}
                {section === "settings" && <SettingsView />}
              </>
            )}
          </div>
        </main>
      </div>
      {printingActivity && <PrintActivityView activity={activity} />}
    </div>
  );
}

function OverviewView({ overview, onActivity }: { overview: Overview; onActivity: () => void }) {
  return <div>
    <div className="max-w-3xl"><p className="eyebrow">Workspace control</p><h2 className="mt-3 font-display text-4xl leading-tight text-ink-100 md:text-5xl">See the system behind the questions.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-ink-400">Manage access, inspect the database, and keep a clear record of what happens inside DataMind.</p></div>
    <div className="mt-12 grid gap-px overflow-hidden border border-ink-800 bg-ink-800 md:grid-cols-4">
      {[['Employees', overview.employees], ['HR/Managers', overview.hr_managers], ['Queries', overview.queries], ['Database', overview.database]].map(([label, value]) => <div key={String(label)} className="bg-ink-950 p-6"><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">{label}</p><p className="mt-3 font-display text-3xl text-ink-100">{value}</p></div>)}
    </div>
    <div className="mt-10 border border-ink-800 bg-ink-950/60">
      <div className="flex items-center justify-between border-b border-ink-800 px-6 py-5"><div><p className="eyebrow">Activity</p><h3 className="mt-1 font-display text-2xl">Recent events</h3></div><button onClick={onActivity} className="text-xs font-semibold uppercase tracking-widest2 text-accent-400">View all →</button></div>
      <ActivityTable activity={overview.recentActivity} compact />
    </div>
  </div>;
}

function AccountsView({ title, role, users, busy, onToggle, onRemove, onReset, form, setForm, onCreate }: { title: string; role: "hr_manager" | "employee"; users: ManagedUser[]; busy: boolean; onToggle: (u: ManagedUser) => void; onRemove: (u: ManagedUser) => void; onReset: (u: ManagedUser) => void; form: { username: string; password: string }; setForm: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>; onCreate: (e: React.FormEvent) => void }) {
  const roleLabel = role === "hr_manager" ? "HR/Manager" : "Employee";
  const roleDescription = role === "hr_manager" ? "database operators" : "read-only employees";
  return <div>
    <div className="max-w-3xl"><p className="eyebrow">Access control</p><h2 className="mt-3 font-display text-4xl text-ink-100">{title}</h2><p className="mt-4 text-sm leading-6 text-ink-400">Create and manage {roleDescription}. The account role is fixed for this section: <span className="text-ink-200">{roleLabel}</span>. Credentials never leave the server-side authentication path.</p></div>
    <form onSubmit={onCreate} className="mt-10 grid gap-4 border border-ink-800 bg-ink-950/60 p-5 md:grid-cols-[minmax(180px,.7fr)_1fr_1fr_auto] md:items-end">
      <div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Role</label><div className="flex min-h-[46px] items-center rounded-sm border border-ink-800 bg-ink-900/50 px-3 text-sm text-ink-200"><span className="h-1.5 w-1.5 rounded-full bg-accent-400 mr-2" />{roleLabel}</div></div>
      <div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Username</label><input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required className="w-full rounded-sm border border-ink-700 bg-ink-950 px-3 py-3 text-sm text-ink-100" placeholder="newusername" /></div>
      <div><label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Temporary password</label><input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} className="w-full rounded-sm border border-ink-700 bg-ink-950 px-3 py-3 text-sm text-ink-100" placeholder="8+ characters" /></div>
      <button disabled={busy} className="btn-primary whitespace-nowrap">Create <Icon name="arrow" /></button>
    </form>
    <div className="mt-8 overflow-hidden border border-ink-800"><div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-ink-800 bg-ink-900/60"><tr>{["Username","Status","Created","Actions"].map((h) => <th key={h} className="px-5 py-4 text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink-800">{users.length === 0 ? <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-ink-500">No accounts in this role yet.</td></tr> : users.map((user) => <tr key={`${user.role}-${user.id}`} className="bg-ink-950/50"><td className="px-5 py-4 font-medium text-ink-100">{user.username}</td><td className="px-5 py-4"><span className={`text-xs uppercase tracking-wider ${user.isActive ? "text-accent-400" : "text-ink-500"}`}>{user.isActive ? "Active" : "Disabled"}</span></td><td className="px-5 py-4 text-ink-400">{formatDate(user.createdAt)}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wider"><button disabled={busy} onClick={() => onToggle(user)} className="text-accent-400 hover:text-accent-300">{user.isActive ? "Disable" : "Reactivate"}</button><button disabled={busy} onClick={() => onReset(user)} className="text-ink-300 hover:text-ink-100">Reset password</button><button disabled={busy} onClick={() => onRemove(user)} className="text-red-400 hover:text-red-300">Remove</button></div></td></tr>)}</tbody></table></div></div>
  </div>;
}

function DatabaseView({ database }: { database: DatabaseMeta }) {
  const grouped = database.columns.reduce<Record<string, Record<string, unknown>[]>>((acc, col) => { const name = String(col.table_name ?? ""); (acc[name] ??= []).push(col); return acc; }, {});
  return <div><p className="eyebrow">PostgreSQL</p><h2 className="mt-3 font-display text-4xl text-ink-100">Database structure</h2><p className="mt-4 text-sm leading-6 text-ink-400">A live view of the public schema available to DataMind.</p><div className="mt-10 grid gap-4 md:grid-cols-2">{database.tables.map((table) => { const name = String(table.table_name); const cols = grouped[name] ?? []; return <div key={name} className="border border-ink-800 bg-ink-950/60 p-5"><div className="flex items-center justify-between"><p className="font-mono text-sm text-ink-100">{name}</p><span className="text-[10px] uppercase tracking-wider text-ink-500">{String(table.table_type ?? "TABLE")}</span></div><div className="mt-4 space-y-2 border-t border-ink-800 pt-4">{cols.map((col) => <div key={`${name}-${String(col.column_name)}`} className="flex justify-between gap-4 text-xs"><span className="font-mono text-ink-300">{String(col.column_name)}</span><span className="text-ink-500">{String(col.data_type)}</span></div>)}</div></div>; })}</div></div>;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadActivityCsv(activity: Activity[]) {
  const rows = [
    ["Actor", "Role", "Action", "Target type", "Target", "Time"],
    ...activity.map((item) => [
      item.actor_username,
      item.actor_role,
      actionLabel(item.action),
      item.target_type ?? "",
      item.target_identifier ?? "",
      new Date(item.created_at).toISOString(),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `datamind-activity-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function PrintActivityView({ activity }: { activity: Activity[] }) {
  const generated = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="hidden min-h-screen bg-white px-10 py-10 text-slate-900 print:block">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between border-b-2 border-teal-500 pb-5">
          <div>
            <div className="font-serif text-3xl italic tracking-tight">Data<span className="font-sans not-italic text-teal-600">Mind</span></div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-teal-600">Audit trail</p>
          </div>
          <div className="text-right text-[11px] leading-5 text-slate-500">
            <div className="font-semibold uppercase tracking-[0.18em]">Owner audit export</div>
            <div>{generated}</div>
          </div>
        </div>
        <div className="mt-8">
          <h1 className="font-serif text-4xl font-medium">Activity log</h1>
          <p className="mt-2 text-sm text-slate-500">A printable record of workspace and database operations captured by DataMind.</p>
        </div>
        <div className="mt-7 overflow-hidden border border-slate-200">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead className="bg-slate-50">
              <tr>{["Actor", "Action", "Target", "Time"].map((h) => <th key={h} className="border border-slate-200 px-3 py-3 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{h}</th>)}</tr>
            </thead>
            <tbody>
              {activity.length === 0 ? <tr><td colSpan={4} className="border border-slate-200 px-3 py-8 text-center text-slate-500">No activity recorded.</td></tr> : activity.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-200 px-3 py-3 align-top"><strong>{item.actor_username}</strong><span className="mt-1 block text-[8px] uppercase tracking-[0.12em] text-teal-600">{item.actor_role}</span></td>
                  <td className="border border-slate-200 px-3 py-3 align-top uppercase tracking-wider">{actionLabel(item.action)}</td>
                  <td className="break-words border border-slate-200 px-3 py-3 align-top font-mono text-[10px] text-slate-600">{item.target_identifier ?? "—"}</td>
                  <td className="border border-slate-200 px-3 py-3 align-top text-slate-500">{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex justify-between text-[9px] text-slate-400"><span>Generated by DataMind</span><span>{activity.length} event{activity.length === 1 ? "" : "s"}</span></div>
      </div>
    </div>
  );
}

function ActivityView({ activity, onPrint }: { activity: Activity[]; onPrint: () => void }) {
  return <div>
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow">Audit trail</p>
        <h2 className="mt-3 font-display text-4xl text-ink-100">Activity</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-400">A record of important workspace and database operations.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => downloadActivityCsv(activity)} disabled={activity.length === 0} className="inline-flex items-center gap-2 rounded-sm border border-ink-700 bg-ink-950 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest2 text-ink-200 transition-colors hover:border-accent-500/50 hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-40">
          <Icon name="download" /> Download CSV
        </button>
        <button onClick={onPrint} disabled={activity.length === 0} className="inline-flex items-center gap-2 rounded-sm bg-accent-500 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest2 text-accent-contrast transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40">
          <Icon name="print" /> Print log
        </button>
      </div>
    </div>
    <div className="mt-10 overflow-hidden border border-ink-800 bg-ink-950/55">
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900/35 px-5 py-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Recorded events</p><p className="mt-1 text-sm text-ink-300">{activity.length} total</p></div>
        <p className="hidden text-[10px] uppercase tracking-widest2 text-ink-600 sm:block">Newest first</p>
      </div>
      <ActivityTable activity={activity} />
    </div>
  </div>;
}

function ActivityTable({ activity, compact = false }: { activity: Activity[]; compact?: boolean }) { return <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-ink-800 bg-ink-900/50"><tr>{["Actor","Action","Target","Time"].map((h) => <th key={h} className="px-5 py-4 text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink-800">{activity.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-ink-500">No activity recorded yet.</td></tr> : activity.slice(0, compact ? 8 : undefined).map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="text-ink-200">{item.actor_username}</p><p className="text-[10px] uppercase tracking-wider text-accent-400">{item.actor_role}</p></td><td className="px-5 py-4 uppercase tracking-wider text-ink-300">{actionLabel(item.action)}</td><td className="px-5 py-4 text-ink-400">{item.target_identifier ?? "—"}</td><td className="px-5 py-4 text-ink-500">{formatDate(item.created_at)}</td></tr>)}</tbody></table></div>; }

function SettingsView() { return <div><p className="eyebrow">Workspace</p><h2 className="mt-3 font-display text-4xl text-ink-100">Settings</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-ink-400">The current DataMind security and query limits remain controlled by the application configuration. This panel intentionally avoids exposing secrets or unsafe database controls.</p><div className="mt-10 grid gap-px border border-ink-800 bg-ink-800 md:grid-cols-2"><div className="bg-ink-950 p-6"><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Session</p><p className="mt-2 text-sm text-ink-200">Signed session cookie · 8 hours</p></div><div className="bg-ink-950 p-6"><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Database writes</p><p className="mt-2 text-sm text-ink-200">Explicit confirmation required</p></div><div className="bg-ink-950 p-6"><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Employee access</p><p className="mt-2 text-sm text-ink-200">Read-only</p></div><div className="bg-ink-950 p-6"><p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-500">Secrets</p><p className="mt-2 text-sm text-ink-200">Server-side only</p></div></div></div>; }
