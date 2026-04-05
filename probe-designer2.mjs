/**
 * Analyze Designer2.aspx for the revenue report to find the actual data endpoint.
 * Also try LoadReport with correct parameters.
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

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  // Fetch the Designer2.aspx page and look for the report data loading mechanism
  const r = await fetch(origin + '/Designer2.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399&mode=', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  const html = await r.text();
  console.log('Designer2.aspx size:', html.length);

  // Extract all DBAL calls
  const dbalPattern = /fName['":\s,=]+([A-Za-z0-9_]+)/g;
  const dbalCalls = new Set();
  let m;
  while ((m = dbalPattern.exec(html)) !== null) {
    dbalCalls.add(m[1]);
  }
  console.log('DBAL calls found:', [...dbalCalls]);

  // Look for the report data loading function
  const reportDataIdx = html.indexOf('LoadReport');
  if (reportDataIdx >= 0) {
    console.log('\nLoadReport context:');
    console.log(html.substring(Math.max(0, reportDataIdx - 200), reportDataIdx + 500));
  }

  // Look for any AJAX calls
  const ajaxIdx = html.indexOf('Ajax.Request');
  if (ajaxIdx >= 0) {
    console.log('\nFirst Ajax.Request:');
    console.log(html.substring(ajaxIdx, ajaxIdx + 600));
  }

  // Look for all Ajax.Request calls
  let ajaxStart = 0;
  let count = 0;
  while (true) {
    const idx = html.indexOf('Ajax.Request', ajaxStart);
    if (idx < 0 || count > 10) break;
    console.log(`\nAjax.Request #${++count}:`);
    console.log(html.substring(idx, idx + 400));
    ajaxStart = idx + 1;
  }

  // Look for the report parameters form
  const formIdx = html.indexOf('<form');
  if (formIdx >= 0) {
    console.log('\nFirst form:');
    console.log(html.substring(formIdx, formIdx + 1000));
  }

  // Look for date inputs
  const dateIdx = html.indexOf('FromDate');
  if (dateIdx >= 0) {
    console.log('\nFromDate context:');
    console.log(html.substring(Math.max(0, dateIdx - 100), dateIdx + 500));
  }

  // Search for the SP name in the HTML
  const spIdx = html.indexOf('sp_rptCustomALJ');
  if (spIdx >= 0) {
    console.log('\nSP name context:');
    console.log(html.substring(Math.max(0, spIdx - 200), spIdx + 500));
  }

  // Look for any inline scripts that call DBAL
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('\nInline scripts count:', scriptMatches.length);
  for (const sm of scriptMatches) {
    const content = sm[1];
    if (content.includes('DBAL') || content.includes('fName') || content.includes('revenue') || content.includes('Revenue')) {
      console.log('\nRelevant script:');
      console.log(content.substring(0, 1000));
    }
  }

  // Also look for any external JS files that might contain the report logic
  const jsFiles = [...html.matchAll(/src=['"]([^'"]+\.js[^'"]*)['"]/gi)].map(m => m[1]);
  console.log('\nJS files:', jsFiles);

  // Try LoadReport with more parameters
  console.log('\n=== LoadReport with more params ===');
  const from = '2025-04-01';
  const to = '2025-04-04';
  const variants = [
    `fName=LoadReport&id=399&from=${from}&to=${to}&spname=sp_rptCustomALJ_StatmentOfAccountDtl`,
    `fName=LoadReport&id=399&spname=sp_rptCustomALJ_StatmentOfAccountDtl&from=${from}&to=${to}`,
    `fName=LoadReport&id=399&from=${from}&to=${to}&dept=&prov=`,
    `fName=LoadReport&id=399&from=${from}&to=${to}&branch=&dept=&prov=&class=`,
    `fName=LoadReport&id=399&from=${from}&to=${to}&p1=${from}&p2=${to}`,
    `fName=LoadReport&id=399&p1=${from}&p2=${to}`,
    `fName=LoadReport&id=399&param1=${from}&param2=${to}`,
    `fName=LoadReport&id=399&date1=${from}&date2=${to}`,
  ];
  for (const body of variants) {
    const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (text.length > 10) {
      console.log(`✅ ${body.substring(0, 80)}: ${text.length} bytes`);
      console.log('  ', text.substring(0, 200));
    } else {
      console.log(`❌ ${body.substring(0, 80)}: empty`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
