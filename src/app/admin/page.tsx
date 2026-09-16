"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";

function AdminInner() {
  const { isLoaded, user } = useUser();
  const convexUrl = getConvexUrl();
  const me = useQuery(
    convexUrl && user ? (api as any).users.getByClerkId : ("skip" as any),
    convexUrl && user ? { clerkId: user!.id } : "skip",
  );
  const submissions = useQuery(
    convexUrl && me?.role === "admin" ? (api as any).submissions.listAll : ("skip" as any),
    convexUrl && me?.role === "admin" ? {} : "skip",
  );

  if (!isLoaded) return <div className="mx-auto max-w-6xl px-4 py-12">Loading…</div>;
  if (!user) return <div className="mx-auto max-w-6xl px-4 py-12"><Link className="underline" href="/sign-in">Sign in</Link> required.</div>;
  if (!convexUrl) return <div className="mx-auto max-w-6xl px-4 py-12">Backend not configured.</div>;
  if (me === undefined) return <div className="mx-auto max-w-6xl px-4 py-12">Checking role…</div>;
  if (me?.role !== "admin") return <div className="mx-auto max-w-6xl px-4 py-12">Forbidden — admin only.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Admin</h1>
      <p className="text-muted-foreground">Submissions + credits log</p>
      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-semibold">Submissions ({submissions?.length ?? 0})</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground"><th>Owner</th><th>Client</th><th>Invoice</th><th>Amount</th><th>Status</th><th>Credits</th></tr>
          </thead>
          <tbody>
            {(submissions ?? []).map((s: any) => (
              <tr key={s._id} className="border-t">
                <td className="font-mono text-xs">{s.ownerClerkId.slice(0, 8)}…</td>
                <td>{s.clientName}</td><td>{s.invoiceId}</td>
                <td>{s.amount}</td><td>{s.status === "chased" ? "followed up" : s.status}</td><td>{s.creditsUsed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  if (!getClerkPublishableKey()) return <div className="mx-auto max-w-6xl px-4 py-12">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  return <AdminInner />;
}
