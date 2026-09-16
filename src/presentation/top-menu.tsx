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
    <span className="rounded-full border px-3 py-1" title="Credit balance">
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
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">
            Buy Credits
          </button>
        </form>
      )}
      {!isLoaded ? null : !user ? (
        <Link href="/sign-in" className="rounded-md border px-3 py-1.5">
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
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-6 w-6" aria-hidden />
          <span>OverdueChase</span>
        </Link>
        <nav className="ml-4 flex items-center gap-2 text-sm">
          <Link href="/app" className="rounded-md border px-3 py-1.5 hover:bg-muted">
            App
          </Link>
          <Link href="/admin" className="rounded-md border px-3 py-1.5 hover:bg-muted">
            Admin
          </Link>
        </nav>
        {clerkKey ? (
          <ClerkAware />
        ) : (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/sign-in" className="rounded-md border px-3 py-1.5">
              Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
