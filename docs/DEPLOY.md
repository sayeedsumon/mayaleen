# Deploy to Vercel + Neon

About 15 minutes. Do these in order.

## 1. Neon (database)

1. Create a project at https://console.neon.tech. Pick the **Singapore (aws-ap-southeast-1)** region, the closest to Bangladesh. Postgres 16 or newer.
2. On the project dashboard click **Connect** and copy two connection strings:
   - **Pooled** (host contains `-pooler`): this is `DATABASE_URL`. Make sure it ends with `?sslmode=require`, and add `&pgbouncer=true`.
   - **Direct** (toggle off "Connection pooling"): this is `DIRECT_URL`.

## 2. Create the tables and the first admin (once, from any computer)

```bash
git clone https://github.com/sayeedsumon/mayaleen.git && cd mayaleen && npm install
export DATABASE_URL="<pooled url>"
export DIRECT_URL="<direct url>"
npx prisma db push
ADMIN_MOBILE=01XXXXXXXXX ADMIN_PASSWORD='choose-a-long-password' npm run db:seed
```

On Windows PowerShell use `$env:DATABASE_URL="..."` instead of `export`.

The seed creates the cabins, rates, child age bands, 2027 fixed-date holidays, a placeholder bank account and your admin login. Use your real mobile and a strong password. Seeding is safe to repeat; it never overwrites existing data.

## 3. Vercel (hosting)

1. At https://vercel.com/new import the GitHub repo `sayeedsumon/mayaleen`. Framework is detected as Next.js.
2. Add these **Environment Variables** (Production and Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL (with `pgbouncer=true`) |
| `DIRECT_URL` | Neon direct URL |
| `SESSION_SECRET` | output of `openssl rand -hex 32` |
| `FIELD_ENCRYPTION_KEY` | a different `openssl rand -hex 32` (**exactly 64 hex characters**) |

3. Deploy. `vercel.json` already pins functions to Singapore (`sin1`).
4. Open `https://<your-project>.vercel.app/admin/login` and sign in.

**Back up `FIELD_ENCRYPTION_KEY` somewhere safe.** NID numbers are encrypted with it. If it is lost, they cannot be read again. Changing it later makes existing NIDs unreadable.

## 4. After the first deploy

- In the admin panel go to **Bank accounts** and replace the placeholder with the real account. Invoices issued before that keep the placeholder.
- Add the real holidays once the government gazette is out (the seed only has fixed-date ones).
- Later: add your domain under Vercel, Project, Settings, Domains.

## Known limits on serverless (to fix in later phases)

- The sign-in lockout (5 tries) is kept in server memory, so on Vercel it resets between requests. Moving it into the database is planned for Phase 5 hardening. Use a strong admin password until then.
- Holds expire when the 5-minute job runs. That job is built in Phase 4 using a Vercel Cron or Neon-backed scheduler. Until then expired holds are not released automatically.
- Payment-proof uploads (Phase 3) will use Vercel Blob.
- Neon free tier pauses the database after inactivity, so the first request after a quiet period can take a second or two longer.
