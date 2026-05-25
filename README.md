# ELY (ely.ai)

AI companion with personality-driven interactions, visual avatar, task modules, Model Nexus, MLM affiliate program, and gamification.

## Architecture

- **apps/web** — Next.js 15 (marketing + app, mobile-first)
- **apps/api** — Fastify REST API
- **apps/ws** — Socket.io real-time chat
- **apps/worker** — Cron jobs (commissions, reports)
- **packages/db** — Drizzle ORM + PostgreSQL schema
- **packages/personality** — BFI-2 scoring + prompt builder
- **packages/ai** — ELY Core + Model Nexus
- **packages/mlm** — Commission engine + genealogy
- **packages/gamification** — XP, quests, badges, streaks
- **packages/chat** — Shared chat persistence

## Quick Start

```bash
pnpm install
cp .env.example .env
# Set DATABASE_URL, OPENAI_API_KEY, etc.

# Local Postgres + Redis
docker compose up -d

# Push schema to database
pnpm db:push

# Seed quests, badges, avatar items
pnpm db:seed

# Run all services
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- WebSocket: http://localhost:3002

## Railway Deployment

1. Push to GitHub (`xfloxx09/ely2`)
2. Connect repo in Railway
3. Create 4 services from the monorepo:
   - **web**: Root `/`, start `pnpm --filter @ely/web start`
   - **api**: start `pnpm --filter @ely/api start`
   - **ws**: start `pnpm --filter @ely/ws start`
   - **worker**: start `pnpm --filter @ely/worker start`
4. Add PostgreSQL + Redis addons
5. Set environment variables (see `.env.example`)
6. Add custom domain `ely.ai` to web service

## Environment Variables

See `.env.example` for the full list. Critical vars:

- `DATABASE_URL` — Railway PostgreSQL
- `REDIS_URL` — Railway Redis
- `OPENAI_API_KEY` — ELY Core AI
- `STRIPE_SECRET_KEY` — Billing
- `PERSONALITY_ENCRYPTION_KEY` — 32-byte hex
- `NEXTAUTH_URL` — https://ely.ai

## Security

Rotate Railway DB password after first deploy. Never commit credentials.
