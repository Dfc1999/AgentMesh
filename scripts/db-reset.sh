#!/usr/bin/env bash
set -euo pipefail

docker compose down -v
docker compose up -d postgres redis
npx prisma migrate reset --force --schema prisma/schema.prisma
