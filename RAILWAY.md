# Railway Deployment — Web Service

Your web URL: **https://web-production-b3008.up.railway.app**

## Required Environment Variables (Web Service)

Set these in Railway → your **web** service → Variables:

```bash
# App URLs
NEXTAUTH_URL=https://web-production-b3008.up.railway.app
NEXT_PUBLIC_APP_URL=https://web-production-b3008.up.railway.app
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_WS_URL=disabled

# Database (use Railway internal URL for best performance)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres.railway.internal:5432/railway

# Secrets (generate random 32+ char strings)
NEXTAUTH_SECRET=your-random-secret-here
PERSONALITY_ENCRYPTION_KEY=your-32-char-personality-key!!
API_KEY_ENCRYPTION_KEY=your-32-char-api-key-secret!!!!

# AI (required for chat to work)
OPENAI_API_KEY=sk-...

# Optional
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REPLICATE_API_TOKEN=
```

## What works with web-only deploy

With the API built into Next.js (`/api/*` routes), you only need the **web** service for:

- Marketing site
- Sign up / login
- BFI-2 personality test
- Chat with ELY (HTTP mode — no separate WebSocket service needed)
- Gamification, affiliate dashboard, settings

## Custom domain (ely.ai)

1. Railway → web service → Settings → Networking → Custom Domain
2. Add `ely.ai` and configure DNS CNAME to Railway
3. Update env vars:
   - `NEXTAUTH_URL=https://ely.ai`
   - `NEXT_PUBLIC_APP_URL=https://ely.ai`

## Optional: separate API + WebSocket services

When you add dedicated services later:

```bash
NEXT_PUBLIC_API_URL=https://your-api-service.up.railway.app
NEXT_PUBLIC_WS_URL=https://your-ws-service.up.railway.app
```

## Build & Start (Railway)

- **Build command:** `pnpm install && pnpm --filter @ely/web build`
- **Start command:** `pnpm --filter @ely/web start`

Railway sets `PORT` automatically — Next.js picks it up.

## After setting env vars

Redeploy the web service. Then visit:

https://web-production-b3008.up.railway.app

Test: Sign up → complete personality test → chat with ELY.
