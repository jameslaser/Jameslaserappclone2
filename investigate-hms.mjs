/**
 * HMS Endpoint Investigation Script
 * Tests: live sync endpoint, historical date range, and all other DBAL functions
 */
import 'dotenv/config';

const HMS_BASE_URL = process.env.HMS_BASE_URL;
const HMS_USERNAME = process.env.HMS_USERNAME;
const HMS_PASSWORD = process.env.HMS_PASSWORD || process.env.HMS_USERNAMEHMS_PASSWORD;

if (!HMS_BASE_URL || !HMS_USERNAME || !HMS_PASSWORD) {
  console.error('Missing HMS env vars');
  process.exit(1);
}

// Get origin from base URL
let hmsOrigin;
try {
  hmsOrigin = new URL(HMS_BASE_URL).origin;
} catch {
  hmsOrigin = HMS_BASE_URL.replace(/\/[^/]+$/, '');
}

console.log('HMS Origin:', hmsOrigin);
console.log('HMS Username:', HMS_USERNAME);
console.log('');

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function authenticate() {
  // Step 1: Get session cookie
  const homeRes = await fetch(hmsOrigin, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
  const setCookie = homeRes.headers.get('set-cookie') ?? '';
  const sessionMatch = setCookie.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sessionMatch) throw new Error('No session cookie');
  const sessionId = sessionMatch[1];
  const cookieHeader = `ASP.NET_SessionId=${sessionId}`;

  // Step 2: Get permission groups
  const groupsRes = await fetch(`${hmsOrigin}/DBAL/AUTHENTICATE_DBAL.aspx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieHeader },
    body: new URLSearchParams({ fName: 'GetPermGroups', uname: HMS_USERNAME }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const groupsText = (await groupsRes.text()).trim();
  const groupMatch = groupsText.match(/\^-\^(\d+)\^-\^/);
  if (!groupMatch) throw new Error(`No group found. Response: ${groupsText.substring(0, 100)}`);
  const groupId = groupMatch[1];

  // Step 3: Login
  const loginRes = await fetch(`${hmsOrigin}/DBAL/AUTHENTICATE_DBAL.aspx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookieHeader },
    body: new URLSearchParams({ fName: 'CheckOTP', uname: HMS_USERNAME, pword: HMS_PASSWORD, gid: groupId, OTP: '' }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const loginSetCookie = loginRes.headers.get('set-cookie') ?? '';
  const newSessionMatch = loginSetCookie.match(/ASP\.NET_SessionId=([^;]+)/);
  const activeCookie = newSessionMatch ? `ASP.NET_SessionId=${newSessionMatch[1]}` : cookieHeader;
  const loginText = (await loginRes.text()).trim();
  if (loginText === 'INVALID' || loginText.startsWith('ERR')) throw new Error(`Login failed: ${loginText}`);
  
  console.log(`✅ Authenticated as ${HMS_USERNAME} (group ${groupId})`);
  return { cookie: activeCookie, groupId };
}

// ─── Test a DBAL function ─────────────────────────────────────────────────────
async function testDbalFunction(cookie, fName, params = {}) {
  try {
    const body = new URLSearchParams({ fName, ...params });
    const res = await fetch(`${hmsOrigin}/DBAL/DBAL.ASPX`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const trimmed = text.trim();
    
    // Count records
    let recordCount = 0;
    let preview = '';
    if (trimmed.startsWith('[') || trimmed.includes(']^[')) {
      const parts = trimmed.split(']^[');
      for (const part of parts) {
        let p = part.trim();
        if (!p) continue;
        if (!p.startsWith('[')) p = '[' + p;
        if (!p.endsWith(']')) p = p + ']';
        try {
          const arr = JSON.parse(p);
          if (Array.isArray(arr)) recordCount += arr.length;
        } catch {}
      }
      if (recordCount > 0) {
        // Get first record keys
        try {
          const firstPart = trimmed.startsWith('[') ? trimmed.split(']^[')[0] : '[' + trimmed.split(']^[')[0];
          const arr = JSON.parse(firstPart.endsWith(']') ? firstPart : firstPart + ']');
          if (arr.length > 0) preview = Object.keys(arr[0]).join(', ');
        } catch {}
      }
    }
    
    return {
      status: res.status,
      records: recordCount,
      length: trimmed.length,
      preview: preview || trimmed.substring(0, 150),
      error: null,
    };
  } catch (err) {
    return { status: 0, records: 0, length: 0, preview: '', error: err.message };
  }
}

// ─── Main Investigation ───────────────────────────────────────────────────────
async function main() {
  let auth;
  try {
    auth = await authenticate();
  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    process.exit(1);
  }
  const { cookie } = auth;

  const today = new Date();
  const fmt = (d) => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
  const todayStr = fmt(today);
  const tomorrowStr = fmt(new Date(today.getTime() + 86400000));
  const feb1 = '02/01/2026';
  const feb2 = '02/02/2026';
  const mar1 = '03/01/2026';
  const apr1 = '04/01/2026';
  const apr5 = '04/05/2026';

  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 1: LIVE SYNC ENDPOINT (LoadAllAppointment)');
  console.log('══════════════════════════════════════════════════════');

  // Test 1: Today (confirm live sync works)
  console.log(`\n[1a] LoadAllAppointment from=${todayStr} to=${tomorrowStr} (TODAY)`);
  const t1a = await testDbalFunction(cookie, 'LoadAllAppointment', { key: '', from: todayStr, to: tomorrowStr, by: 'date', status: 'all', opt: '0' });
  console.log(`     → ${t1a.records} records | HTTP ${t1a.status} | ${t1a.length} bytes`);
  if (t1a.records > 0) console.log(`     Fields: ${t1a.preview}`);
  if (t1a.error) console.log(`     Error: ${t1a.error}`);

  // Test 2: Feb 1 (historical)
  console.log(`\n[1b] LoadAllAppointment from=${feb1} to=${feb2} (HISTORICAL - Feb 1)`);
  const t1b = await testDbalFunction(cookie, 'LoadAllAppointment', { key: '', from: feb1, to: feb2, by: 'date', status: 'all', opt: '0' });
  console.log(`     → ${t1b.records} records | HTTP ${t1b.status} | ${t1b.length} bytes`);
  if (t1b.records > 0) console.log(`     Fields: ${t1b.preview}`);
  if (t1b.error) console.log(`     Error: ${t1b.error}`);

  // Test 3: Apr 1 (recent past)
  console.log(`\n[1c] LoadAllAppointment from=${apr1} to=${apr5} (RECENT - Apr 1-5)`);
  const t1c = await testDbalFunction(cookie, 'LoadAllAppointment', { key: '', from: apr1, to: apr5, by: 'date', status: 'all', opt: '0' });
  console.log(`     → ${t1c.records} records | HTTP ${t1c.status} | ${t1c.length} bytes`);
  if (t1c.records > 0) console.log(`     Fields: ${t1c.preview}`);
  if (t1c.error) console.log(`     Error: ${t1c.error}`);

  // Test 4: Mar 1
  console.log(`\n[1d] LoadAllAppointment from=${mar1} to=${mar1} (HISTORICAL - Mar 1)`);
  const t1d = await testDbalFunction(cookie, 'LoadAllAppointment', { key: '', from: mar1, to: mar1, by: 'date', status: 'all', opt: '0' });
  console.log(`     → ${t1d.records} records | HTTP ${t1d.status} | ${t1d.length} bytes`);
  if (t1d.records > 0) console.log(`     Fields: ${t1d.preview}`);
  if (t1d.error) console.log(`     Error: ${t1d.error}`);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 2: OTHER DBAL FUNCTIONS (History Candidates)');
  console.log('══════════════════════════════════════════════════════');

  const historyFunctions = [
    // Appointment history variants
    ['LoadAppointmentHistory', { from: feb1, to: apr5, by: 'date', status: 'all' }],
    ['GetAppointmentHistory', { from: feb1, to: apr5 }],
    ['LoadAppointments', { from: feb1, to: apr5, by: 'date', status: 'all', opt: '0' }],
    ['GetAllAppointments', { from: feb1, to: apr5 }],
    ['LoadAllAppointmentHistory', { from: feb1, to: apr5, by: 'date', status: 'all', opt: '0' }],
    // Patient visit history
    ['LoadPatientHistory', { from: feb1, to: apr5 }],
    ['GetPatientVisits', { from: feb1, to: apr5 }],
    ['LoadVisitHistory', { from: feb1, to: apr5 }],
    // Schedule archive
    ['LoadScheduleHistory', { from: feb1, to: apr5 }],
    ['GetScheduleArchive', { from: feb1, to: apr5 }],
    ['LoadAllSchedule', { from: feb1, to: apr5, by: 'date', status: 'all', opt: '0' }],
    // Report/transaction
    ['LoadTransactions', { from: feb1, to: apr5 }],
    ['GetTransactionHistory', { from: feb1, to: apr5 }],
    ['LoadReportData', { from: feb1, to: apr5, reportId: '399' }],
    // Calendar
    ['LoadCalendar', { from: feb1, to: apr5 }],
    ['GetCalendarHistory', { from: feb1, to: apr5 }],
    // Generic history
    ['GetHistory', { from: feb1, to: apr5, type: 'appointment' }],
    ['LoadHistory', { from: feb1, to: apr5 }],
    ['SearchAppointments', { from: feb1, to: apr5, status: 'all' }],
    ['FindAppointments', { from: feb1, to: apr5 }],
    // Completed/finished
    ['LoadCompletedAppointments', { from: feb1, to: apr5 }],
    ['GetFinishedAppointments', { from: feb1, to: apr5 }],
    ['LoadFinishedAppointment', { from: feb1, to: apr5, by: 'date', status: 'all', opt: '0' }],
    // By provider/machine
    ['LoadAppointmentByDoctor', { from: feb1, to: apr5, docId: '' }],
    ['LoadAppointmentByMachine', { from: feb1, to: apr5, machineId: '' }],
    // Export
    ['ExportAppointments', { from: feb1, to: apr5 }],
    ['GetExportData', { from: feb1, to: apr5, type: 'appointment' }],
  ];

  for (const [fName, params] of historyFunctions) {
    const result = await testDbalFunction(cookie, fName, params);
    const status = result.error ? `ERROR: ${result.error.substring(0, 50)}` : 
                   result.records > 0 ? `✅ ${result.records} RECORDS FOUND!` :
                   result.length > 10 ? `⚠️  ${result.length} bytes (no records parsed)` :
                   `❌ empty`;
    console.log(`  ${fName.padEnd(35)} → ${status}`);
    if (result.records > 0) {
      console.log(`    Fields: ${result.preview}`);
      console.log(`    *** HISTORICAL DATA AVAILABLE via ${fName} ***`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 3: DBAL.asmx WebService Methods');
  console.log('══════════════════════════════════════════════════════');

  // Try to get the WSDL/method list
  try {
    const wsdlRes = await fetch(`${hmsOrigin}/DBAL/DBAL.asmx?WSDL`, {
      headers: { 'Cookie': cookie },
      signal: AbortSignal.timeout(15000),
    });
    const wsdlText = await wsdlRes.text();
    const operations = [...wsdlText.matchAll(/name="([^"]+)"/g)].map(m => m[1]).filter(n => n.length > 2 && n.length < 50);
    const unique = [...new Set(operations)];
    console.log(`  WSDL operations found: ${unique.length}`);
    console.log(`  Methods: ${unique.slice(0, 30).join(', ')}`);
    
    // Look for history-related methods
    const historyMethods = unique.filter(n => /hist|archive|range|period|from|past|old|prev|back/i.test(n));
    if (historyMethods.length > 0) {
      console.log(`\n  *** HISTORY-RELATED METHODS: ${historyMethods.join(', ')} ***`);
    }
  } catch (err) {
    console.log(`  WSDL not accessible: ${err.message}`);
  }

  // Try DBAL.aspx method list
  try {
    const listRes = await fetch(`${hmsOrigin}/DBAL/DBAL.ASPX`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookie },
      body: new URLSearchParams({ fName: 'GetFunctionList' }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    const listText = await listRes.text();
    console.log(`\n  GetFunctionList response (${listText.length} bytes): ${listText.substring(0, 300)}`);
  } catch (err) {
    console.log(`  GetFunctionList error: ${err.message}`);
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 4: HMS Web Pages (Export/Report Access)');
  console.log('══════════════════════════════════════════════════════');

  const pages = [
    '/Reports/AppointmentHistory.aspx',
    '/Reports/ScheduleHistory.aspx',
    '/Reports/PatientVisits.aspx',
    '/Appointments/History.aspx',
    '/Schedule/History.aspx',
    '/Export/Appointments.aspx',
    '/Export/Schedule.aspx',
    '/api/appointments',
    '/api/schedule',
    '/api/history',
  ];

  for (const page of pages) {
    try {
      const res = await fetch(`${hmsOrigin}${page}`, {
        headers: { 'Cookie': cookie },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      if (res.status === 200) {
        const text = await res.text();
        console.log(`  ✅ ${page} → HTTP 200 (${text.length} bytes)`);
      } else {
        console.log(`  ❌ ${page} → HTTP ${res.status}`);
      }
    } catch (err) {
      console.log(`  ❌ ${page} → ${err.message.substring(0, 50)}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`Live sync endpoint: POST ${hmsOrigin}/DBAL/DBAL.ASPX`);
  console.log(`  fName: LoadAllAppointment`);
  console.log(`  Auth: Two-step (GetPermGroups + CheckOTP via AUTHENTICATE_DBAL.aspx)`);
  console.log(`  Today support: ${t1a.records > 0 ? '✅ YES (' + t1a.records + ' records)' : '❌ NO'}`);
  console.log(`  Feb 1 history: ${t1b.records > 0 ? '✅ YES (' + t1b.records + ' records)' : '❌ NO'}`);
  console.log(`  Apr 1-5 history: ${t1c.records > 0 ? '✅ YES (' + t1c.records + ' records)' : '❌ NO'}`);
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
