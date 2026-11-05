# Mayaleen – Installation guide (for non-coders)

This guide shows you, step by step, how to install the Mayaleen website and booking system in three places:

- **Part A – Your own computer** (to try it out or make changes safely)
- **Part B – cPanel hosting** (shared hosting with a control panel)
- **Part C – A VPS** (your own virtual server, for example DigitalOcean, Vultr, Hostinger VPS, Contabo)

You do **not** need to know programming. You will copy and paste a few commands. Every command is in a grey box – copy it exactly.

> **Which one should I choose for the live website?**
> - It already runs on **Vercel + Neon** today (see `docs/DEPLOY.md`). That is the easiest and cheapest choice, and you do not need this guide for it.
> - Choose **cPanel** only if your hosting company supports **Node.js apps** (look for “Setup Node.js App” in cPanel). Many cheap shared hosts do not.
> - Choose a **VPS** if you want full control. It needs about 1 hour the first time.

---

## Before you start – things you need in every case

### 1. The project files

Download them one of two ways:

- **From GitHub (recommended):** open https://github.com/sayeedsumon/mayaleen → green **Code** button → **Download ZIP**. Unzip it. You get a folder called `mayaleen` (it may be called `mayaleen-main` – that is fine).
- **Or** use the `mayaleen.zip` file you were sent.

### 2. A PostgreSQL database

Mayaleen stores bookings, guests, prices and photos in a **PostgreSQL** database (not MySQL). You have three options:

| Option | Good for | Cost |
|---|---|---|
| **Neon** (neon.tech) – a database in the cloud | Everything. Easiest. | Free plan |
| PostgreSQL in your **cPanel** (“PostgreSQL Databases” icon) | cPanel, if your host offers it | Included |
| PostgreSQL installed on your **VPS** | VPS | Free |

You will need the database’s **connection address**. It looks like this:

```
postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE_NAME
```

**To get one from Neon (easiest):**
1. Go to https://neon.tech and sign up (free).
2. Click **New Project**. Name: `mayaleen`. Region: **Singapore** (closest to Bangladesh). Click **Create**.
3. On the project page click **Connect**. You will see a connection string starting with `postgresql://`.
4. Copy it **twice**:
   - With **Connection pooling ON** → this is your `DATABASE_URL`.
   - With **Connection pooling OFF** → this is your `DIRECT_URL`.
5. Keep both somewhere safe (for example a note on your computer). They contain a password.

> For testing on your own computer, do **not** use the database of the live website. In Neon, create a separate project (or a **branch** called `dev`) for testing.

### 3. Your secret keys (the `.env` file)

The app reads its settings from a small text file called **`.env`** inside the project folder. You will create it in each part below. It looks like this:

```
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
SESSION_SECRET="a-long-random-text"
FIELD_ENCRYPTION_KEY="64-letters-and-numbers"
CRON_SECRET="another-long-random-text"
SITE_URL="https://your-domain.com"
ADMIN_MOBILE="01XXXXXXXXX"
ADMIN_PASSWORD="choose-a-strong-password"
```

What each line means:

| Setting | What to put | Required? |
|---|---|---|
| `DATABASE_URL` | Database connection address (pooled, if Neon) | Yes |
| `DIRECT_URL` | Database connection address (direct). If not Neon, the **same** as `DATABASE_URL` | Yes |
| `SESSION_SECRET` | Any long random text (keeps staff logged in safely) | Yes |
| `FIELD_ENCRYPTION_KEY` | Exactly 64 letters/numbers (0–9, a–f). Encrypts guests’ NID numbers | Yes |
| `CRON_SECRET` | Any long random text (protects the daily clean-up task) | Yes |
| `SITE_URL` | Your website address, e.g. `https://mayaleen.com` (used in SMS links) | Yes on a live site |
| `ADMIN_MOBILE` | Mobile number for the first admin login | Recommended |
| `ADMIN_PASSWORD` | Password for the first admin login | **Yes on a live site** |
| `SMS_URL_TEMPLATE` | Your SMS company’s send link with `{to}` and `{text}` in it | Optional |
| `RESEND_API_KEY` | Key from resend.com, to send emails | Optional |
| `EMAIL_FROM` | Sender, e.g. `Mayaleen <booking@yourdomain.com>` | Optional (with Resend) |

