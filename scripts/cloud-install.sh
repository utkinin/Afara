#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Afara
export NPM_CONFIG_CACHE=/workspace/.cache/npm
npm ci
if [ ! -f .env.local ]; then
  node --input-type=module <<'JS'
import fs from 'node:fs'
import crypto from 'node:crypto'
const body = ['DATABASE_URL=postgresql://postgres@127.0.0.1:5432/afara',`PAYLOAD_SECRET=${crypto.randomBytes(32).toString('hex')}`,'APP_URL=http://localhost:3000','AFARA_STAGE=development','AFARA_DB_PUSH=false','MEDIA_DIR=./media','SMTP_HOST=127.0.0.1','SMTP_PORT=1025','SMTP_FROM=afara@example.test',''].join('\n')
fs.writeFileSync('.env.local',body,{mode:0o600,flag:'wx'})
JS
fi
docker compose up -d --wait
# Only an empty database is initialized automatically. Existing content is never seeded/reset.
if [ "$(docker compose exec -T db psql -U postgres -d afara -At -c "SELECT to_regclass('public.pages') IS NULL")" = t ]; then
  AFARA_STAGE=build AFARA_DB_PUSH=false npm run db:migrate
fi
npm run generate:types
npm run generate:importmap
