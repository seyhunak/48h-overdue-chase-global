#!/usr/bin/env bash
set -euo pipefail
# Seed script: prompts for keys, writes .env.local, runs convex codegen + build check.

prompt() {
  local var="$1" current="${!1:-}"
  if [ -n "$current" ]; then
    read -r -p "$var [$current]: " val || true
    if [ -z "${val:-}" ]; then val="$current"; fi
  else
    read -r -p "$var: " val || true
  fi
  printf '%s' "$val"
}

export NEXT_PUBLIC_CONVEX_URL="${NEXT_PUBLIC_CONVEX_URL:-}"
export CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT:-}"
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}"
export CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-}"
export CLERK_WEBHOOK_SECRET="${CLERK_WEBHOOK_SECRET:-}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
export STRIPE_PRICE_CREDITS="${STRIPE_PRICE_CREDITS:-}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-}"

NEXT_PUBLIC_CONVEX_URL="$(prompt NEXT_PUBLIC_CONVEX_URL)"
CONVEX_DEPLOYMENT="$(prompt CONVEX_DEPLOYMENT)"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$(prompt NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)"
CLERK_SECRET_KEY="$(prompt CLERK_SECRET_KEY)"
CLERK_WEBHOOK_SECRET="$(prompt CLERK_WEBHOOK_SECRET)"
STRIPE_SECRET_KEY="$(prompt STRIPE_SECRET_KEY)"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$(prompt NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"
STRIPE_WEBHOOK_SECRET="$(prompt STRIPE_WEBHOOK_SECRET)"
STRIPE_PRICE_CREDITS="$(prompt STRIPE_PRICE_CREDITS)"
NEXT_PUBLIC_SITE_URL="$(prompt NEXT_PUBLIC_SITE_URL)"
ADMIN_EMAIL="$(prompt ADMIN_EMAIL)"

cat > .env.local <<EOF
NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
CONVEX_DEPLOYMENT=$CONVEX_DEPLOYMENT
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET=$CLERK_WEBHOOK_SECRET
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_CREDITS=$STRIPE_PRICE_CREDITS
NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ADMIN_EMAIL=$ADMIN_EMAIL
EOF

echo "Wrote .env.local"
set -a; . ./.env.local; set +a

echo "→ convex codegen"
npx convex codegen || echo "(codegen skipped/failed — continuing)"

echo "→ convex dev --once"
npx convex dev --once --typecheck disable || echo "(convex dev skipped — check CONVEX_DEPLOYMENT)"

echo "→ build check"
npm run build

echo "✓ ready — register/login → buy credits (100 credits \$1k, \$10/credit, free 3) → start using"