**How to make the random keys:** after you install Node.js (see each part), run this command three times and copy each result:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use one result for `SESSION_SECRET`, one for `FIELD_ENCRYPTION_KEY`, one for `CRON_SECRET`.

> ⚠️ **Very important about `FIELD_ENCRYPTION_KEY`:**
> - Never change it once real bookings exist, or the saved NID numbers can no longer be read.
> - If you move an existing live database to a new server, copy the **same** key from the old server (on Vercel: Project → Settings → Environment Variables).
> - Never share your `.env` file or put it on GitHub.

---

## Part A – Install on your own computer (Windows or Mac)

Time: about 20 minutes.

### Step A1 – Install Node.js
1. Go to https://nodejs.org
2. Download the **LTS** version (version 20 or newer) and install it (click Next → Next → Finish).
3. Check it worked. Open a terminal:
   - **Windows:** press the Start button, type `cmd`, press Enter.
   - **Mac:** press Cmd + Space, type `Terminal`, press Enter.
4. Type this and press Enter:
   ```bash
   node -v
   ```
   You should see something like `v20.x.x` or `v22.x.x`.

### Step A2 – Get a database
Easiest: create a free **Neon** project or branch for testing (see “Before you start”, step 2).

<details>
<summary>Or: install PostgreSQL on your computer instead (optional)</summary>

- **Mac:** install https://postgresapp.com, open it, click **Initialize**. Your address is
  `postgresql://YOUR_MAC_USERNAME@localhost:5432/postgres`
- **Windows:** install from https://www.postgresql.org/download/windows/ (keep the default port 5432, remember the password you choose). Your address is
  `postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres`

Use the same address for `DATABASE_URL` and `DIRECT_URL`.
</details>

### Step A3 – Open the project folder in the terminal
1. Unzip the project somewhere easy, for example your **Desktop**.
2. In the terminal, go into the folder:
   - **Windows:**
     ```bash
     cd %USERPROFILE%\Desktop\mayaleen
     ```
   - **Mac:**
     ```bash
     cd ~/Desktop/mayaleen
     ```
   (If your folder is called `mayaleen-main`, use that name instead.)

### Step A4 – Install the app’s parts
```bash
npm install
```
This downloads everything the app needs. It takes 1–3 minutes. Warnings in yellow are normal.

### Step A5 – Create the `.env` file
1. In the project folder, find the file **`.env.example`**.
2. Make a copy of it and rename the copy to **`.env`** (exactly, with the dot, no `.txt` at the end).
   - Windows tip: in File Explorer, turn on **View → File name extensions** so you can see the real name.
3. Open `.env` with Notepad (Windows) or TextEdit (Mac) and fill in the values from “Before you start”, step 3.
   For your own computer, use `SITE_URL="http://localhost:3000"`.
4. Save the file.

### Step A6 – Create the tables and the first admin
Run these two commands, one after the other:
```bash
npx prisma db push
```
```bash
npm run db:seed
```
You should see: `Created admin 01XXXXXXXXX`.

### Step A7 – Start the website
```bash
npm run dev
```
Wait until you see `Ready`. Then open your browser:

- Website: http://localhost:3000
- Admin panel: http://localhost:3000/admin – log in with `ADMIN_MOBILE` and `ADMIN_PASSWORD`.

To **stop** it, click the terminal and press **Ctrl + C**. To **start again** later, open the terminal, go into the folder (Step A3) and run `npm run dev` again.

---

## Part B – Install on cPanel hosting

Time: about 45 minutes.

### Check first (ask your hosting company if unsure)
- ✅ cPanel has **“Setup Node.js App”** (sometimes under *Software*), with **Node.js 20 or newer**.
- ✅ You can use **Terminal** in cPanel (or SSH).
- ✅ Your plan has at least **1 GB of memory** for the app (building the app needs memory).
- ✅ A **PostgreSQL** database: either **“PostgreSQL Databases”** in cPanel, or use **Neon** (free).

If any of these is missing, use a **VPS** (Part C) or keep Vercel instead.

### Step B1 – Create the database
**If you use Neon:** follow “Before you start”, step 2, and skip to B2.

