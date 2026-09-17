"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";

function fmtDate(ms?: number): string {
  if (typeof ms !== "number") return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function Pill({ tone, children }: { tone: "ok" | "bad" | "muted"; children: string }) {
  const color =
    tone === "ok" ? "var(--color-ok)" : tone === "bad" ? "var(--color-warning)" : "var(--color-muted)";
  return (
    <span
      className="mono-label inline-block rounded-full border px-2.5 py-0.5"
      style={{ borderColor: "var(--color-rule-2)", color }}
    >
      {children}
    </span>
  );
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--color-muted)" }}>
      <span className="tnum">
        {from}–{to} of {total}
      </span>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        className="rounded-md border px-3 py-1 disabled:opacity-40"
        style={{ borderColor: "var(--color-rule-2)" }}
      >
        ← Prev
      </button>
      <span className="tnum">
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages - 1}
        className="rounded-md border px-3 py-1 disabled:opacity-40"
        style={{ borderColor: "var(--color-rule-2)" }}
      >
        Next →
      </button>
    </div>
  );
}

const PAGE_SIZE = 10;

function AdminInner() {
  const { isLoaded, user } = useUser();
  const convexUrl = getConvexUrl();
  const queryArgs = convexUrl && user ? { clerkId: user!.id } : "skip";
  const me = useQuery(
    convexUrl && user ? (api as any).users.getByClerkId : ("skip" as any),
    queryArgs,
  );
  const syncRole = useMutation((api as any).users.upsertFromClerk);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [spendingPage, setSpendingPage] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [subsPage, setSubsPage] = useState(0);

  // Self-heal: the role is derived from ADMIN_EMAIL at write time, so an
  // owner who signed in before ADMIN_EMAIL was set still sits on role "user".
  // Re-running the upsert for our own account picks up the admin role.
  useEffect(() => {
    if (!convexUrl || !user || me !== null) return;
    const email = user.primaryEmailAddress?.emailAddress?.trim() ?? "";
    if (!email) return;
    syncRole({ clerkId: user.id, email }).catch((e: any) =>
      setSyncError(e?.message ?? "role sync failed"),
    );
  }, [convexUrl, user, me, syncRole]);

  const isAdmin = me?.role === "admin";
  const submissions = useQuery(
    convexUrl && isAdmin ? (api as any).submissions.listAll : ("skip" as any),
    convexUrl && isAdmin ? {} : "skip",
  );
  const users = useQuery(
    convexUrl && isAdmin ? (api as any).users.listAll : ("skip" as any),
    convexUrl && isAdmin ? {} : "skip",
  );
  const creditRows = useQuery(
    convexUrl && isAdmin ? (api as any).credits.listAll : ("skip" as any),
    convexUrl && isAdmin ? {} : "skip",
  );

  // Revenue math: 1 credit = $0.99 (100 credits — $99). Every account starts
  // with 3 free signup credits, so paid credits = lifetimeAdded − 3.
  const PRICE_PER_CREDIT = 0.99;
  const FREE_SIGNUP_CREDITS = 3;
  const paidOf = (lifetimeAdded: number) => Math.max(0, (lifetimeAdded ?? 0) - FREE_SIGNUP_CREDITS);
  const money = (credits: number) =>
    `$${(credits * PRICE_PER_CREDIT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const emailByClerkId = new Map<string, { email: string; createdAt?: number }>();
  for (const u of users ?? []) {
    if (typeof u?.clerkId === "string") emailByClerkId.set(u.clerkId, { email: u.email, createdAt: u.createdAt });
  }
  const spending = (creditRows ?? []).map((c: any) => {
    const owner = String(c.ownerClerkId ?? "");
    const meta = emailByClerkId.get(owner);
    const lifetimeAdded = typeof c.lifetimeAdded === "number" ? c.lifetimeAdded : 0;
    const lifetimeUsed = typeof c.lifetimeUsed === "number" ? c.lifetimeUsed : 0;
    return {
      owner,
      email: meta?.email ?? `${owner.slice(0, 8)}…`,
      joined: meta?.createdAt,
      balance: typeof c.balance === "number" ? c.balance : 0,
      lifetimeAdded,
      lifetimeUsed,
      paid: paidOf(lifetimeAdded),
    };
  }).sort((a: any, b: any) => b.lifetimeUsed - a.lifetimeUsed);

  const totalRevenue = spending.reduce((s: number, r: any) => s + r.paid, 0);
  const totalUsed = spending.reduce((s: number, r: any) => s + r.lifetimeUsed, 0);
  const totalBalance = spending.reduce((s: number, r: any) => s + r.balance, 0);

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user) return <div className="mx-auto max-w-6xl px-4 py-12"><Link className="underline" href="/sign-in">Sign in</Link> required.</div>;
  if (!convexUrl) return <div className="mx-auto max-w-6xl px-4 py-12">Backend not configured.</div>;
  if (me === undefined) return <div className="mx-auto max-w-6xl px-4 py-12">Checking role…</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-bold">Forbidden — admin only.</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
          Signed in as {user.primaryEmailAddress?.emailAddress ?? user.id}. Admin access is granted
          to the address in ADMIN_EMAIL.
        </p>
        {syncError && <p className="mt-2 text-sm" style={{ color: "var(--color-warning)" }}>{syncError}</p>}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" style={{ background: "var(--color-paper)" }}>
      <p className="mono-label" style={{ color: "var(--color-muted)" }}>Admin</p>
      <h1 className="font-display mt-2 text-3xl font-semibold" style={{ color: "var(--color-ink)" }}>
        Admin
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Signed in as {me?.email ?? user.primaryEmailAddress?.emailAddress} · <Pill tone="ok">Admin</Pill>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total revenue", value: money(totalRevenue), note: `${totalRevenue.toLocaleString()} paid credits · $0.99 each` },
          { label: "Credits used", value: totalUsed.toLocaleString(), note: "lifetime follow-ups" },
          { label: "Credits outstanding", value: totalBalance.toLocaleString(), note: "unused balances" },
          { label: "Customers", value: String(spending.length), note: "accounts with credit rows" },
        ].map((c) => (
          <div key={c.label} className="rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
            <p className="mono-label" style={{ color: "var(--color-muted)" }}>{c.label}</p>
            <p className="tnum mt-1 text-2xl font-semibold" style={{ color: "var(--color-ink)" }}>{creditRows === undefined ? "…" : c.value}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>{c.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          Spending by customer ({spending.length})
        </h2>
        {creditRows === undefined ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading spending…</p>
        ) : spending.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>No customer spending yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="tnum w-full text-sm">
              <thead>
                <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                  <th>Customer</th><th>Used</th><th>Spend</th><th>Balance</th><th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {spending.slice(spendingPage * PAGE_SIZE, spendingPage * PAGE_SIZE + PAGE_SIZE).map((r: any) => (
                  <tr key={r.owner} className="border-t">
                    <td>{r.email}</td>
                    <td>{r.lifetimeUsed.toLocaleString()}</td>
                    <td>{money(r.lifetimeUsed)}</td>
                    <td><Pill tone={r.balance > 0 ? "ok" : "muted"}>{`${r.balance.toLocaleString()} credits`}</Pill></td>
                    <td>{fmtDate(r.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={spendingPage}
          pages={Math.ceil(spending.length / PAGE_SIZE)}
          total={spending.length}
          onPage={setSpendingPage}
        />
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          Spend = credits used × $0.99. Revenue above counts paid credits only (signup free 3 excluded).
        </p>
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          Users ({users?.length ?? 0})
        </h2>
        {!users ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading users…</p>
        ) : users.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>No users yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="tnum w-full text-sm">
              <thead>
                <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                  <th>Email</th><th>Role</th><th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(usersPage * PAGE_SIZE, usersPage * PAGE_SIZE + PAGE_SIZE).map((u: any) => (
                  <tr key={u._id} className="border-t">
                    <td>{u.email}</td>
                    <td>
                      <Pill tone={u.role === "admin" ? "ok" : "muted"}>
                        {u.role === "admin" ? "Admin" : "User"}
                      </Pill>
                    </td>
                    <td>{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={usersPage}
          pages={Math.ceil((users?.length ?? 0) / PAGE_SIZE)}
          total={users?.length ?? 0}
          onPage={setUsersPage}
        />
      </div>

      <div className="mt-6 rounded-[10px] border p-4" style={{ borderColor: "var(--color-rule-2)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
          Submissions ({submissions?.length ?? 0})
        </h2>
        {!submissions ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>Loading submissions…</p>
        ) : submissions.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>No submissions yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="tnum w-full text-sm">
              <thead>
                <tr className="mono-label text-left" style={{ color: "var(--color-muted)" }}>
                  <th>Owner</th><th>Client</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Credits</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(submissions ?? []).slice(subsPage * PAGE_SIZE, subsPage * PAGE_SIZE + PAGE_SIZE).map((s: any) => (
                  <tr key={s._id} className="border-t">
                    <td className="font-mono text-xs">{String(s.ownerClerkId ?? "").slice(0, 8)}…</td>
                    <td>{s.clientName}</td><td>{s.invoiceId}</td>
                    <td>{typeof s.amount === "number" ? s.amount.toFixed(2) : "—"}</td>
                    <td>
                      <Pill tone={s.status === "chased" ? "ok" : "muted"}>
                        {s.status === "chased" ? "Followed up" : String(s.status ?? "—")}
                      </Pill>
                    </td>
                    <td>{s.creditsUsed}</td>
                    <td>{fmtDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={subsPage}
          pages={Math.ceil((submissions?.length ?? 0) / PAGE_SIZE)}
          total={submissions?.length ?? 0}
          onPage={setSubsPage}
        />
      </div>
    </div>
  );
}

export default function Page() {
  if (!getClerkPublishableKey()) return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <AdminInner />;
}
