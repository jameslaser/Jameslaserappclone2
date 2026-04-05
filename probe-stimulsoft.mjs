/**
 * The HMS reports use Stimulsoft designer/viewer.
 * The viewer fetches report data via a specific URL pattern.
 * Let's find that URL and the actual data endpoint.
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

  // The Stimulsoft viewer uses a specific URL for report data.
  // Let's look at the viewer parameters more carefully.
  const r = await fetch(origin + '/Designer2.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399&mode=', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  const html = await r.text();

  // Extract the viewer parameters JSON
  const viewerParamsMatch = html.match(/jsStiWebDesigner1ViewerParameters\s*=\s*({[\s\S]*?});/);
  if (viewerParamsMatch) {
    try {
      const params = JSON.parse(viewerParamsMatch[1]);
      console.log('Viewer params:', JSON.stringify(params, null, 2).substring(0, 3000));
    } catch (e) {
      console.log('Viewer params raw:', viewerParamsMatch[1].substring(0, 1000));
    }
  }

  // Look for requestUrl or similar
  const requestUrlMatch = html.match(/requestUrl['":\s]+['"]([^'"]+)['"]/);
  if (requestUrlMatch) {
    console.log('\nRequest URL:', requestUrlMatch[1]);
  }

  // Look for the viewer URL
  const viewerUrlMatch = html.match(/viewerUrl['":\s]+['"]([^'"]+)['"]/);
  if (viewerUrlMatch) {
    console.log('\nViewer URL:', viewerUrlMatch[1]);
  }

  // Look for any URL patterns
  const urlMatches = [...html.matchAll(/url['":\s]+['"]([^'"]+\.aspx[^'"]*)['"]/gi)];
  for (const m of urlMatches) {
    console.log('URL found:', m[1]);
  }

  // Look for the report viewer page (not designer)
  console.log('\n=== Trying ReportViewer.aspx ===');
  const rv = await fetch(origin + '/ReportViewer.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  console.log('ReportViewer.aspx status:', rv.status);
  const rvHtml = await rv.text();
  if (rvHtml.length > 100) {
    console.log('Size:', rvHtml.length);
    // Look for DBAL calls
    const dbalCalls = [...rvHtml.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
    console.log('DBAL calls:', [...new Set(dbalCalls)]);
  }

  // Try the Stimulsoft viewer endpoint directly
  console.log('\n=== Trying Stimulsoft viewer endpoints ===');
  const stimPaths = [
    '/Viewer.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399',
    '/Reports/Viewer.aspx?id=399',
    '/Reports/ReportViewer.aspx?id=399',
    '/ReportViewer.aspx?id=399',
  ];
  for (const path of stimPaths) {
    try {
      const res = await fetch(origin + path, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) {
        const text = await res.text();
        console.log(`✅ ${path}: ${text.length} bytes`);
        const dbalCalls = [...text.matchAll(/fName['":\s,=]+([A-Za-z0-9_]+)/g)].map(m => m[1]);
        if (dbalCalls.length > 0) console.log('  DBAL calls:', [...new Set(dbalCalls)]);
      } else {
        console.log(`❌ ${path}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`❌ ${path}: ${e.message}`);
    }
  }

  // Try the Stimulsoft POST handler
  console.log('\n=== Trying Stimulsoft POST handler ===');
  const stimPostBodies = [
    'stiweb_action=GetReport&stiweb_component=Viewer&id=399',
    'stiweb_action=GetReportSnapshot&stiweb_component=Viewer&id=399',
    'stiweb_action=GetReportData&id=399&from=2025-04-01&to=2025-04-04',
    '__stiweb_action=GetReport&id=399',
  ];
  for (const body of stimPostBodies) {
    const res = await fetch(origin + '/Designer2.aspx?fName=Revenue+Report&spname=sp_rptCustomALJ_StatmentOfAccountDtl&id=399&mode=', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie 
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (text.length > 100) {
      console.log(`✅ POST body "${body.substring(0, 60)}": ${text.length} bytes`);
      console.log('  Preview:', text.substring(0, 300));
    } else {
      console.log(`❌ POST body "${body.substring(0, 60)}": ${text.substring(0, 50)}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // Look for the actual data URL in the full HTML
  console.log('\n=== Searching for data URLs in HTML ===');
  const dataUrlPatterns = [
    /requestUrl['":\s]+['"]([^'"]+)['"]/g,
    /dataUrl['":\s]+['"]([^'"]+)['"]/g,
    /reportUrl['":\s]+['"]([^'"]+)['"]/g,
    /serviceUrl['":\s]+['"]([^'"]+)['"]/g,
    /handlerUrl['":\s]+['"]([^'"]+)['"]/g,
  ];
  for (const pat of dataUrlPatterns) {
    let m;
    while ((m = pat.exec(html)) !== null) {
      console.log(`Pattern match: ${m[0].substring(0, 100)}`);
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
