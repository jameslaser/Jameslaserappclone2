/**
 * Probe the actual data endpoint for the HMS Revenue Report (id=399).
 * The stored procedure is sp_rptCustomALJ_StatmentOfAccountDtl.
 * We need to find the correct DBAL.ASPX call that executes this SP with date params.
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
  const t0 = Date.now();
  try {
    const r = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const text = await r.text();
    const elapsed = Date.now() - t0;
    if (text.length > 10 && text !== 'EMPTY' && text !== 'ERROR') {
      console.log(`✅ ${label || body.substring(0, 60)}: ${text.length} bytes in ${elapsed}ms`);
      // Try to parse
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('  Records:', parsed.length);
          console.log('  Keys:', Object.keys(parsed[0]));
          console.log('  First:', JSON.stringify(parsed[0], null, 2));
        } else {
          console.log('  Response:', JSON.stringify(parsed).substring(0, 300));
        }
      } catch (e) {
        // Multi-response format
        const parts = text.split(']^[');
        let total = 0;
        for (const p of parts) {
          let s = p.trim();
          if (!s) continue;
          if (s.charAt(0) !== '[') s = '[' + s;
          if (s.charAt(s.length - 1) !== ']') s = s + ']';
          try { total += JSON.parse(s).length; } catch {}
        }
        if (total > 0) {
          console.log('  Multi-response records:', total);
        } else {
          console.log('  Raw:', text.substring(0, 300));
        }
      }
      return text;
    } else {
      console.log(`❌ ${label || body.substring(0, 60)}: ${text || 'empty'} (${elapsed}ms)`);
    }
  } catch (e) {
    console.log(`❌ ${label || body.substring(0, 60)}: ${e.message}`);
  }
  return null;
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  const from = '2025-04-01';
  const to = '2025-04-04';
  const spname = 'sp_rptCustomALJ_StatmentOfAccountDtl';

  // The HMS reports system uses getreportview to open a report.
  // The actual data is fetched via the SP name. Let's try various call patterns.
  
  console.log('=== Trying SP-based calls ===');
  const spCalls = [
    `fName=${spname}&from=${from}&to=${to}`,
    `fName=${spname}&FromDate=${from}&ToDate=${to}`,
    `fName=${spname}&dateFrom=${from}&dateTo=${to}`,
    `fName=sp_rptCustomALJ_StatmentOfAccountDtl&from=${from}&to=${to}`,
    // Try the report ID as the function name
    `fName=r399&rptId=399&from=${from}&to=${to}`,
    `fName=getreportdata&id=399&from=${from}&to=${to}`,
    `fName=getreportdata&id=399&FromDate=${from}&ToDate=${to}`,
    `fName=runreport&id=399&from=${from}&to=${to}`,
    `fName=runreport&id=399&FromDate=${from}&ToDate=${to}`,
    `fName=execreport&id=399&from=${from}&to=${to}`,
    `fName=execreport&id=399&FromDate=${from}&ToDate=${to}`,
    `fName=LoadReport&id=399&from=${from}&to=${to}`,
    `fName=LoadReport&id=399&FromDate=${from}&ToDate=${to}`,
    `fName=GetReport&id=399&from=${from}&to=${to}`,
    `fName=GetReport&id=399&FromDate=${from}&ToDate=${to}`,
    // Try the other revenue SPs
    `fName=sp_rptRevenue_InvoicedByAccount&from=${from}&to=${to}`,
    `fName=sp_rptCustomALJ_Revenue&from=${from}&to=${to}`,
    // Try DailyCash group reports
    `fName=LoadDailyCash&from=${from}&to=${to}`,
    `fName=GetDailyCash&from=${from}&to=${to}`,
    `fName=LoadDailyCashReport&from=${from}&to=${to}`,
    `fName=GetDailyCashReport&from=${from}&to=${to}`,
    // Income reports group
    `fName=LoadIncomeReport&from=${from}&to=${to}`,
    `fName=GetIncomeReport&from=${from}&to=${to}`,
    `fName=LoadIncome&from=${from}&to=${to}`,
    `fName=GetIncome&from=${from}&to=${to}`,
    // Financial reports
    `fName=LoadFinancial&from=${from}&to=${to}`,
    `fName=GetFinancial&from=${from}&to=${to}`,
    // Try with spname parameter
    `fName=execSP&spname=${spname}&from=${from}&to=${to}`,
    `fName=runSP&spname=${spname}&from=${from}&to=${to}`,
    `fName=callSP&spname=${spname}&from=${from}&to=${to}`,
    // Try the Designer2.aspx endpoint directly
  ];

  for (const body of spCalls) {
    await dbal(cookie, body);
    await new Promise(r => setTimeout(r, 300));
  }

  // Also try fetching the Designer2.aspx page which is what the HMS UI opens for reports
  console.log('\n=== Trying Designer2.aspx ===');
  try {
    const r = await fetch(origin + `/Designer2.aspx?fName=Revenue+Report&spname=${spname}&id=399&mode=`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    const text = await r.text();
    console.log(`Designer2.aspx: HTTP ${r.status}, ${text.length} bytes`);
    if (text.length > 0) {
      // Look for DBAL calls in the page
      const dbalCalls = text.match(/fName['":\s,]+([A-Za-z0-9_]+)/g) || [];
      console.log('DBAL calls:', dbalCalls.slice(0, 20));
      // Look for JS files
      const jsFiles = text.match(/src=['"]([^'"]+\.js[^'"]*)['"]/g) || [];
      console.log('JS files:', jsFiles.slice(0, 10));
      console.log('Preview:', text.substring(0, 500));
    }
  } catch (e) {
    console.log('Designer2.aspx error:', e.message);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
