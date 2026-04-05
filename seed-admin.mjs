/**
 * seed-admin.mjs
 * Creates or updates the admin user using ADMIN_EMAIL and ADMIN_PASSWORD env vars.
 * Run: node seed-admin.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, ".env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!DATABASE_URL) { console.error("ERROR: DATABASE_URL not set"); process.exit(1); }
if (!ADMIN_EMAIL) { console.error("ERROR: ADMIN_EMAIL not set"); process.exit(1); }
if (!ADMIN_PASSWORD) { console.error("ERROR: ADMIN_PASSWORD not set"); process.exit(1); }

// Parse DATABASE_URL: mysql://user:pass@host:port/db?ssl=true
const url = new URL(DATABASE_URL);
const isTiDB = url.port === "4000" || url.hostname.includes("tidbcloud") || url.searchParams.get("ssl") === "true";

const mysql2 = require("mysql2/promise");
const conn = await mysql2.createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  ssl: isTiDB ? { rejectUnauthorized: false } : undefined,
});

console.log(`Connected to database: ${url.hostname}:${url.port}${url.pathname}`);

const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const openId = `email:${ADMIN_EMAIL}`;

// Check if user exists by email
const [existing] = await conn.execute(
  "SELECT id, email, role FROM users WHERE email = ? LIMIT 1",
  [ADMIN_EMAIL]
);

if (existing.length > 0) {
  const user = existing[0];
  await conn.execute(
    "UPDATE users SET role = 'admin', isActive = true, passwordHash = ?, loginMethod = 'email', updatedAt = NOW() WHERE id = ?",
    [hash, user.id]
  );
  console.log(`✅ Updated existing user id=${user.id} email=${ADMIN_EMAIL} → role=admin, isActive=true, passwordHash set`);
} else {
  await conn.execute(
    `INSERT INTO users (openId, name, email, passwordHash, loginMethod, role, isActive, createdAt, updatedAt, lastSignedIn)
     VALUES (?, 'Admin', ?, ?, 'email', 'admin', true, NOW(), NOW(), NOW())`,
    [openId, ADMIN_EMAIL, hash]
  );
  console.log(`✅ Created new admin user: email=${ADMIN_EMAIL} role=admin isActive=true`);
}

// Verify
const [verify] = await conn.execute(
  "SELECT id, email, role, isActive, loginMethod FROM users WHERE email = ? LIMIT 1",
  [ADMIN_EMAIL]
);
console.log("DB verification:", verify[0]);

await conn.end();
console.log("Done.");
