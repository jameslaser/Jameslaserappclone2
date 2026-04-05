/**
 * HMS Backfill Script — Feb 1 to Apr 5, 2026
 * Runs day-by-day, upserts into machine_appointments
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const HMS_BASE_URL = process.env.HMS_BASE_URL;
const HMS_USERNAME = process.env.HMS_USERNAME;
const HMS_PASSWORD = process.env.HMS_PASSWORD || process.env.HMS_USERNAMEHMS_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!HMS_BASE_URL || !HMS_USERNAME || !HMS_PASSWORD || !DATABASE_URL) {
  console.error('Missing env vars. Required: HMS_BASE_URL, HMS_USERNAME, HMS_PASSWORD, DATABASE_URL');
  process.exit(1);
}

// ─── HMS Auth ────────────────────────────────────────────────────────────────
async function hmsLogin() {
  const url = `${HMS_BASE_URL}/DBAL/DBAL.asmx/Login`;
  const body = new URLSearchParams({ UserName: HMS_USERNAME, Password: HMS_PASSWORD });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HMS login failed: ${res.status}`);
  const text = await res.text();
  // Extract session cookie
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionMatch = setCookie.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sessionMatch) throw new Error('No session cookie from HMS login');
  return sessionMatch[1];
}

async function fetchHmsDay(sessionId, dateStr) {
  // dateStr format: MM/DD/YYYY
  const url = `${HMS_BASE_URL}/DBAL/DBAL.asmx/r592`;
  const body = new URLSearchParams({
    p1: dateStr,
    p2: dateStr,
    p3: '',
    p4: '',
    p5: '',
    p6: '',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `ASP.NET_SessionId=${sessionId}`,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HMS fetch failed for ${dateStr}: ${res.status}`);
  const text = await res.text();
  // Parse XML response
  const matches = text.match(/<string[^>]*>(.*?)<\/string>/s);
  if (!matches) return [];
  try {
    const json = JSON.parse(matches[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

// ─── Machine Mapping ─────────────────────────────────────────────────────────
const MACHINE_MAPPING = {
  'DR001': 'DEKA AGAIN', 'DR002': 'DEKA AGAIN', 'DR003': 'DEKA AGAIN',
  'DR004': 'CLARITY 2', 'DR005': 'CLARITY 2', 'DR006': 'CLARITY 2',
  'DR007': 'GENTLE PROMAX', 'DR008': 'GENTLE PROMAX', 'DR009': 'GENTLE PROMAX',
  'DR010': 'DUETTO MACHINE', 'DR011': 'DUETTO MACHINE', 'DR012': 'DUETTO MACHINE',
  'DR013': 'DEKA AGAIN', 'DR014': 'DEKA AGAIN', 'DR015': 'CLARITY 2',
  'DR016': 'CLARITY 2', 'DR017': 'GENTLE PROMAX', 'DR018': 'GENTLE PROMAX',
  'DR019': 'DUETTO MACHINE', 'DR020': 'DUETTO MACHINE',
  'DR021': 'DEKA AGAIN', 'DR022': 'CLARITY 2', 'DR023': 'GENTLE PROMAX', 'DR024': 'DUETTO MACHINE',
  'DR025': 'DEKA AGAIN', 'DR026': 'CLARITY 2', 'DR027': 'GENTLE PROMAX', 'DR028': 'DUETTO MACHINE',
  'DR029': 'DEKA AGAIN', 'DR030': 'CLARITY 2', 'DR031': 'GENTLE PROMAX', 'DR032': 'DUETTO MACHINE',
  'DV01': 'DEKA AGAIN', 'DV02': 'CLARITY 2', 'DV03': 'GENTLE PROMAX', 'DV04': 'DUETTO MACHINE',
  'DV05': 'DEKA AGAIN', 'DV06': 'CLARITY 2', 'DV07': 'GENTLE PROMAX', 'DV08': 'DUETTO MACHINE',
};

function resolveApprovedMachine(machineCode) {
  if (!machineCode) return null;
  const upper = machineCode.toUpperCase().trim();
  if (MACHINE_MAPPING[upper]) return MACHINE_MAPPING[upper];
  // Pattern matching
  if (upper.startsWith('DR0') || upper.startsWith('DR1') || upper.startsWith('DR2') || upper.startsWith('DR3')) {
    const num = parseInt(upper.replace('DR', ''), 10);
    if (!isNaN(num)) {
      const machines = ['DEKA AGAIN', 'CLARITY 2', 'GENTLE PROMAX', 'DUETTO MACHINE'];
      return machines[(num - 1) % 4];
    }
  }
  if (upper.startsWith('DV')) {
    const num = parseInt(upper.replace('DV', ''), 10);
    if (!isNaN(num)) {
      const machines = ['DEKA AGAIN', 'CLARITY 2', 'GENTLE PROMAX', 'DUETTO MACHINE'];
      return machines[(num - 1) % 4];
    }
  }
  // Nurse rooms, facial rooms, etc. → UNMAPPED
  if (upper.startsWith('NR') || upper.startsWith('FA') || upper.startsWith('WR') || upper.startsWith('CR')) {
    return 'UNMAPPED SOURCE MACHINE';
  }
  return 'UNMAPPED SOURCE MACHINE';
}

// ─── Status Mapping ───────────────────────────────────────────────────────────
function mapStatus(raw) {
  if (!raw) return 'scheduled';
  const s = raw.toString().toUpperCase().trim();
  if (s === '1' || s === 'STS_FIN' || s === 'FINISHED' || s === 'COMPLETED') return 'completed';
  if (s === '2' || s === 'STS_CANCEL' || s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
  if (s === '3' || s === 'STS_NOSHOW' || s === 'NO_SHOW' || s === 'NOSHOW') return 'no_show';
  if (s === '4' || s === 'STS_ARRIVED' || s === 'ARRIVED') return 'arrived';
  if (s === '5' || s === 'STS_WALKIN' || s === 'WALK_IN' || s === 'WALKIN') return 'walk_in';
  if (s === '6' || s === 'STS_CONFIRM' || s === 'CONFIRMED') return 'confirmed';
  if (s === '0' || s === 'STS_SCHED' || s === 'SCHEDULED') return 'scheduled';
  return 'scheduled';
}

// ─── Working Hours Check ──────────────────────────────────────────────────────
function isWithinWorkingHours(timeStr) {
  if (!timeStr) return false;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const totalMins = h * 60 + m;
  return totalMins >= 12 * 60 && totalMins <= 22 * 60;
}

// ─── DB Upsert ────────────────────────────────────────────────────────────────
async function upsertAppointment(db, record, machineIdMap) {
  const externalId = record.SCH_ID || record.APT_ID || record.ID;
  if (!externalId) return { action: 'skip', reason: 'no_id' };

  const machineCode = record.DOC_CODE || record.ROOM_CODE || record.MACHINE_CODE || '';
  const approvedMachine = resolveApprovedMachine(machineCode);
  const machineId = machineIdMap[approvedMachine] || null;

  const timeStr = record.SCH_TIME || record.APT_TIME || record.TIME || '';
  const withinHours = isWithinWorkingHours(timeStr);
  const status = withinHours ? mapStatus(record.STS_FIN || record.STATUS || '0') : 'outside_working_hours';

  const appointmentDate = record.SCH_DATE || record.APT_DATE || record.DATE || null;
  const patientName = record.PAT_NAME || record.PATIENT_NAME || '';
  const mrn = record.PAT_MRN || record.MRN || record.PATIENT_ID || '';
  const mobile = record.PAT_MOBILE || record.MOBILE || record.PHONE || '';
  const gender = record.PAT_SEX || record.GENDER || '';
  const provider = record.DOC_NAME || record.PROVIDER || record.DOCTOR || '';
  const department = record.DEPT_NAME || record.DEPT || record.DEPARTMENT || '';
  const serviceType = record.SER_NAME || record.SERVICE || record.APPT_TYPE || '';
  const notes = record.NOTES || record.NOTE || record.REMARKS || '';
  const isWalkIn = record.WALKIN === '1' || record.IS_WALKIN === true || record.WALK_IN === '1' ? 1 : 0;
  const isArrived = record.ARRIVED === '1' || record.IS_ARRIVED === true ? 1 : 0;

  const rawData = JSON.stringify(record);

  const sql = `
    INSERT INTO machine_appointments (
      external_id, patient_name, mrn, mobile, gender,
      appointment_date, start_time, status, machine_id, machine_code,
      machine_name, provider, department, service_type,
      is_walk_in, is_arrived, source_notes, raw_data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      patient_name = VALUES(patient_name),
      mrn = VALUES(mrn),
      mobile = VALUES(mobile),
      gender = VALUES(gender),
      appointment_date = VALUES(appointment_date),
      start_time = VALUES(start_time),
      status = VALUES(status),
      machine_id = VALUES(machine_id),
      machine_code = VALUES(machine_code),
      machine_name = VALUES(machine_name),
      provider = VALUES(provider),
      department = VALUES(department),
      service_type = VALUES(service_type),
      is_walk_in = VALUES(is_walk_in),
      is_arrived = VALUES(is_arrived),
      source_notes = VALUES(source_notes),
      raw_data = VALUES(raw_data),
      updated_at = NOW()
  `;

  try {
    const [result] = await db.execute(sql, [
      String(externalId), patientName, mrn, mobile, gender,
      appointmentDate, timeStr, status, machineId, machineCode,
      approvedMachine, provider, department, serviceType,
      isWalkIn, isArrived, notes, rawData,
    ]);
    const r = result;
    if (r.affectedRows === 1 && r.insertId > 0) return { action: 'insert' };
    if (r.affectedRows === 2) return { action: 'update' };
    return { action: 'no_change' };
  } catch (err) {
    return { action: 'error', reason: err.message };
  }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function formatHmsDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 HMS Backfill starting: Feb 1 → Apr 5, 2026');

  // Connect to DB
  const db = await mysql.createConnection(DATABASE_URL);
  console.log('✅ DB connected');

  // Load machine ID map
  const [machines] = await db.execute('SELECT id, name FROM machines');
  const machineIdMap = {};
  for (const m of machines) machineIdMap[m.name] = m.id;
  console.log('🔧 Machines loaded:', Object.keys(machineIdMap).join(', '));

  // HMS Login
  let sessionId;
  try {
    sessionId = await hmsLogin();
    console.log('✅ HMS logged in, session:', sessionId.substring(0, 8) + '...');
  } catch (err) {
    console.error('❌ HMS login failed:', err.message);
    await db.end();
    process.exit(1);
  }

  const startDate = new Date('2026-02-01');
  const endDate = new Date('2026-04-05');

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let sessionRefreshCount = 0;

  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatHmsDate(current);
    process.stdout.write(`📅 ${dateStr} ... `);

    // Re-login every 20 days to keep session fresh
    if (sessionRefreshCount > 0 && sessionRefreshCount % 20 === 0) {
      try {
        sessionId = await hmsLogin();
        process.stdout.write('[re-auth] ');
      } catch (err) {
        process.stdout.write(`[re-auth FAILED: ${err.message}] `);
      }
    }

    let records = [];
    try {
      records = await fetchHmsDay(sessionId, dateStr);
    } catch (err) {
      // Try re-login once on failure
      try {
        sessionId = await hmsLogin();
        records = await fetchHmsDay(sessionId, dateStr);
      } catch (err2) {
        console.log(`❌ Failed: ${err2.message}`);
        current = addDays(current, 1);
        sessionRefreshCount++;
        continue;
      }
    }

    let dayInsert = 0, dayUpdate = 0, daySkip = 0, dayError = 0;
    for (const record of records) {
      const result = await upsertAppointment(db, record, machineIdMap);
      if (result.action === 'insert') { dayInsert++; totalInserted++; }
      else if (result.action === 'update') { dayUpdate++; totalUpdated++; }
      else if (result.action === 'no_change') { daySkip++; totalSkipped++; }
      else if (result.action === 'error') { dayError++; totalErrors++; }
      else { daySkip++; totalSkipped++; }
    }

    console.log(`${records.length} records → +${dayInsert} new, ~${dayUpdate} updated, ${daySkip} unchanged, ${dayError} errors`);

    current = addDays(current, 1);
    sessionRefreshCount++;

    // Small delay to avoid overwhelming HMS
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n📊 BACKFILL COMPLETE');
  console.log(`   Total inserted: ${totalInserted}`);
  console.log(`   Total updated:  ${totalUpdated}`);
  console.log(`   Total unchanged: ${totalSkipped}`);
  console.log(`   Total errors:   ${totalErrors}`);

  // Final count
  const [[countRow]] = await db.execute('SELECT COUNT(*) as total FROM machine_appointments');
  console.log(`   Total in DB now: ${countRow.total}`);

  await db.end();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
