/**
 * Scan all HMS JavaScript files for revenue/billing DBAL function names.
 * Also try to find the actual revenue data by using the appointment data
 * which has STS_FIN (finished/billed) status.
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

async function fetchJS(cookie, path) {
  try {
    const r = await fetch(origin + path, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 200) return '';
    return await r.text();
  } catch (e) {
    return '';
  }
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  // Get all JS files from the main page
  const mainRes = await fetch(origin, { headers: { Cookie: cookie } });
  const mainHtml = await mainRes.text();
  const jsFiles = [...mainHtml.matchAll(/src=['"]([^'"]+\.js[^'"?]*)/gi)].map(m => m[1]);
  console.log('JS files from main page:', jsFiles);

  // Scan each JS file
  for (const jsFile of jsFiles) {
    const path = jsFile.startsWith('/') ? jsFile : '/' + jsFile;
    const content = await fetchJS(cookie, path);
    if (content.length > 0) {
      const dbalCalls = [...content.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
      const uniqueCalls = [...new Set(dbalCalls)];
      if (uniqueCalls.length > 0) {
        console.log(`\n${path} (${content.length} bytes):`);
        console.log('  DBAL calls:', uniqueCalls);
        // Look for revenue/billing related
        const revCalls = uniqueCalls.filter(c => 
          /revenue|billing|payment|cash|income|invoice|financial|account/i.test(c)
        );
        if (revCalls.length > 0) {
          console.log('  *** Revenue calls:', revCalls);
        }
      }
    }
  }

  // Also scan schedule.js which was referenced
  const scheduleJs = await fetchJS(cookie, '/js/schedule.js');
  if (scheduleJs.length > 0) {
    const dbalCalls = [...scheduleJs.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
    console.log('\nschedule.js DBAL calls:', [...new Set(dbalCalls)]);
  }

  // Try to find billing/cashier pages
  console.log('\n=== Scanning for billing/cashier pages ===');
  const pagesToScan = [
    '/Cashier.aspx',
    '/Billing.aspx',
    '/Invoice.aspx',
    '/CashierReport.aspx',
    '/BillingReport.aspx',
    '/IncomeReport.aspx',
    '/Revenue.aspx',
    '/DailyCash.aspx',
    '/DailyCashReport.aspx',
    '/Accounts.aspx',
    '/Finance.aspx',
    '/PatientBill.aspx',
    '/PatientInvoice.aspx',
  ];
  for (const page of pagesToScan) {
    try {
      const r = await fetch(origin + page, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      if (r.status === 200) {
        const html = await r.text();
        if (html.length > 200) {
          console.log(`✅ ${page}: ${html.length} bytes`);
          const dbalCalls = [...html.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
          if (dbalCalls.length > 0) console.log('  DBAL calls:', [...new Set(dbalCalls)]);
          const jsFiles = [...html.matchAll(/src=['"]([^'"]+\.js[^'"]*)['"]/gi)].map(m => m[1]);
          if (jsFiles.length > 0) console.log('  JS files:', jsFiles.slice(0, 5));
        }
      }
    } catch (e) {
      // skip
    }
  }

  // Try to use the appointment data to derive income
  // The LoadAllAppointment has STS_FIN (finished/posted) status
  // Let's check what STS_FIN=1 means and if there's a billing endpoint
  console.log('\n=== Testing appointment-based billing endpoints ===');
  const from = '2025-04-01';
  const to = '2025-04-04';
  const billingEndpoints = [
    `fName=LoadAllAppointment&key=&from=${from}&to=${to}&by=date&status=fin`,
    `fName=LoadAllAppointment&key=&from=${from}&to=${to}&by=date&status=post`,
    `fName=LoadFinishedAppointments&from=${from}&to=${to}`,
    `fName=LoadPostedAppointments&from=${from}&to=${to}`,
    `fName=LoadBilledAppointments&from=${from}&to=${to}`,
    `fName=GetPatientBill&from=${from}&to=${to}`,
    `fName=GetPatientInvoice&from=${from}&to=${to}`,
    `fName=LoadPatientAccount&from=${from}&to=${to}`,
    `fName=GetPatientAccount&from=${from}&to=${to}`,
    `fName=LoadAccountStatement&from=${from}&to=${to}`,
    `fName=GetAccountStatement&from=${from}&to=${to}`,
    // Try with patient ID
    `fName=GetPatientBill&patId=1&from=${from}&to=${to}`,
    `fName=GetPatientInvoice&patId=1&from=${from}&to=${to}`,
    // Try the SP name directly as fName
    `fName=sp_rptCustomALJ_StatmentOfAccountDtl&from=${from}&to=${to}&dept=&prov=`,
    `fName=sp_rptCustomALJ_Revenue&from=${from}&to=${to}`,
    `fName=sp_rptRevenue_InvoicedByAccount&from=${from}&to=${to}`,
  ];
  for (const body of billingEndpoints) {
    const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (text.length > 10) {
      console.log(`✅ ${body.substring(0, 70)}: ${text.length} bytes`);
      console.log('  Preview:', text.substring(0, 200));
    } else {
      console.log(`❌ ${body.substring(0, 70)}: empty`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