**If you use cPanel PostgreSQL:**
1. cPanel → **PostgreSQL Databases**.
2. **Create New Database:** name `mayaleen` → Create. (cPanel adds your username in front, e.g. `cpuser_mayaleen`.)
3. **Add New User:** name `mayaleen`, create a strong password → Create User. (It becomes e.g. `cpuser_mayaleen`.)
4. **Add User To Database:** choose that user and database → Submit → tick **ALL PRIVILEGES** → Make Changes.
5. Your address is:
   ```
   postgresql://cpuser_mayaleen:YOUR_PASSWORD@localhost:5432/cpuser_mayaleen
   ```
   Use it for both `DATABASE_URL` and `DIRECT_URL`. (If your password has symbols like `@ # /`, choose a password with only letters and numbers to avoid problems.)

### Step B2 – Upload the files
1. cPanel → **File Manager**.
2. Go to your home folder (the top folder, **not** inside `public_html`).
3. Click **New Folder** → name it `mayaleen`.
4. Open the new folder → **Upload** → choose the project ZIP.
5. Right-click the ZIP → **Extract**. If it creates an inner folder (like `mayaleen-main`), open it, **Select All**, **Move** everything up into `/home/YOURUSER/mayaleen`, then delete the empty inner folder and the ZIP.
6. You should now see files like `package.json`, `server.js`, `next.config.mjs` and folders `src`, `prisma`, `public` directly inside `mayaleen`.

### Step B3 – Create the `.env` file
1. In File Manager, inside `mayaleen`, click **+ File** → name it `.env` → Create.
   (If you cannot see it afterwards: **Settings** (top right) → tick **Show Hidden Files**.)
2. Right-click `.env` → **Edit** → paste your settings from “Before you start”, step 3. Use your real domain for `SITE_URL`, e.g. `https://mayaleen.com`.
3. **Save Changes**.

### Step B4 – Create the Node.js app
1. cPanel → **Setup Node.js App** → **Create Application**.
2. Fill in:
   - **Node.js version:** 20 or the newest offered (22 is fine).
   - **Application mode:** `Production`
   - **Application root:** `mayaleen`
   - **Application URL:** your domain (e.g. `mayaleen.com`), leave the path empty.
   - **Application startup file:** `server.js`
3. Click **Create**.
4. At the top of the page, copy the line that starts with **`source /home/...`** (“Enter to the virtual environment”). You need it in the next step.

### Step B5 – Install and build (in the Terminal)
1. cPanel → **Terminal** (under *Advanced*).
2. Paste the `source ...` line you copied and press Enter. Then go into the folder:
   ```bash
   cd ~/mayaleen
   ```
3. Install the app’s parts (including the tools needed to build):
   ```bash
   npm install --include=dev
   ```
4. Create the tables and the first admin:
   ```bash
   npx prisma db push
   ```
   ```bash
   npm run db:seed
   ```
5. Build the website (takes 2–5 minutes):
   ```bash
   npm run build
   ```
   If it stops with `Killed` or `out of memory`, your plan does not have enough memory. Ask your host to raise the limit, or use a VPS.

### Step B6 – Start it
1. Go back to **Setup Node.js App** → click **Restart** on your app.
2. Open your domain in the browser. You should see the Mayaleen website.
3. Admin panel: `https://your-domain/admin`.

### Step B7 – Turn on HTTPS (the padlock)
cPanel → **SSL/TLS Status** → tick your domain → **Run AutoSSL**. Wait a few minutes.

### Step B8 – Daily clean-up task (cron)
This releases unpaid holds, sends payment reminders and retries failed SMS.
1. cPanel → **Cron Jobs**.
2. **Common Settings:** *Once Per Day*. (Better: set **Minute** `*/30` and the rest `*` to run every 30 minutes.)
3. **Command** (replace the two CAPITAL parts):
   ```bash
   curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/cron/expire-holds > /dev/null
   ```
4. **Add New Cron Job**.

> If something does not work, open **Setup Node.js App** → your app → check the log file (often `stderr.log` in the `mayaleen` folder) and send it to your developer.

---

## Part C – Install on a VPS (Ubuntu)

Time: about 1 hour. These steps are for **Ubuntu 22.04 or 24.04**. Choose a VPS with at least **1 GB memory** (2 GB is more comfortable), located in **Singapore** or **India** for speed.

### Step C1 – Point your domain to the VPS
At your domain company (Namecheap, GoDaddy, etc.) → DNS settings → add an **A record**:
- **Host:** `@` → **Value:** your VPS IP address
- **Host:** `www` → **Value:** your VPS IP address

