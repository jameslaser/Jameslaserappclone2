/**
 * Probe the HMS r399 revenue endpoint to understand its data structure.
 * Run: node probe-r399.mjs
 */
const origin = 'https://newlook-hms.dataocean-cloud.com';

async function hmsLogin() {
  const homeRes = await fetch(origin, { redirect: 'follow' });
  const sc = homeRes.headers.get('set-cookie') || '';
  const sm = sc.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sm) throw new Error('No session cookie from home page');
  let cookie = 'ASP.NET_SessionId=' + sm[1];

  const gr = await fetch(origin + '/DBAL/AUTHENTICATE_DBAL.aspx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=GetPermGroups&uname=NR011',
  });
  const gt = await gr.text();
  const gm = gt.match(/\^-\^(\d+)\^-\^/);
  if (!gm) throw new Error('No group ID: ' + gt.substring(0, 200));

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
  const lt = await lr.text();
  console.log('[Login]', lt.trim().substring(0, 40));
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
    try {
      const arr = JSON.parse(s);
      results.push(...arr);
    } catch (e) {
      // skip malformed
    }
  }
  return results;
}

async function probeEndpoint(cookie, fName, body) {
  console.log(`\n--- Probing: ${fName} ---`);
  console.log('Body:', body);
  const t0 = Date.now();
  try {
    const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const raw = await res.text();
    const elapsed = Date.now() - t0;
    console.log(`HTTP ${res.status} in ${elapsed}ms, size: ${raw.length} bytes`);
    if (raw.length < 2000) {
      console.log('Raw:', raw.substring(0, 500));
    }
    const records = parseMultiResponse(raw);
    console.log('Records:', records.length);
    if (records.length > 0) {
      console.log('First record keys:', Object.keys(records[0]));
      console.log('First record:', JSON.stringify(records[0], null, 2));
      if (records.length > 1) {
        console.log('Second record:', JSON.stringify(records[1], null, 2));
      }
    }
    return records;
  } catch (e) {
    console.error('Error:', e.message);
    return [];
  }
}

async function main() {
  console.log('Logging into HMS...');
  const cookie = await hmsLogin();

  const today = new Date();
  const from = '2025-04-01';
  const to = '2025-04-04';

  // Try various r399 / revenue endpoint names
  const probes = [
    // Standard report 399 variations
    `fName=r399&from=${from}&to=${to}`,
    `fName=r399&from=${from}&to=${to}&by=date`,
    `fName=r399&from=${from}&to=${to}&opt=0`,
    `fName=r399&from=${from}&to=${to}&status=all`,
    `fName=r399&from=${from}&to=${to}&key=&opt=0`,
    // Revenue / payment variations
    `fName=LoadRevenue&from=${from}&to=${to}`,
    `fName=LoadPayments&from=${from}&to=${to}`,
    `fName=GetRevenue&from=${from}&to=${to}`,
    `fName=GetPayments&from=${from}&to=${to}`,
    `fName=LoadInvoice&from=${from}&to=${to}`,
    `fName=GetInvoice&from=${from}&to=${to}`,
    `fName=LoadBilling&from=${from}&to=${to}`,
    // Report number variations
    `fName=Report399&from=${from}&to=${to}`,
    `fName=rpt399&from=${from}&to=${to}`,
    `fName=r399Report&from=${from}&to=${to}`,
  ];

  for (const body of probes) {
    const fname = body.match(/fName=([^&]+)/)[1];
    const records = await probeEndpoint(cookie, fname, body);
    if (records.length > 0) {
      console.log(`\n✅ SUCCESS: ${fname} returned ${records.length} records`);
      break;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
