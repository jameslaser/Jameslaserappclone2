/**
 * The search.js has a SearchData function and GetSPParams.
 * These might be the generic data endpoints for running stored procedures.
 * Also try to find the billing page by scanning the HMS navigation.
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

async function dbal(cookie, body) {
  const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (text.length > 10 && text !== 'EMPTY' && text !== 'ERROR') {
    return text;
  }
  return null;
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  const from = '2025-04-01';
  const to = '2025-04-04';
  const spname = 'sp_rptCustomALJ_StatmentOfAccountDtl';

  // Try GetSPParams to get the parameters for the revenue SP
  console.log('=== GetSPParams ===');
  const spParams = await dbal(cookie, `fName=GetSPParams&spname=${spname}`);
  if (spParams) {
    console.log('SP Params:', spParams.substring(0, 500));
  } else {
    console.log('No response');
  }

  // Try SearchData with the SP name
  console.log('\n=== SearchData ===');
  const searchDataBodies = [
    `fName=SearchData&spname=${spname}&from=${from}&to=${to}`,
    `fName=SearchData&sp=${spname}&from=${from}&to=${to}`,
    `fName=SearchData&spname=${spname}&p1=${from}&p2=${to}`,
    `fName=SearchData&spname=${spname}&FromDate=${from}&ToDate=${to}`,
    `fName=SearchData&id=399&from=${from}&to=${to}`,
    `fName=SearchData&rptId=399&from=${from}&to=${to}`,
  ];
  for (const body of searchDataBodies) {
    const result = await dbal(cookie, body);
    if (result) {
      console.log(`✅ ${body.substring(0, 70)}: ${result.length} bytes`);
      console.log('  Preview:', result.substring(0, 300));
    } else {
      console.log(`❌ ${body.substring(0, 70)}: empty`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Look at the HMS navigation to find billing module
  console.log('\n=== HMS Navigation ===');
  const navRes = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=GetMenuItems',
    signal: AbortSignal.timeout(15000),
  });
  const navText = await navRes.text();
  if (navText.length > 10) {
    console.log('Menu items:', navText.substring(0, 1000));
  }

  // Try GetUserMenu
  const menuRes = await dbal(cookie, 'fName=GetUserMenu');
  if (menuRes) console.log('GetUserMenu:', menuRes.substring(0, 500));

  // Try GetNavigation
  const navRes2 = await dbal(cookie, 'fName=GetNavigation');
  if (navRes2) console.log('GetNavigation:', navRes2.substring(0, 500));

  // Try to get the HMS dashboard data which might include revenue
  const dashRes = await dbal(cookie, 'fName=GetDashboardData');
  if (dashRes) console.log('GetDashboardData:', dashRes.substring(0, 500));

  const dashRes2 = await dbal(cookie, 'fName=LoadDashboard');
  if (dashRes2) console.log('LoadDashboard:', dashRes2.substring(0, 500));

  // Try the KPI endpoints
  console.log('\n=== KPI Endpoints ===');
  const kpiRes = await dbal(cookie, 'fName=GetKpiGroups');
  if (kpiRes) {
    console.log('GetKpiGroups:', kpiRes.substring(0, 500));
    try {
      const kpiGroups = JSON.parse(kpiRes);
      console.log('KPI groups:', kpiGroups);
    } catch (e) {}
  }

  // Try the income reports group (ID=2 from GetReportGroups)
  console.log('\n=== Income Reports Group (ID=2) ===');
  const incomeReports = await dbal(cookie, 'fName=loadReports&str=&Gid=2');
  if (incomeReports) {
    console.log('Income reports:', incomeReports.substring(0, 1000));
    try {
      const reports = JSON.parse(incomeReports);
      for (const r of reports) {
        console.log(`  Report: id=${r.id} name="${r.engname}" sp="${r.spname}"`);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }

  // Try DailyCashReports group (ID=32)
  console.log('\n=== DailyCash Reports Group (ID=32) ===');
  const cashReports = await dbal(cookie, 'fName=loadReports&str=&Gid=32');
  if (cashReports) {
    console.log('DailyCash reports:', cashReports.substring(0, 1000));
    try {
      const reports = JSON.parse(cashReports);
      for (const r of reports) {
        console.log(`  Report: id=${r.id} name="${r.engname}" sp="${r.spname}"`);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }

  // Try FinancialReports group (ID=7)
  console.log('\n=== Financial Reports Group (ID=7) ===');
  const finReports = await dbal(cookie, 'fName=loadReports&str=&Gid=7');
  if (finReports) {
    console.log('Financial reports:', finReports.substring(0, 1000));
    try {
      const reports = JSON.parse(finReports);
      for (const r of reports) {
        console.log(`  Report: id=${r.id} name="${r.engname}" sp="${r.spname}"`);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }

  // Try InvoicesReports group (ID=34)
  console.log('\n=== Invoice Reports Group (ID=34) ===');
  const invReports = await dbal(cookie, 'fName=loadReports&str=&Gid=34');
  if (invReports) {
    console.log('Invoice reports:', invReports.substring(0, 1000));
    try {
      const reports = JSON.parse(invReports);
      for (const r of reports) {
        console.log(`  Report: id=${r.id} name="${r.engname}" sp="${r.spname}"`);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
