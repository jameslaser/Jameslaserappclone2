/**
 * The LoadReport returns "Object reference not set" - it needs VIEWSTATE.
 * Let's:
 * 1. GET the ReportViewer.aspx page to get VIEWSTATE
 * 2. POST back with VIEWSTATE + date params
 * 3. Also try the Stimulsoft viewer's stiweb_action=GetReport with proper session
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

  // Step 1: GET ReportViewer.aspx for income report (id=375 = Doctor Income)
  console.log('=== Step 1: GET ReportViewer.aspx id=375 ===');
  const getRes = await fetch(origin + '/ReportViewer.aspx?id=375', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  const html = await getRes.text();
  
  // Extract VIEWSTATE
  const vsMatch = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);
  const vs = vsMatch ? vsMatch[1] : '';
  const vsg = vsgMatch ? vsgMatch[1] : '';
  console.log('VIEWSTATE length:', vs.length);
  console.log('VIEWSTATEGENERATOR:', vsg);

  // Extract the Stimulsoft viewer parameters
  const stiParamsMatch = html.match(/var\s+jsStiWebViewer1\s*=\s*new\s+StiJsViewer\(({[\s\S]*?})\)/);
  if (stiParamsMatch) {
    // Find the requestUrl
    const reqUrlMatch = stiParamsMatch[1].match(/"requestUrl"\s*:\s*"([^"]+)"/);
    if (reqUrlMatch) {
      console.log('Stimulsoft requestUrl:', reqUrlMatch[1]);
    }
  }

  // Step 2: POST back with VIEWSTATE + date params
  console.log('\n=== Step 2: POST ReportViewer.aspx with VIEWSTATE ===');
  const postBodies = [
    `__VIEWSTATE=${encodeURIComponent(vs)}&__VIEWSTATEGENERATOR=${vsg}&from=${from}&to=${to}`,
    `__VIEWSTATE=${encodeURIComponent(vs)}&__VIEWSTATEGENERATOR=${vsg}&FromDate=${from}&ToDate=${to}`,
    `__VIEWSTATE=${encodeURIComponent(vs)}&__VIEWSTATEGENERATOR=${vsg}&p1=${from}&p2=${to}`,
    `__VIEWSTATE=${encodeURIComponent(vs)}&__VIEWSTATEGENERATOR=${vsg}&from=${from}&to=${to}&id=375`,
  ];
  for (const body of postBodies) {
    const res = await fetch(origin + '/ReportViewer.aspx?id=375', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie,
      },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
    console.log(`${isHtml ? '❌' : '✅'} POST: ${text.length} bytes`);
    if (!isHtml && text.length > 10) {
      console.log('  Preview:', text.substring(0, 300));
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Step 3: Try the Stimulsoft viewer stiweb_action=GetReport with proper VIEWSTATE
  console.log('\n=== Step 3: Stimulsoft GetReport with VIEWSTATE ===');
  const stiRes = await fetch(origin + '/ReportViewer.aspx?id=375&stiweb_component=Viewer&stiweb_action=GetReport&stiweb_version=2018.1.7', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `__VIEWSTATE=${encodeURIComponent(vs)}&__VIEWSTATEGENERATOR=${vsg}`,
    signal: AbortSignal.timeout(30000),
  });
  const stiText = await stiRes.text();
  const stiIsHtml = stiText.includes('<html') || stiText.includes('<!DOCTYPE');
  console.log(`${stiIsHtml ? '❌' : '✅'} Stimulsoft GetReport: ${stiText.length} bytes`);
  if (!stiIsHtml && stiText.length > 10) {
    console.log('  Preview:', stiText.substring(0, 500));
  }

  // Step 4: Try the Stimulsoft viewer with JSON body
  console.log('\n=== Step 4: Stimulsoft GetReport JSON body ===');
  const stiJsonRes = await fetch(origin + '/ReportViewer.aspx?id=375&stiweb_component=Viewer&stiweb_action=GetReport', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      action: 'GetReport',
      variables: [
        { name: 'FromDate', value: from, type: 'DateTime' },
        { name: 'ToDate', value: to, type: 'DateTime' },
      ]
    }),
    signal: AbortSignal.timeout(30000),
  });
  const stiJsonText = await stiJsonRes.text();
  const stiJsonIsHtml = stiJsonText.includes('<html') || stiJsonText.includes('<!DOCTYPE');
  console.log(`${stiJsonIsHtml ? '❌' : '✅'} Stimulsoft GetReport JSON: ${stiJsonText.length} bytes`);
  if (!stiJsonIsHtml && stiJsonText.length > 10) {
    console.log('  Preview:', stiJsonText.substring(0, 500));
  }

  // Step 5: Look at what the Stimulsoft viewer JS actually does
  // The viewer page loads scripts from: /ReportViewer.aspx?id=375&stiweb_component=Viewer&stiweb_action=Resource&stiweb_data=scripts
  console.log('\n=== Step 5: Stimulsoft viewer scripts ===');
  const scriptsRes = await fetch(origin + '/ReportViewer.aspx?id=375&stiweb_component=Viewer&stiweb_action=Resource&stiweb_data=scripts&stiweb_theme=Office2013WhitePurple&stiweb_cachemode=cache&stiweb_version=2018.1.7', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(30000),
  });
  const scriptsText = await scriptsRes.text();
  console.log('Scripts size:', scriptsText.length, 'bytes');
  
  // Find the GetReport action handler
  const getReportIdx = scriptsText.indexOf('GetReport');
  if (getReportIdx >= 0) {
    console.log('GetReport context:');
    console.log(scriptsText.substring(Math.max(0, getReportIdx - 100), getReportIdx + 500));
  }

  // Find the sendRequest function
  const sendReqIdx = scriptsText.indexOf('sendRequest');
  if (sendReqIdx >= 0) {
    console.log('\nsendRequest context:');
    console.log(scriptsText.substring(sendReqIdx, sendReqIdx + 500));
  }

  // Find the requestUrl usage
  const reqUrlIdx = scriptsText.indexOf('requestUrl');
  if (reqUrlIdx >= 0) {
    console.log('\nrequestUrl context:');
    console.log(scriptsText.substring(Math.max(0, reqUrlIdx - 100), reqUrlIdx + 500));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
