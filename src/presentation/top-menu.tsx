"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getConvexUrl, getClerkPublishableKey } from "@/infrastructure/env";
import { api } from "../../convex/_generated/api";

function BalanceBadge({ clerkId }: { clerkId: string }) {
  const q = useQuery((api as any).credits.getBalance, { clerkId }) as any;
  if (typeof q?.balance !== "number") return null;
  return (
    <span
      className="mono-label tnum rounded-full border px-3 py-1"
      style={{ borderColor: "var(--color-rule-2)", color: "var(--color-ink-2)" }}
      title="Credit balance"
    >
      {q.balance} credits
    </span>
  );
}

function ClerkAware() {
  const { isLoaded, user } = useUser();
  const convexUrl = getConvexUrl();
  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
      {isLoaded && user && convexUrl && <BalanceBadge clerkId={user.id} />}
      {isLoaded && user && (
        <form action="/api/checkout" method="POST">
          <button
            type="submit"
            className="hallmark-btn hallmark-btn-primary px-3 py-1.5 font-semibold"
          >
            Buy Credits
          </button>
        </form>
      )}
      {!isLoaded ? null : !user ? (
        <Link
          href="/sign-in"
          className="hallmark-btn hallmark-link rounded-md border px-3 py-1.5"
          style={{ borderColor: "var(--color-rule-2)" }}
        >
          Login
        </Link>
      ) : (
        <UserButton />
      )}
    </div>
  );
}

export function TopMenu() {
  const clerkKey = getClerkPublishableKey();
  return (
    <header
      className="font-body-x"
      style={{
        background: "var(--color-paper)",
        borderBottom: "1px solid var(--color-rule)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: "var(--color-accent)" }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-accent-ink)" }} aria-hidden />
          </span>
          <span className="font-display text-base font-semibold" style={{ color: "var(--color-ink)" }}>
            OverdueChase
          </span>
        </Link>
        <nav className="ml-4 flex items-center gap-2 text-sm" aria-label="Primary">
          <Link
            href="/app"
            className="hallmark-btn hallmark-link rounded-md border px-3 py-1.5"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            App
          </Link>
          <Link
            href="/admin"
            className="hallmark-btn hallmark-link rounded-md border px-3 py-1.5"
            style={{ borderColor: "var(--color-rule-2)" }}
          >
            Admin
          </Link>
        </nav>
        {clerkKey ? (
          <ClerkAware />
        ) : (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link
              href="/sign-in"
              className="hallmark-btn rounded-md border px-3 py-1.5"
              style={{ borderColor: "var(--color-rule-2)" }}
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
