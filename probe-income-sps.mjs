/**
 * Probe the income report stored procedures found in the HMS.
 * Income Reports group (ID=2) has:
 * - sp_rptIncome_ByDoctors_And_program (id=680)
 * - sp_rptIncomeCashCredit_ByUsers (id=671)
 * - sp_rptIncome_TransDoctorsByServiceCats (id=377)
 * - sp_rptIncome_ByDoctors (id=375)
 * Revenue Reports group (ID=14) has:
 * - sp_rptCustomALJ_StatmentOfAccountDtl (id=399, 400, 430, 431, 440, 441)
 * - sp_rptRevenue_InvoicedByAccount (id=389)
 * - sp_rptCustomALJ_Revenue (id=447)
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

async function dbal(cookie, body, label) {
  const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (text.length > 10 && text !== 'EMPTY' && text !== 'ERROR') {
    console.log(`✅ ${label || body.substring(0, 70)}: ${text.length} bytes`);
    console.log('  Preview:', text.substring(0, 400));
    return text;
  } else {
    console.log(`❌ ${label || body.substring(0, 70)}: ${text || 'empty'}`);
    return null;
  }
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  const from = '2025-04-01';
  const to = '2025-04-04';

  // Try each SP name as fName
  const sps = [
    'sp_rptIncome_ByDoctors_And_program',
    'sp_rptIncomeCashCredit_ByUsers',
    'sp_rptIncome_TransDoctorsByServiceCats',
    'sp_rptIncome_ByDoctors',
    'sp_rptCustomALJ_StatmentOfAccountDtl',
    'sp_rptRevenue_InvoicedByAccount',
    'sp_rptCustomALJ_Revenue',
  ];

  console.log('=== Testing SP names as fName ===');
  for (const sp of sps) {
    await dbal(cookie, `fName=${sp}&from=${from}&to=${to}`);
    await dbal(cookie, `fName=${sp}&FromDate=${from}&ToDate=${to}`);
    await dbal(cookie, `fName=${sp}&from=${from}&to=${to}&dept=&prov=&branch=`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Try the report IDs with LoadReport (which returned an error before - maybe needs more params)
  console.log('\n=== LoadReport with income report IDs ===');
  const reportIds = [680, 671, 377, 375, 399, 389, 447];
  for (const id of reportIds) {
    await dbal(cookie, `fName=LoadReport&id=${id}&from=${from}&to=${to}&dept=&prov=&branch=&class=`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Try the ReportViewer.aspx with income report IDs
  console.log('\n=== ReportViewer.aspx with income IDs ===');
  for (const id of [680, 671, 377, 375]) {
    const r = await fetch(origin + `/ReportViewer.aspx?id=${id}`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    const html = await r.text();
    if (html.length > 200) {
      console.log(`✅ ReportViewer id=${id}: ${html.length} bytes`);
      // Find the stiweb_action URL
      const stiUrl = html.match(/stiweb_component=Viewer&stiweb_action=Resource[^'"]+/);
      if (stiUrl) console.log('  Stiweb URL:', stiUrl[0].substring(0, 100));
    }
  }

  // Try to call the income SPs via the Stimulsoft viewer
  console.log('\n=== Stimulsoft viewer for income reports ===');
  for (const id of [680, 671, 377, 375]) {
    // First get the report metadata
    const reportMeta = await dbal(cookie, `fName=getreport&id=${id}&mode=`);
    if (reportMeta) {
      try {
        const meta = JSON.parse(reportMeta);
        if (meta.length > 0) {
          console.log(`Report ${id} meta:`, JSON.stringify(meta[0]));
        }
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Try the HMS search.js SearchData function with the SP params
  // SearchData likely takes: spname, and the SP's parameters
  console.log('\n=== SearchData with income SPs ===');
  for (const sp of sps) {
    await dbal(cookie, `fName=SearchData&spname=${sp}&p1=${from}&p2=${to}`);
    await dbal(cookie, `fName=SearchData&spname=${sp}&FromDate=${from}&ToDate=${to}&dept=&prov=`);
    await new Promise(r => setTimeout(r, 200));
  }

  // Try to find what the HMS cashier module uses
  // The HMS main page has a navigation - let's look at what pages are accessible
  console.log('\n=== HMS accessible pages ===');
  const pagePaths = [
    '/Cashier/Default.aspx',
    '/Cashier/Invoice.aspx',
    '/Cashier/Report.aspx',
    '/Billing/Default.aspx',
    '/Billing/Invoice.aspx',
    '/Billing/Report.aspx',
    '/Finance/Default.aspx',
    '/Finance/Invoice.aspx',
    '/Finance/Report.aspx',
    '/Reports/Income.aspx',
    '/Reports/Revenue.aspx',
    '/Reports/Billing.aspx',
    '/Reports/DailyCash.aspx',
    '/IncomeReport.aspx',
    '/RevenueReport.aspx',
    '/BillingReport.aspx',
    '/DailyCashReport.aspx',
    '/PatientBill.aspx',
    '/PatientInvoice.aspx',
    '/Invoice.aspx',
  ];
  for (const path of pagePaths) {
    try {
      const r = await fetch(origin + path, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (r.status === 200) {
        const html = await r.text();
        if (html.length > 500) {
          console.log(`✅ ${path}: ${html.length} bytes`);
          const dbalCalls = [...html.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
          if (dbalCalls.length > 0) console.log('  DBAL:', [...new Set(dbalCalls)]);
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
