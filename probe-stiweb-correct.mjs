/**
 * The Stimulsoft viewer sends POST requests with action in the body.
 * The requestUrl is /ReportViewer.aspx?id=375
 * The action is sent as: { action: "GetReport" } or { action: "GetPages" }
 * Let's try this correctly.
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

  // The Stimulsoft viewer uses postAjax which sends JSON body with action field
  // The URL is the requestUrl: /ReportViewer.aspx?id=375
  // Let's try sending the correct format

  const reportIds = [375, 671, 399];
  
  for (const id of reportIds) {
    console.log(`\n=== Report ID ${id} ===`);
    
    // Try GetReport action
    const actions = ['GetReport', 'GetPages', 'GetPage', 'ExportReport'];
    for (const action of actions) {
      const body = JSON.stringify({ action });
      const res = await fetch(origin + `/ReportViewer.aspx?id=${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/plain, */*',
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      const text = await res.text();
      const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
      if (!isHtml && text.length > 10) {
        console.log(`✅ ${action}: ${text.length} bytes`);
        console.log('  Preview:', text.substring(0, 500));
        // Try to parse as JSON
        try {
          const json = JSON.parse(text);
          console.log('  Parsed:', JSON.stringify(json).substring(0, 300));
        } catch (e) {}
      } else {
        console.log(`❌ ${action}: ${text.length} bytes (HTML/empty)`);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // Try with variables for date range
    const bodyWithVars = JSON.stringify({
      action: 'GetReport',
      variables: [
        { name: 'FromDate', value: from },
        { name: 'ToDate', value: to },
        { name: 'from', value: from },
        { name: 'to', value: to },
      ]
    });
    const res2 = await fetch(origin + `/ReportViewer.aspx?id=${id}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: bodyWithVars,
      signal: AbortSignal.timeout(30000),
    });
    const text2 = await res2.text();
    const isHtml2 = text2.includes('<html') || text2.includes('<!DOCTYPE');
    if (!isHtml2 && text2.length > 10) {
      console.log(`✅ GetReport+vars: ${text2.length} bytes`);
      console.log('  Preview:', text2.substring(0, 500));
    } else {
      console.log(`❌ GetReport+vars: ${text2.length} bytes`);
    }
  }

  // Try using the Stimulsoft viewer's export to CSV/JSON feature
  // This might return the raw data
  console.log('\n=== Export to CSV/JSON ===');
  for (const id of [375, 671, 399]) {
    const exportBody = JSON.stringify({
      action: 'ExportReport',
      format: 'Csv',
      settings: {}
    });
    const res = await fetch(origin + `/ReportViewer.aspx?id=${id}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: exportBody,
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    const isHtml = text.includes('<html') || text.includes('<!DOCTYPE');
    console.log(`${isHtml ? '❌' : '✅'} Export CSV id=${id}: ${text.length} bytes`);
    if (!isHtml && text.length > 10) {
      console.log('  Preview:', text.substring(0, 300));
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Try the DBAL endpoint with the correct fName pattern
  // The HMS might use a different naming convention
  console.log('\n=== Trying DBAL with various income patterns ===');
  const incomePatterns = [
    // Try the income SP names as DBAL functions (without sp_ prefix)
    `fName=rptIncome_ByDoctors&from=${from}&to=${to}`,
    `fName=rptIncome_ByDoctors_And_program&from=${from}&to=${to}`,
    `fName=rptIncomeCashCredit_ByUsers&from=${from}&to=${to}`,
    `fName=rptIncome_TransDoctorsByServiceCats&from=${from}&to=${to}`,
    `fName=rptCustomALJ_StatmentOfAccountDtl&from=${from}&to=${to}`,
    `fName=rptRevenue_InvoicedByAccount&from=${from}&to=${to}`,
    `fName=rptCustomALJ_Revenue&from=${from}&to=${to}`,
    // Try Income_ prefix
    `fName=Income_ByDoctors&from=${from}&to=${to}`,
    `fName=Income_ByDoctors_And_program&from=${from}&to=${to}`,
    `fName=IncomeCashCredit_ByUsers&from=${from}&to=${to}`,
    // Try Get prefix
    `fName=GetIncome_ByDoctors&from=${from}&to=${to}`,
    `fName=GetIncome_ByDoctors_And_program&from=${from}&to=${to}`,
    `fName=GetIncomeCashCredit_ByUsers&from=${from}&to=${to}`,
    // Try Load prefix
    `fName=LoadIncome_ByDoctors&from=${from}&to=${to}`,
    `fName=LoadIncome_ByDoctors_And_program&from=${from}&to=${to}`,
    `fName=LoadIncomeCashCredit_ByUsers&from=${from}&to=${to}`,
  ];
  for (const body of incomePatterns) {
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
    await new Promise(r => setTimeout(r, 150));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