It can take from 5 minutes to a few hours to start working.

### Step C2 – Connect to the VPS
- **Windows:** open **PowerShell** (Start → type `PowerShell`).
- **Mac:** open **Terminal**.

Type (replace with your VPS IP), press Enter, type `yes` if asked, then your VPS password:
```bash
ssh root@YOUR_VPS_IP
```

From now on, every command runs **on the VPS**.

### Step C3 – Update the server and install the tools
Copy and run these one by one:
```bash
apt update && apt upgrade -y
```
```bash
apt install -y curl git nginx postgresql
```
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
```
```bash
apt install -y nodejs
```
```bash
npm install -g pm2
```
Check:
```bash
node -v
```
It should show `v22.x.x`.

### Step C4 – Create the database
Run (and **change** `CHOOSE_A_STRONG_PASSWORD` – use only letters and numbers):
```bash
sudo -u postgres psql -c "CREATE USER mayaleen WITH PASSWORD 'CHOOSE_A_STRONG_PASSWORD';"
```
```bash
sudo -u postgres psql -c "CREATE DATABASE mayaleen OWNER mayaleen;"
```
Your address is:
```
postgresql://mayaleen:CHOOSE_A_STRONG_PASSWORD@localhost:5432/mayaleen
```
(Or use Neon instead – then skip this step.)

### Step C5 – Get the project onto the VPS
The GitHub repository is private, so the simplest way is to upload the ZIP from your computer.

**On your own computer** (a new PowerShell/Terminal window, not the VPS one), go to the folder with the ZIP and run:
```bash
scp mayaleen.zip root@YOUR_VPS_IP:/var/www/
```
**Back on the VPS:**
```bash
apt install -y unzip && mkdir -p /var/www && cd /var/www && unzip mayaleen.zip
```
If the folder is called `mayaleen-main`, rename it:
```bash
mv /var/www/mayaleen-main /var/www/mayaleen
```
Then go in:
```bash
cd /var/www/mayaleen
```

### Step C6 – Create the `.env` file
```bash
nano .env
```
A simple editor opens. Paste your settings (right-click pastes in most terminals). Use `SITE_URL="https://your-domain.com"`.
Save: press **Ctrl + O**, then **Enter**. Exit: **Ctrl + X**.

### Step C7 – Install, create tables, build
```bash
npm install --include=dev
```
```bash
npx prisma db push
```
```bash
npm run db:seed
```
```bash
npm run build
```
If the build stops with `Killed`, add temporary memory (swap) and run `npm run build` again:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

### Step C8 – Start the app and keep it running
```bash
pm2 start npm --name mayaleen -- start
```
```bash
pm2 save && pm2 startup
```
(If `pm2 startup` prints a command, copy and run it.) The app now runs on port 3000 and restarts by itself after a reboot.

### Step C9 – Connect your domain (Nginx)
```bash
nano /etc/nginx/sites-available/mayaleen
```
Paste this (replace `your-domain.com` twice), then save (Ctrl + O, Enter, Ctrl + X):
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
Turn it on:
```bash
ln -s /etc/nginx/sites-available/mayaleen /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```
Open `http://your-domain.com` – you should see the website.

### Step C10 – Turn on HTTPS (free certificate)
```bash
apt install -y certbot python3-certbot-nginx
```
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```
Enter your email, agree, and choose to **redirect** HTTP to HTTPS. The certificate renews by itself.

### Step C11 – Daily clean-up task (cron)
```bash
crontab -e
```
(If asked, choose `1` for nano.) Add this line at the bottom (replace the two CAPITAL parts), then save:
```
*/30 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-DOMAIN/api/cron/expire-holds > /dev/null
```

### Step C12 – Firewall (recommended)
```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

### Useful VPS commands
| What | Command |
|---|---|
| See if the app is running | `pm2 status` |
| See the app’s recent messages / errors | `pm2 logs mayaleen --lines 100` |
| Restart the app | `pm2 restart mayaleen` |

---

## After installing – first things to do (all setups)

