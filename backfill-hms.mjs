/**
 * HMS Backfill Script — Feb 1 to Apr 10
 * 
 * Logs into HMS, fetches appointments day by day (to avoid response size limits),
 * and upserts into machine_appointments, hms_appointments, confirmed_appointments, and patients.
 */

import mysql from "mysql2/promise";

const HMS_BASE_URL = process.env.HMS_BASE_URL;
const HMS_USERNAME = process.env.HMS_USERNAME || "NR011";
const HMS_PASSWORD = process.env.HMS_PASSWORD || "0557401562";
const DATABASE_URL = process.env.DATABASE_URL;

const START_DATE = "2025-02-01";
const END_DATE = "2025-04-10";

// ─── HMS Login ───────────────────────────────────────────────────────────────

function getHmsOrigin() {
  try {
    return new URL(HMS_BASE_URL).origin;
  } catch {
    return HMS_BASE_URL.replace(/\/[^/]+$/, "");
  }
}

async function hmsLogin() {
  const origin = getHmsOrigin();
  console.log(`[Backfill] Connecting to HMS at ${origin}...`);

  // Step 1: Get session cookie
  const homeRes = await fetch(origin, { method: "GET", redirect: "follow" });
  const setCookie = homeRes.headers.get("set-cookie") || "";
  const sessionMatch = setCookie.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sessionMatch) throw new Error("Could not get session cookie");
  const sessionId = sessionMatch[1];
  const cookie = `ASP.NET_SessionId=${sessionId}`;

  // Step 2: Get permission groups
  const groupsRes = await fetch(`${origin}/DBAL/AUTHENTICATE_DBAL.aspx`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: `fName=GetPermGroups&uname=${HMS_USERNAME}`,
  });
  const groupsText = await groupsRes.text();
  const groupMatch = groupsText.match(/\^-\^(\d+)\^-\^/);
  if (!groupMatch) throw new Error(`Could not get groups: ${groupsText.substring(0, 100)}`);
  const gid = groupMatch[1];

  // Step 3: Login
  const loginRes = await fetch(`${origin}/DBAL/AUTHENTICATE_DBAL.aspx`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: `fName=CheckOTP&uname=${HMS_USERNAME}&pword=${HMS_PASSWORD}&gid=${gid}&OTP=`,
  });
  const newCookie = loginRes.headers.get("set-cookie")?.match(/ASP\.NET_SessionId=([^;]+)/);
  const activeCookie = newCookie ? `ASP.NET_SessionId=${newCookie[1]}` : cookie;
  const loginText = await loginRes.text();
  if (loginText.trim() === "INVALID") throw new Error("HMS login failed: INVALID");
  console.log(`[Backfill] Logged in as ${HMS_USERNAME}`);
  return { origin, cookie: activeCookie };
}

// ─── HMS Data Fetch ──────────────────────────────────────────────────────────

function parseHmsMultiResponse(raw) {
  const parts = raw.split("]^[");
  const all = [];
  for (const part of parts) {
    let p = part.trim();
    if (!p) continue;
    if (!p.startsWith("[")) p = "[" + p;
    if (!p.endsWith("]")) p = p + "]";
    try {
      const arr = JSON.parse(p);
      if (Array.isArray(arr)) all.push(...arr);
    } catch {}
  }
  return all;
}

