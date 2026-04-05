/**
 * Analyze the full appointment data structure to understand:
 * - PRO: price/amount?
 * - CHO: charge/cost?
 * - STS_FIN: finished status
 * - STS_POST: posted/billed status
 * - SER_NAME: service name
 * - SER_CODE: service code
 */
const origin = 'https://newlook-hms.dataocean-cloud.com';

async function hmsLogin() {
  const homeRes = await fetch(origin, { redirect: 'follow' });
  const sc = homeRes.headers.get('set-cookie') || '';
  const sm = sc.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sm) throw new Error('No session cookie');
  let cookie = 'ASP.NET_SessionId=' + sm[1];
  const gr = await fetch(origin + '/DBAL/AUTHENTICATE_DBAL.aspx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=GetPermGroups&uname=NR011',
  });
  const gt = await gr.text();
  const gm = gt.match(/\^-\^(\d+)\^-\^/);
  if (!gm) throw new Error('No group ID');
  const lr = await fetch(origin + '/DBAL/AUTHENTICATE_DBAL.aspx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=CheckOTP&uname=NR011&pword=0557401562&gid=' + gm[1] + '&OTP=',
  });
  const nc = lr.headers.get('set-cookie');
  if (nc) {
    const ncm = nc.match(/ASP\.NET_SessionId=([^;]+)/);
    if (ncm) cookie = 'ASP.NET_SessionId=' + ncm[1];
  }
  return cookie;
}

function parseMultiResponse(raw) {
  const parts = raw.split(']^[');
  const results = [];
  for (const p of parts) {
    let s = p.trim();
    if (!s) continue;
    if (s.charAt(0) !== '[') s = '[' + s;
    if (s.charAt(s.length - 1) !== ']') s = s + ']';
    try { results.push(...JSON.parse(s)); } catch (e) {}
  }
  return results;
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  // Fetch a range with known completed appointments
  const from = '2025-04-01';
  const to = '2025-04-04';
  
  const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: `fName=LoadAllAppointment&key=&from=${from}&to=${to}&by=date&status=all&opt=0`,
    signal: AbortSignal.timeout(60000),
  });
  const raw = await res.text();
  const records = parseMultiResponse(raw);
  console.log(`Total records for March 2025: ${records.length}`);

  // Analyze the fields
  console.log('\n=== Field Analysis ===');
  const fieldStats = {};
  for (const r of records) {
    for (const [key, val] of Object.entries(r)) {
      if (!fieldStats[key]) fieldStats[key] = { nonNull: 0, values: new Set() };
      if (val !== null && val !== undefined && val !== '' && val !== 0) {
        fieldStats[key].nonNull++;
        if (fieldStats[key].values.size < 10) {
          fieldStats[key].values.add(typeof val === 'object' ? JSON.stringify(val) : String(val));
        }
      }
    }
  }

  // Show fields with non-null values
  for (const [key, stats] of Object.entries(fieldStats)) {
    if (stats.nonNull > 0) {
      console.log(`${key}: ${stats.nonNull}/${records.length} non-null`);
      console.log(`  Sample values: ${[...stats.values].slice(0, 5).join(', ')}`);
    }
  }

  // Specifically analyze PRO and CHO
  console.log('\n=== PRO and CHO Analysis ===');
  const proValues = records.map(r => r.PRO).filter(v => v !== null);
  const choValues = records.map(r => r.CHO).filter(v => v !== null);
  console.log('PRO non-null count:', proValues.length);
  console.log('PRO sample values:', proValues.slice(0, 10));
  console.log('CHO non-null count:', choValues.length);
  console.log('CHO sample values:', choValues.slice(0, 10));

  // Analyze status fields
  console.log('\n=== Status Fields Analysis ===');
  const stsFields = ['STS_NEW', 'STS_CON', 'STS_ATT', 'STS_FIN', 'STS_POST', 'STS_DEL', 'STS_MIS'];
  for (const sts of stsFields) {
    const count = records.filter(r => r[sts] === 1).length;
    console.log(`${sts}=1: ${count} records`);
  }

  // Show records where STS_FIN=1 or STS_POST=1
  const finishedRecords = records.filter(r => r.STS_FIN === 1 || r.STS_POST === 1);
  console.log(`\nFinished/Posted records: ${finishedRecords.length}`);
  if (finishedRecords.length > 0) {
    console.log('First finished record:');
    console.log(JSON.stringify(finishedRecords[0], null, 2));
    if (finishedRecords.length > 1) {
      console.log('Second finished record:');
      console.log(JSON.stringify(finishedRecords[1], null, 2));
    }
  }

  // Show records where both STS_FIN=1 and STS_POST=1
  const bothFinPost = records.filter(r => r.STS_FIN === 1 && r.STS_POST === 1);
  console.log(`\nBoth FIN and POST: ${bothFinPost.length}`);

  // Check if PRO/CHO contain price information
  const withPro = records.filter(r => r.PRO !== null && r.PRO !== 0);
  console.log(`\nRecords with PRO: ${withPro.length}`);
  if (withPro.length > 0) {
    console.log('First record with PRO:');
    console.log(JSON.stringify(withPro[0], null, 2));
  }

  // Check service names
  console.log('\n=== Service Names ===');
  const serviceNames = [...new Set(records.map(r => r.SER_NAME).filter(Boolean))];
  console.log('Unique services:', serviceNames.slice(0, 20));

  // Check doctor codes
  console.log('\n=== Doctor Codes ===');
  const docCodes = [...new Set(records.map(r => r.DOC_CODE).filter(Boolean))];
  console.log('Doctor codes:', docCodes.slice(0, 20));
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
