/**
 * Probe ReportViewer.aspx and Stimulsoft stiweb_action endpoints for revenue data.
 * The Stimulsoft viewer uses POST requests with stiweb_action parameter.
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

  // First, look at ReportViewer.aspx content
  console.log('=== ReportViewer.aspx ===');
  const rv = await fetch(origin + '/ReportViewer.aspx?id=399', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  const rvHtml = await rv.text();
  console.log('Size:', rvHtml.length);
  console.log('Content:', rvHtml.substring(0, 2000));

  // Look for DBAL calls in ReportViewer
  const dbalCalls = [...rvHtml.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
  console.log('DBAL calls:', [...new Set(dbalCalls)]);

  // Try the Stimulsoft viewer POST with JSON body
  console.log('\n=== Stimulsoft Viewer POST (JSON) ===');
  const viewerUrl = '/Designer2.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399&mode=';
  
  const stimActions = [
    { action: 'GetReport', data: {} },
    { action: 'GetReportSnapshot', data: {} },
    { action: 'GetPages', data: {} },
    { action: 'GetPage', data: { pageIndex: 0 } },
    { action: 'GetData', data: {} },
    { action: 'ExportReport', data: { format: 'Json' } },
    { action: 'ExportReport', data: { format: 'Csv' } },
    { action: 'ExportReport', data: { format: 'Xml' } },
  ];

  for (const { action, data } of stimActions) {
    const body = JSON.stringify({ action, ...data });
    try {
      const res = await fetch(origin + viewerUrl + '&stiweb_action=' + action + '&stiweb_component=Viewer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Cookie: cookie 
        },
        body,
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      if (text.length > 100 && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
        console.log(`✅ ${action}: ${text.length} bytes`);
        console.log('  Preview:', text.substring(0, 300));
      } else {
        console.log(`❌ ${action}: ${text.length} bytes (HTML response)`);
      }
    } catch (e) {
      console.log(`❌ ${action}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Try the Stimulsoft viewer with GET stiweb_action
  console.log('\n=== Stimulsoft Viewer GET actions ===');
  const getActions = [
    'GetReport', 'GetReportSnapshot', 'GetPages', 'GetPage', 'GetData',
    'ExportReport', 'PrintReport', 'GetLocalization',
  ];
  for (const action of getActions) {
    const url = origin + viewerUrl + '&stiweb_action=' + action + '&stiweb_component=Viewer&stiweb_version=2018.1.7';
    try {
      const res = await fetch(url, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      if (text.length > 100 && !text.includes('<html') && !text.includes('<!DOCTYPE')) {
        console.log(`✅ GET ${action}: ${text.length} bytes`);
        console.log('  Preview:', text.substring(0, 300));
      } else {
        console.log(`❌ GET ${action}: ${text.length} bytes (HTML/empty)`);
      }
    } catch (e) {
      console.log(`❌ GET ${action}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Try the DBAL fName=Revenue that was found in ReportViewer.aspx
  console.log('\n=== DBAL fName=Revenue ===');
  const from = '2025-04-01';
  const to = '2025-04-04';
  const revBodies = [
    `fName=Revenue&from=${from}&to=${to}`,
    `fName=Revenue&FromDate=${from}&ToDate=${to}`,
    `fName=Revenue&from=${from}&to=${to}&id=399`,
    `fName=Revenue&from=${from}&to=${to}&dept=&prov=&branch=`,
    `fName=Revenue&from=${from}&to=${to}&opt=0`,
    `fName=Revenue&from=${from}&to=${to}&status=all`,
    `fName=Revenue&from=${from}&to=${to}&type=all`,
  ];
  for (const body of revBodies) {
    const res = await fetch(origin + '/DBAL/DBAL.ASPX', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (text.length > 10) {
      console.log(`✅ ${body}: ${text.length} bytes`);
      console.log('  Preview:', text.substring(0, 300));
    } else {
      console.log(`❌ ${body}: empty`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
