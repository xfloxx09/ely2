#!/bin/bash
set -e
pnpm install
pnpm db:push || true
pnpm db:seed || true
pnpm --filter @ely/web build