function parseHmsDate(val) {
  if (!val) return null;
  const s = String(val);
  const m = s.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (m) return new Date(parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function deriveStatus(r) {
  if (r.STS_DEL === 1) return "Cancelled";
  if (r.STS_FIN === 1) return "Completed";
  if (r.STS_ATT === 1) return "Arrived";
  if (r.STS_MIS === 1) return "No-Show";
  if (r.STS_CON === 1) return "Confirmed";
  if (r.STS_NEW === 1) return "Pending";
  return "Pending";
}

function deriveArrivalStatus(r) {
  if (r.STS_ATT === 1) return "Arrived";
  if (r.STS_MIS === 1) return "No-Show";
  if (r.STS_FIN === 1) return "Arrived";
  return "Expected";
}

async function fetchDay(origin, cookie, from, to) {
  const res = await fetch(`${origin}/DBAL/DBAL.ASPX`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams({
      fName: "LoadAllAppointment",
      key: "",
      from,
      to,
      by: "date",
      status: "all",
      opt: "0",
    }).toString(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return parseHmsMultiResponse(raw);
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function dateRange(start, end) {
  const dates = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

// ─── DB Operations ───────────────────────────────────────────────────────────

async function getOrCreatePatient(conn, name, phone, patId, mrn) {
  // Try match by phone first
  if (phone && phone.trim()) {
    const [rows] = await conn.query("SELECT id FROM patients WHERE phone = ? LIMIT 1", [phone.trim()]);
    if (rows.length > 0) return rows[0].id;
  }
  // Try match by external_patient_id
  if (patId) {
    const [rows] = await conn.query("SELECT id FROM patients WHERE external_patient_id = ? LIMIT 1", [String(patId)]);
    if (rows.length > 0) return rows[0].id;
  }
  // Try match by name (exact)
  if (name && name.trim()) {
    const [rows] = await conn.query("SELECT id FROM patients WHERE full_name = ? LIMIT 1", [name.trim()]);
    if (rows.length > 0) return rows[0].id;
  }
  // Create new patient
  const [result] = await conn.query(
    "INSERT INTO patients (full_name, phone, external_patient_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
    [name?.trim() || "Unknown", phone?.trim() || null, patId ? String(patId) : null]
  );
  return result.insertId;
}

async function upsertMachineAppointment(conn, data) {
  const [existing] = await conn.query(
    "SELECT id FROM machine_appointments WHERE external_id = ? LIMIT 1",
    [data.externalId]
  );
  if (existing.length > 0) {
    await conn.query(
      `UPDATE machine_appointments SET 
        patient_name=?, patient_phone=?, machine_id=?, provider_name=?,
        appointment_date=?, start_time=?, end_time=?, service_name=?,
        status=?, arrival_status=?, source_notes=?, source_system=?,
        last_synced_at=NOW(), updated_at=NOW()
      WHERE external_id=?`,
      [
        data.patientName, data.patientPhone, data.machineId, data.providerName,
        data.appointmentDate, data.startTime, data.endTime, data.serviceName,
        data.status, data.arrivalStatus, data.sourceNotes, "HMS",
        data.externalId,
      ]
    );
    return "updated";
  } else {
    await conn.query(
      `INSERT INTO machine_appointments 
        (external_id, patient_name, patient_phone, machine_id, provider_name,
         appointment_date, start_time, end_time, service_name,
         status, arrival_status, source_notes, source_system,
         last_synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HMS', NOW(), NOW(), NOW())`,
      [
        data.externalId, data.patientName, data.patientPhone, data.machineId,
        data.providerName, data.appointmentDate, data.startTime, data.endTime,
        data.serviceName, data.status, data.arrivalStatus, data.sourceNotes,
      ]
    );
    return "created";
  }
}

async function upsertConfirmedAppointment(conn, data) {
  const [existing] = await conn.query(
    "SELECT id FROM confirmed_appointments WHERE external_id = ? LIMIT 1",
    [data.externalId]
  );
  if (existing.length > 0) {
    await conn.query(
      `UPDATE confirmed_appointments SET
        patient_name=?, patient_phone=?, appointment_date=?, appointment_time=?,
        service=?, body_area=?, specialist=?, branch=?, status=?, arrival_status=?,
        source_notes=?, source_system=?, last_synced_at=NOW(), updatedAt=NOW()
      WHERE external_id=?`,
      [
        data.patientName, data.patientPhone, data.appointmentDate, data.appointmentTime,
        data.service, data.service, data.specialist, data.branch, data.status, data.arrivalStatus,
        data.sourceNotes, "HMS", data.externalId,
      ]
    );
    return "updated";
  } else {
    await conn.query(
      `INSERT INTO confirmed_appointments
        (external_id, patient_id, patient_name, patient_phone, appointment_date, appointment_time,
         service, body_area, specialist, branch, status, arrival_status,
         source_notes, source_system, last_synced_at, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HMS', NOW(), NOW(), NOW())`,
      [
        data.externalId, data.patientId, data.patientName, data.patientPhone,
        data.appointmentDate, data.appointmentTime, data.service, data.service,
        data.specialist, data.branch, data.status, data.arrivalStatus, data.sourceNotes,
      ]
    );
    return "created";
  }
}

// ─── Machine resolver ────────────────────────────────────────────────────────

let machineCache = null;

async function loadMachines(conn) {
  const [rows] = await conn.query("SELECT id, name, machine_code FROM machines");
  machineCache = rows;
  return rows;
}

function resolveMachineId(docCode) {
  if (!machineCache || !docCode) return null;
  const match = machineCache.find(
    (m) => m.machine_code && m.machine_code.toLowerCase() === docCode.toLowerCase()
  );
  return match ? match.id : null;
}

// ─── Main Backfill ───────────────────────────────────────────────────────────

async function main() {
  console.log(`[Backfill] Starting HMS backfill: ${START_DATE} → ${END_DATE}`);

  // Login to HMS
  const { origin, cookie } = await hmsLogin();

  // Connect to DB
  const conn = await mysql.createConnection(DATABASE_URL);
  await loadMachines(conn);
  console.log(`[Backfill] Loaded ${machineCache.length} machines`);

  const dates = dateRange(START_DATE, END_DATE);
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let totalRecords = 0;
  let patientsCreated = 0;
  const seenPatientIds = new Set();

  // Process day by day to avoid response size issues
  let sessionCookie = cookie;
  let sessionOrigin = origin;

  for (let i = 0; i < dates.length; i++) {
    const dayFrom = dates[i];
    const dayTo = addDays(dayFrom, 1);

    // Re-login every 20 days to prevent session expiry
    if (i > 0 && i % 20 === 0) {
      console.log(`[Backfill] Re-authenticating...`);
      try {
        const fresh = await hmsLogin();
        sessionCookie = fresh.cookie;
        sessionOrigin = fresh.origin;
      } catch (e) {
        console.error(`[Backfill] Re-login failed: ${e.message}, continuing with old session`);
      }
    }

    try {
      const records = await fetchDay(sessionOrigin, sessionCookie, dayFrom, dayTo);
      totalRecords += records.length;

      if (records.length === 0) {
        // Skip empty days silently
      if (i % 7 === 0) console.log(`[Backfill] ${dayFrom}: 0 records`);
        continue;
      }

      let batchCreated = 0;
      let batchUpdated = 0;

      for (const r of records) {
        try {
          const externalId = String(r.ID || "");
          if (!externalId) continue;

          const apptDate = parseHmsDate(r.APPT_DATE);
          const dateStr = apptDate ? apptDate.toISOString().split("T")[0] : batchFrom;
          const startTime = String(r.APPT_TIME || "").trim();
          const endTime = String(r.APPT_TO_TIME || "").trim();
          const patientName = String(r.PAT_NAME || "").trim();
          const patientPhone = String(r.PAT_TEL || r.PAT_TEL2 || "").trim();
          const docCode = String(r.DOC_CODE || "").trim();
          const docName = String(r.DOC_NAME || r.DOC_RC_NAME || "").trim();
          const service = String(r.SER_NAME || r.SER_CODE || "").trim();
          const notes = String(r.APPT_RMK || "").trim();
          const status = deriveStatus(r);
          const arrivalStatus = deriveArrivalStatus(r);
          const patId = r.PAT_ID ? String(r.PAT_ID) : null;
          const mrn = r.PAT_MRN ? String(r.PAT_MRN) : null;

          // Get or create patient
          const localPatientId = await getOrCreatePatient(conn, patientName, patientPhone, patId, mrn);
          if (!seenPatientIds.has(localPatientId)) {
            seenPatientIds.add(localPatientId);
            if (seenPatientIds.size > patientsCreated) patientsCreated = seenPatientIds.size;
          }

          // Resolve machine
          const machineId = resolveMachineId(docCode);

          // Upsert machine_appointments
          const maResult = await upsertMachineAppointment(conn, {
            externalId,
            patientName,
            patientPhone,
            machineId,
            providerName: docName,
            appointmentDate: dateStr,
            startTime,
            endTime,
            serviceName: service,
            status,
            arrivalStatus,
            sourceNotes: notes,
          });

          // Upsert confirmed_appointments
          await upsertConfirmedAppointment(conn, {
            externalId,
            patientId: localPatientId,
            patientName,
            patientPhone,
            appointmentDate: dateStr,
            appointmentTime: startTime,
            service,
            specialist: docName,
            branch: null,
            status,
            arrivalStatus,
            sourceNotes: notes,
          });

          if (maResult === "created") batchCreated++;
          else batchUpdated++;
        } catch (err) {
          totalErrors++;
        }
      }

      totalCreated += batchCreated;
      totalUpdated += batchUpdated;
      console.log(`[Backfill] ${dayFrom}: ${records.length} records (${batchCreated} new, ${batchUpdated} updated)`);
    } catch (err) {
      console.error(`[Backfill] ${dayFrom}: FAILED — ${err.message}`);
      totalErrors++;
      // Try re-login on failure
      try {
        const fresh = await hmsLogin();
        sessionCookie = fresh.cookie;
        sessionOrigin = fresh.origin;
      } catch {}
    }

    // Small delay to avoid overwhelming HMS
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n[Backfill] ═══════════════════════════════════════════`);
  console.log(`[Backfill] COMPLETE`);
  console.log(`[Backfill] Date range: ${START_DATE} → ${END_DATE}`);
  console.log(`[Backfill] Total records fetched: ${totalRecords}`);
  console.log(`[Backfill] Created: ${totalCreated}`);
  console.log(`[Backfill] Updated: ${totalUpdated}`);
  console.log(`[Backfill] Errors: ${totalErrors}`);
  console.log(`[Backfill] Unique patients: ${seenPatientIds.size}`);
  console.log(`[Backfill] ═══════════════════════════════════════════`);

  // Final counts
  const [maCount] = await conn.query("SELECT COUNT(*) as cnt FROM machine_appointments");
  const [caCount] = await conn.query("SELECT COUNT(*) as cnt FROM confirmed_appointments");
  const [pCount] = await conn.query("SELECT COUNT(*) as cnt FROM patients");
  console.log(`\n[Backfill] Final DB counts:`);
  console.log(`  machine_appointments: ${maCount[0].cnt}`);
  console.log(`  confirmed_appointments: ${caCount[0].cnt}`);
  console.log(`  patients: ${pCount[0].cnt}`);

  await conn.end();
}

main().catch((err) => {
  console.error(`[Backfill] FATAL: ${err.message}`);
  process.exit(1);
});
