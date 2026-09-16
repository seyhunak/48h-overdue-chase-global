import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <div className="mx-auto max-w-md px-4 py-16">Auth not configured. Set Clerk keys via scripts/seed-env.sh.</div>;
  }
  return (
    <div className="mx-auto flex max-w-md justify-center px-4 py-16">
      <SignUp routing="path" path="/sign-up" afterSignUpUrl="/app" />
    </div>
  );
}
