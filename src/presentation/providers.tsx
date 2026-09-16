"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";
import { getClerkPublishableKey, getConvexUrl } from "@/infrastructure/env";

export function Providers({ children }: { children: ReactNode }) {
  const clerkKey = getClerkPublishableKey();
  const convexUrl = getConvexUrl();
  const convex = useMemo(() => {
    if (!convexUrl) return null;
    try {
      return new ConvexReactClient(convexUrl);
    } catch {
      return null;
    }
  }, [convexUrl]);

  let tree = children;
  if (convex) tree = <ConvexProvider client={convex}>{tree}</ConvexProvider>;
  if (clerkKey) tree = <ClerkProvider publishableKey={clerkKey}>{tree}</ClerkProvider>;
  return <>{tree}</>;
}
