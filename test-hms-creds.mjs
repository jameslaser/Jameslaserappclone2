// Validate HMS credentials by attempting a login request
import { readFileSync } from "fs";
import { execSync } from "child_process";

// Load env from the webdev env file if available
try {
  const envFile = "/opt/.manus/webdev.sh.env";
  const lines = readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^export\s+([A-Z0-9_]+)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}

const base = process.env.HMS_BASE_URL;
const user = process.env.HMS_USERNAME;
const pass = process.env.HMS_PASSWORD;

console.log("HMS_BASE_URL set:", !!base, base ? `(${base.substring(0, 40)}...)` : "(empty)");
console.log("HMS_USERNAME set:", !!user);
console.log("HMS_PASSWORD set:", !!pass);

if (!base || !user || !pass) {
  console.error("❌ One or more HMS credentials are missing.");
  process.exit(1);
}

// Attempt a lightweight login request to verify credentials
try {
  const loginUrl = `${base.replace(/\/$/, "")}/Login/Login`;
  console.log(`\nAttempting login at: ${loginUrl}`);

  const body = new URLSearchParams({
    username: user,
    password: pass,
  });

  const res = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; LaserClinicSync/1.0)",
    },
    body: body.toString(),
    redirect: "manual",
  });

  console.log("Response status:", res.status);
  console.log("Response headers location:", res.headers.get("location") ?? "(none)");

  const setCookie = res.headers.get("set-cookie");
  const hasSession = setCookie && (setCookie.includes("ASP.NET_SessionId") || setCookie.includes("session") || setCookie.includes("auth"));

  if (res.status === 302 || res.status === 200 || hasSession) {
    console.log("✅ HMS credentials appear valid — server responded with status", res.status);
    if (hasSession) console.log("✅ Session cookie received");
  } else {
    console.warn("⚠️  Unexpected response status:", res.status, "— credentials may be invalid or endpoint path differs");
  }
} catch (err) {
  console.error("❌ Connection failed:", err.message);
  console.log("This may mean HMS_BASE_URL is unreachable from this environment, or the login path differs.");
  process.exit(1);
}