1. Log in to **`/admin`** with your `ADMIN_MOBILE` and `ADMIN_PASSWORD`.
2. **Settings › My account & password** – change the password if you used a simple one. Turn on 2-step login if you like.
3. **Settings › Rates & holidays** – check prices and holidays.
4. **Settings › Cabins** – rename the cabins and set their real types and capacity.
5. **Settings › Bank accounts** – enter your real bank details (guests see these when paying).
6. **Settings › Website text** – phone, WhatsApp, Facebook, meeting point, reviews.
7. **Settings › Website photos** – upload your photos.
8. **Settings › Staff & roles** – add your staff.
9. Make one test booking from the website and approve it in the admin panel.

---

## Updating to a new version later

When a new version is ready on GitHub (or you get a new ZIP):

1. **Back up first** (see below).
2. Replace the project files with the new ones, but **keep your `.env` file**.
3. Run, in the project folder:
   ```bash
   npm install --include=dev
   ```
   ```bash
   npx prisma db push
   ```
   ```bash
   npm run build
   ```
   > If `prisma db push` warns about **data loss**, stop and ask your developer before continuing.
4. Restart:
   - **Your computer:** stop with Ctrl + C, then `npm run dev`.
   - **cPanel:** Setup Node.js App → **Restart**.
   - **VPS:** `pm2 restart mayaleen`.

---

## Backups (please do this!)

Your bookings, guests, photos and settings are all in the database.

- **Neon:** has automatic history on its plans; you can also download a copy from the Neon dashboard.
- **cPanel:** cPanel → **Backup** → download a **PostgreSQL database** backup. Do this weekly.
- **VPS:** run this once to save a backup every night at 2 a.m. (keeps them in `/var/backups`):
  ```bash
  (crontab -l; echo '0 2 * * * sudo -u postgres pg_dump mayaleen | gzip > /var/backups/mayaleen-$(date +\%F).sql.gz') | crontab -
  ```
  Copy those files to your computer or Google Drive from time to time.

Also keep a safe copy of your **`.env` file** (especially `FIELD_ENCRYPTION_KEY`).

---

## Moving the existing live data (from Neon) to a new server – optional

Only needed if you want to bring over the bookings that are already on the live site.
On the VPS (it has the tools from Step C3), replace the two addresses:
```bash
pg_dump "NEON_DIRECT_URL" --no-owner --no-acl > live-backup.sql
```
```bash
psql "NEW_DATABASE_URL" < live-backup.sql
```
Do this **instead of** `npx prisma db push` and `npm run db:seed` on an empty database, and use the **same** `FIELD_ENCRYPTION_KEY` and `SESSION_SECRET` as the live site.
(The tools need to be version 16 or newer. If `pg_dump` says “server version mismatch”, ask your developer.)

---

## Common problems

| Problem | What to do |
|---|---|
| `node` or `npm` “is not recognized” | Node.js is not installed, or close and reopen the terminal after installing it. |
| `Can't reach database server` | The `DATABASE_URL` is wrong, or the database is not running. Check spelling, password and port `5432`. On Neon, make sure the project is not paused. |
| `Authentication failed against database server` | Wrong database username or password in `.env`. |
| `FIELD_ENCRYPTION_KEY must be 64 hex chars` | The key must be exactly 64 characters using only `0–9` and `a–f`. Make a new one with the command in “Before you start”. |
| Build stops with `Killed` | Not enough memory. VPS: add swap (Step C7). cPanel: ask your host for more memory. |
| Website shows “502 Bad Gateway” (VPS) | The app is not running: `pm2 status`, then `pm2 logs mayaleen`. |
| Website shows an error page (cPanel) | Setup Node.js App → Restart. Check `stderr.log` in the `mayaleen` folder. |
| Can’t log in to admin | The first admin is created by `npm run db:seed` only when there are no staff yet, using `ADMIN_MOBILE` and `ADMIN_PASSWORD` from `.env`. If you forgot the password, another admin can reset it in **Settings › Staff & roles**; otherwise ask your developer. After 5 wrong tries, wait 10 minutes. |
| Payment screenshot upload fails | Files must be JPG, PNG or PDF and at most 4 MB. On a VPS check `client_max_body_size 10M;` is in the Nginx file. |
| SMS/emails not sent | Without `SMS_URL_TEMPLATE` / `RESEND_API_KEY` they are only saved (see **Settings › SMS & email**). Add the settings to `.env` and restart. |

---

*Questions you can send to your developer, together with: what you clicked, the exact error message, and (for VPS) the output of `pm2 logs mayaleen --lines 100`.*
