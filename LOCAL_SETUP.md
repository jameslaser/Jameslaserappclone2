# James's Laser Clinic — Local Development Setup

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| pnpm | latest | `npm install -g pnpm` |
| MySQL | 8.0+ | https://dev.mysql.com/downloads/ |

---

## Quick Start (3 steps)

### Step 1 — Configure environment

Copy the template and fill in your values:

```bash
cp local-env-template.txt .env
```

Open `.env` and set at minimum:

```
DATABASE_URL=mysql://root:yourpassword@127.0.0.1:3306/laser_clinic
JWT_SECRET=any_random_32_character_string_here
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123!
```

### Step 2 — Run setup (installs deps + creates DB + seeds admin)

```bash
chmod +x setup.sh && ./setup.sh
```

### Step 3 — Start the app

```bash
pnpm dev
```

Open **http://localhost:3000** in your browser.

---

## Admin Login

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | value you set in `ADMIN_EMAIL` |
| Password | value you set in `ADMIN_PASSWORD` |

---

## Manual Setup (if setup.sh fails)

```bash
# 1. Install dependencies
pnpm install

# 2. Create MySQL database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS laser_clinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Run database migrations
pnpm drizzle-kit migrate

# 4. Seed admin user
node seed-admin.mjs

# 5. Start dev server
pnpm dev
```

---

## Database Tables Created

After migrations, these tables will exist:

| Table | Purpose |
|-------|---------|
| `users` | Admin and staff accounts |
| `patients` | Patient records |
| `appointment_requests` | Incoming booking requests |
| `confirmed_appointments` | Scheduled appointments |
| `sessions` | Treatment session records |
| `follow_ups` | Post-treatment follow-up tasks |
| `machines` | Laser equipment registry |
| `clinic_settings` | Clinic configuration |
| `notifications` | In-app admin notifications |
| `hms_appointments` | Synced HMS appointment records |
| `hms_sync_log` | HMS sync run history |

---

## HMS Sync Configuration

The system is pre-configured to connect to:

```
https://newlook-hms.dataocean-cloud.com
```

Set these in your `.env` to enable live sync:

```
HMS_BASE_URL=https://newlook-hms.dataocean-cloud.com
HMS_USERNAME=NR011
HMS_PASSWORD=0557401562
```

To trigger a manual sync, go to **Admin → HMS Sync** and click **Sync Now**.

---

## Available Pages

| Route | Page |
|-------|------|
| `/login` | Admin login |
| `/dashboard` | Main dashboard with live stats |
| `/patients` | Patient records |
| `/requests` | Appointment requests |
| `/appointments` | Confirmed appointments |
| `/sessions` | Treatment sessions |
| `/follow-ups` | Follow-up tasks |
| `/machines` | Equipment management |
| `/users` | User management |
| `/settings` | Clinic settings |
| `/analytics` | Charts and analytics |
| `/export` | Data export / download |
| `/whatsapp` | WhatsApp tools |

---

## Troubleshooting

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
pnpm dev
```

**MySQL connection refused:**
```bash
# macOS
brew services start mysql

# Linux
sudo service mysql start

# Windows
net start MySQL80
```

**pnpm not found:**
```bash
npm install -g pnpm
```

**Migration fails:**
Ensure the database exists first:
```bash
mysql -u root -p -e "CREATE DATABASE laser_clinic;"
```
