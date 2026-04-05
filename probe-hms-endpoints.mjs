/**
 * Broad probe of HMS DBAL endpoints to discover revenue/payment functions.
 * Also tries to intercept the actual network calls by examining what the HMS web UI uses.
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
  const lt = await lr.text();
  console.log('[Login]', lt.trim().substring(0, 40));
  return cookie;
}

async function probe(cookie, body) {
  const fname = body.match(/fName=([^&]+)/)?.[1] || 'unknown';
  try {
    const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const raw = await res.text();
    if (raw.length > 10) {
      console.log(`✅ ${fname}: ${raw.length} bytes`);
      console.log('   Preview:', raw.substring(0, 200));
      return true;
    }
  } catch (e) {
    console.log(`❌ ${fname}: ${e.message}`);
  }
  return false;
}

async function main() {
  const cookie = await hmsLogin();
  const from = '2025-04-01';
  const to = '2025-04-04';

  // First, try to fetch the HMS main page HTML to find JS files that reference DBAL functions
  console.log('\n--- Scanning HMS pages for JS references ---');
  const pages = [
    '/Default.aspx',
    '/Reports/Revenue.aspx',
    '/Reports/Billing.aspx',
    '/Reports/Income.aspx',
    '/Billing/Invoice.aspx',
    '/Finance/Revenue.aspx',
  ];
  for (const page of pages) {
    try {
      const r = await fetch(origin + page, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 200) {
        const html = await r.text();
        // Look for DBAL function names
        const dbalCalls = html.match(/fName[='":\s]+([A-Za-z0-9_]+)/g) || [];
        if (dbalCalls.length > 0) {
          console.log(`Page ${page}: found DBAL calls:`, dbalCalls.slice(0, 10));
        }
        // Look for JS file references
        const jsFiles = html.match(/src=['"]([^'"]+\.js[^'"]*)['"]/g) || [];
        if (jsFiles.length > 0) {
          console.log(`Page ${page}: JS files:`, jsFiles.slice(0, 5));
        }
      }
    } catch (e) {
      // skip
    }
  }

  // Try LoadAllAppointment with different statuses to see if payment info is embedded
  console.log('\n--- Checking if LoadAllAppointment has payment fields ---');
  const apptRes = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: `fName=LoadAllAppointment&key=&from=${from}&to=${to}&by=date&status=all&opt=0`,
    signal: AbortSignal.timeout(30000),
  });
  const apptRaw = await apptRes.text();
  const parts = apptRaw.split(']^[');
  let firstRecord = null;
  for (const p of parts) {
    let s = p.trim();
    if (!s) continue;
    if (s.charAt(0) !== '[') s = '[' + s;
    if (s.charAt(s.length - 1) !== ']') s = s + ']';
    try {
      const arr = JSON.parse(s);
      if (arr.length > 0) { firstRecord = arr[0]; break; }
    } catch (e) {}
  }
  if (firstRecord) {
    console.log('Appointment record keys:', Object.keys(firstRecord));
    console.log('Full record:', JSON.stringify(firstRecord, null, 2));
  }

  // Try various revenue/billing/payment endpoint names
  console.log('\n--- Probing revenue endpoints ---');
  const endpoints = [
    // Common HMS DBAL names for billing
    `fName=LoadPatientBill&from=${from}&to=${to}`,
    `fName=LoadBillDetails&from=${from}&to=${to}`,
    `fName=GetBillingReport&from=${from}&to=${to}`,
    `fName=LoadCashReport&from=${from}&to=${to}`,
    `fName=GetCashReport&from=${from}&to=${to}`,
    `fName=LoadDailyRevenue&from=${from}&to=${to}`,
    `fName=GetDailyRevenue&from=${from}&to=${to}`,
    `fName=LoadFinancialReport&from=${from}&to=${to}`,
    `fName=GetFinancialReport&from=${from}&to=${to}`,
    `fName=LoadServiceRevenue&from=${from}&to=${to}`,
    `fName=GetServiceRevenue&from=${from}&to=${to}`,
    `fName=LoadPaymentReport&from=${from}&to=${to}`,
    `fName=GetPaymentReport&from=${from}&to=${to}`,
    `fName=LoadInvoiceReport&from=${from}&to=${to}`,
    `fName=GetInvoiceReport&from=${from}&to=${to}`,
    // DataOcean specific
    `fName=LoadDORevenue&from=${from}&to=${to}`,
    `fName=GetDORevenue&from=${from}&to=${to}`,
    `fName=LoadHMSRevenue&from=${from}&to=${to}`,
    `fName=GetHMSRevenue&from=${from}&to=${to}`,
    // Numbered reports
    `fName=r399&from=${from}&to=${to}&dept=&prov=`,
    `fName=r399&rptDate=${from}&rptDateTo=${to}`,
    `fName=r399&date=${from}&dateTo=${to}`,
    `fName=r399&fromDate=${from}&toDate=${to}`,
    `fName=r399&startDate=${from}&endDate=${to}`,
    `fName=r399&dateFrom=${from}&dateTo=${to}`,
    // Try with different parameter names
    `fName=r399&FromDate=${from}&ToDate=${to}`,
    `fName=r399&From=${from}&To=${to}`,
    // Other report numbers
    `fName=r398&from=${from}&to=${to}`,
    `fName=r400&from=${from}&to=${to}`,
    `fName=r401&from=${from}&to=${to}`,
    `fName=r402&from=${from}&to=${to}`,
    `fName=r100&from=${from}&to=${to}`,
    `fName=r200&from=${from}&to=${to}`,
    `fName=r300&from=${from}&to=${to}`,
  ];

  for (const body of endpoints) {
    const found = await probe(cookie, body);
    if (found) {
      console.log('\n🎯 Found working endpoint! Body:', body);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
