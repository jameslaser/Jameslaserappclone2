import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

// Parse the DATABASE_URL
const parsed = new URL(url);
const isTiDB = parsed.port === "4000" || parsed.hostname.includes("tidbcloud") || parsed.searchParams.get("ssl") === "true";

const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: parseInt(parsed.port || "3306"),
  user: parsed.username,
  password: parsed.password,
  database: parsed.pathname.replace("/", ""),
  ssl: isTiDB ? { rejectUnauthorized: false } : undefined,
});

const now = new Date();
const ts = (offset = 0) => new Date(now.getTime() + offset * 60000);

try {
  // Check if data already exists
  const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM patients");
  if (rows[0].cnt > 0) {
    console.log(`Patients table already has ${rows[0].cnt} rows — skipping seed.`);
    await conn.end();
    process.exit(0);
  }

  // Seed users (patients)
  const [u1] = await conn.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["hms-patient-1", "Sarah Al-Rashidi", "sarah.alrashidi@example.com", "hospital_sync", "user", now, now, now]
  );
  const [u2] = await conn.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["hms-patient-2", "Fatima Al-Zahra", "fatima.alzahra@example.com", "hospital_sync", "user", now, now, now]
  );
  const [u3] = await conn.execute(
    `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["hms-patient-3", "Nour Al-Hassan", "nour.alhassan@example.com", "hospital_sync", "user", now, now, now]
  );

  const uid1 = u1.insertId, uid2 = u2.insertId, uid3 = u3.insertId;

  // Seed patients
  const [p1] = await conn.execute(
    `INSERT INTO patients (user_id, external_patient_id, full_name, phone, email, fitzpatrick, hair_type, hair_density, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid1, "HMS-1001", "Sarah Al-Rashidi", "966501234567", "sarah.alrashidi@example.com", "IV", "Coarse", "High", "Referred from King Fahad Hospital", now, now]
  );
  const [p2] = await conn.execute(
    `INSERT INTO patients (user_id, external_patient_id, full_name, phone, email, fitzpatrick, hair_type, hair_density, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid2, "HMS-1002", "Fatima Al-Zahra", "966509876543", "fatima.alzahra@example.com", "V", "Fine", "Medium", "Sensitive skin — use lower energy", now, now]
  );
  const [p3] = await conn.execute(
    `INSERT INTO patients (user_id, external_patient_id, full_name, phone, email, fitzpatrick, hair_type, hair_density, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid3, "HMS-1003", "Nour Al-Hassan", "966555123456", "nour.alhassan@example.com", "III", "Medium", "Low", "Follow-up after 4 weeks", now, now]
  );

  const pid1 = p1.insertId, pid2 = p2.insertId, pid3 = p3.insertId;

  // Seed appointment requests
  const [ar1] = await conn.execute(
    `INSERT INTO appointment_requests (patient_id, preferred_date, confirmed_date, body_area, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, ts(60 * 24 * 7), ts(60 * 24 * 8), "Full Legs", "Confirmed", "Patient prefers morning slots", now, now]
  );
  const [ar2] = await conn.execute(
    `INSERT INTO appointment_requests (patient_id, preferred_date, confirmed_date, body_area, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, ts(60 * 24 * 10), ts(60 * 24 * 11), "Underarms", "Confirmed", null, now, now]
  );
  const [ar3] = await conn.execute(
    `INSERT INTO appointment_requests (patient_id, preferred_date, confirmed_date, body_area, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid3, ts(60 * 24 * 14), null, "Bikini Line", "Pending", "Awaiting confirmation", now, now]
  );
  const [ar4] = await conn.execute(
    `INSERT INTO appointment_requests (patient_id, preferred_date, confirmed_date, body_area, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, ts(60 * 24 * 21), ts(60 * 24 * 22), "Full Beard", "Confirmed", "Second session", now, now]
  );
  const [ar5] = await conn.execute(
    `INSERT INTO appointment_requests (patient_id, preferred_date, confirmed_date, body_area, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, ts(60 * 24 * 28), null, "Chest", "Cancelled", "Patient cancelled", now, now]
  );

  // Seed confirmed appointments
  const [ca1] = await conn.execute(
    `INSERT INTO confirmed_appointments (patient_id, appointment_date, body_area, status, arrival_status, specialist, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, ts(60 * 24 * 8), "Full Legs", "Completed", "Arrived", "Dr. Layla Mansour", "Session completed successfully", now, now]
  );
  const [ca2] = await conn.execute(
    `INSERT INTO confirmed_appointments (patient_id, appointment_date, body_area, status, arrival_status, specialist, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, ts(60 * 24 * 11), "Underarms", "Completed", "Arrived", "Dr. Layla Mansour", null, now, now]
  );
  const [ca3] = await conn.execute(
    `INSERT INTO confirmed_appointments (patient_id, appointment_date, body_area, status, arrival_status, specialist, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, ts(60 * 24 * 22), "Full Beard", "Confirmed", "Expected", "Dr. Ahmed Al-Farsi", "Second session — increase energy by 10%", now, now]
  );
  const [ca4] = await conn.execute(
    `INSERT INTO confirmed_appointments (patient_id, appointment_date, body_area, status, arrival_status, specialist, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid3, ts(60 * 24 * 30), "Bikini Line", "Confirmed", "Expected", "Dr. Layla Mansour", null, now, now]
  );
  const [ca5] = await conn.execute(
    `INSERT INTO confirmed_appointments (patient_id, appointment_date, body_area, status, arrival_status, specialist, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, ts(-60 * 24 * 3), "Underarms", "Completed", "Late", "Dr. Ahmed Al-Farsi", "Patient arrived 20 min late", now, now]
  );

  const caid1 = ca1.insertId, caid2 = ca2.insertId, caid5 = ca5.insertId;

  // Seed sessions
  const [s1] = await conn.execute(
    `INSERT INTO sessions (patient_id, appointment_id, session_date, machine_used, specialist, body_area, energy_level, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, caid1, ts(60 * 24 * 8), "Clarity II", "Dr. Layla Mansour", "Full Legs", "18.50", "Good response, no adverse effects", now, now]
  );
  const [s2] = await conn.execute(
    `INSERT INTO sessions (patient_id, appointment_id, session_date, machine_used, specialist, body_area, energy_level, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, caid2, ts(60 * 24 * 11), "Clarity II", "Dr. Layla Mansour", "Underarms", "14.00", "Reduced energy due to skin sensitivity", now, now]
  );
  const [s3] = await conn.execute(
    `INSERT INTO sessions (patient_id, appointment_id, session_date, machine_used, specialist, body_area, energy_level, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, caid5, ts(-60 * 24 * 3), "Soprano Ice", "Dr. Ahmed Al-Farsi", "Underarms", "16.25", "Follow-up session — improved results", now, now]
  );

  const sid1 = s1.insertId, sid2 = s2.insertId, sid3 = s3.insertId;

  // Seed follow-ups
  await conn.execute(
    `INSERT INTO follow_ups (patient_id, session_id, due_date, type, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid1, sid1, ts(60 * 24 * 36), "Retouch Reminder", "Pending", "Schedule next session in 4 weeks", now, now]
  );
  await conn.execute(
    `INSERT INTO follow_ups (patient_id, session_id, due_date, type, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, sid2, ts(60 * 24 * 39), "Post-Treatment Check", "Sent", "SMS sent to patient", now, now]
  );
  await conn.execute(
    `INSERT INTO follow_ups (patient_id, session_id, due_date, type, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid2, sid3, ts(60 * 24 * 25), "Retouch Reminder", "Completed", "Patient confirmed next appointment", now, now]
  );

  console.log("✅ Seed complete:");
  console.log(`  Users: 3 (patient accounts)`);
  console.log(`  Patients: 3`);
  console.log(`  Appointment Requests: 5`);
  console.log(`  Confirmed Appointments: 5`);
  console.log(`  Sessions: 3`);
  console.log(`  Follow-Ups: 3`);
} catch (err) {
  console.error("Seed error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
