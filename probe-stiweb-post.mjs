/**
 * The Stimulsoft viewer uses a specific POST format with stiweb_requestUrl and JSON body.
 * Let's try the correct Stimulsoft POST format to get report data.
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

  const from = '2025-04-01';
  const to = '2025-04-04';

  // The Stimulsoft viewer sends POST requests to the same page URL with stiweb_action in the body
  // The body is typically JSON with action and parameters
  const viewerUrl = origin + '/ReportViewer.aspx?id=399';

  console.log('=== Stimulsoft Viewer POST with proper format ===');
  
  // Stimulsoft 2018.1.7 format - the action is in the POST body as JSON
  const stimRequests = [
    // GetReport action
    { url: viewerUrl + '&stiweb_component=Viewer&stiweb_action=GetReport', body: '{"action":"GetReport"}' },
    // GetReportSnapshot
    { url: viewerUrl + '&stiweb_component=Viewer&stiweb_action=GetReportSnapshot', body: '{"action":"GetReportSnapshot"}' },
    // With parameters
    { url: viewerUrl + '&stiweb_component=Viewer&stiweb_action=GetReport', body: JSON.stringify({ action: 'GetReport', variables: [{ name: 'FromDate', value: from }, { name: 'ToDate', value: to }] }) },
    // Export to JSON
    { url: viewerUrl + '&stiweb_component=Viewer&stiweb_action=ExportReport', body: JSON.stringify({ action: 'ExportReport', format: 'Json' }) },
    // Export to CSV
    { url: viewerUrl + '&stiweb_component=Viewer&stiweb_action=ExportReport', body: JSON.stringify({ action: 'ExportReport', format: 'Csv' }) },
  ];

  for (const req of stimRequests) {
    try {
      const res = await fetch(req.url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: req.body,
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
      console.log(`${isHtml ? '❌' : '✅'} ${req.url.split('?')[1].substring(0, 60)}: ${text.length} bytes`);
      if (!isHtml && text.length > 10) {
        console.log('  Preview:', text.substring(0, 500));
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Try the Stimulsoft viewer with form data POST (not JSON)
  console.log('\n=== Stimulsoft Viewer POST with form data ===');
  const formDataRequests = [
    `stiweb_action=GetReport&stiweb_component=Viewer`,
    `stiweb_action=GetReportSnapshot&stiweb_component=Viewer`,
    `stiweb_action=GetReport&stiweb_component=Viewer&stiweb_data=`,
    `stiweb_action=GetPages&stiweb_component=Viewer`,
  ];
  for (const body of formDataRequests) {
    const res = await fetch(viewerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
    console.log(`${isHtml ? '❌' : '✅'} ${body}: ${text.length} bytes`);
    if (!isHtml && text.length > 10) {
      console.log('  Preview:', text.substring(0, 500));
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Try to get the report parameters page
  console.log('\n=== Report Parameters ===');
  const paramRes = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=GetReportParams&id=399',
    signal: AbortSignal.timeout(15000),
  });
  const paramText = await paramRes.text();
  console.log('GetReportParams:', paramText.substring(0, 500) || 'empty');

  // Try to find what the ReportViewer.aspx page does when you click "View"
  // It likely calls a specific DBAL function with the date parameters
  console.log('\n=== ReportViewer POST with date params ===');
  const rvPostBodies = [
    `fName=Revenue&from=${from}&to=${to}`,
    `__VIEWSTATE=&fName=Revenue&from=${from}&to=${to}`,
    `id=399&from=${from}&to=${to}&action=view`,
    `id=399&FromDate=${from}&ToDate=${to}&action=view`,
  ];
  for (const body of rvPostBodies) {
    const res = await fetch(origin + '/ReportViewer.aspx?id=399', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
    console.log(`${isHtml ? '❌' : '✅'} ${body.substring(0, 60)}: ${text.length} bytes`);
    if (!isHtml && text.length > 10) {
      console.log('  Preview:', text.substring(0, 300));
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Try UTIL.js which was referenced in the main page
  console.log('\n=== Checking UTIL.js for revenue functions ===');
  const utilRes = await fetch(origin + '/js/UTIL.js?13032025144226', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  const utilJs = await utilRes.text();
  console.log('UTIL.js size:', utilJs.length);
  // Find revenue/billing related functions
  const revenueMatches = utilJs.match(/function\s+\w*(revenue|billing|payment|cash|income|invoice)\w*/gi) || [];
  console.log('Revenue functions:', revenueMatches);
  // Find all DBAL calls
  const dbalCalls = [...utilJs.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
  console.log('DBAL calls in UTIL.js:', [...new Set(dbalCalls)]);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
