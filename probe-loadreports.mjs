/**
 * Use the HMS loadReports/loadReportsGroups endpoints to discover all available reports,
 * including revenue/billing reports like r399.
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
  const r = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  if (text === 'EMPTY' || text === 'ERROR' || text.length === 0) return null;
  try { return JSON.parse(text); } catch (e) { return text; }
}

async function main() {
  const cookie = await hmsLogin();
  console.log('Logged in.\n');

  // Get report groups
  console.log('=== Report Groups ===');
  const groups = await dbal(cookie, 'fName=loadReportsGroups&str=&Gid=');
  if (groups && Array.isArray(groups)) {
    console.log('Groups count:', groups.length);
    for (const g of groups) {
      console.log(`  Group: id=${g.id} name="${g.groupname || g.name || JSON.stringify(g)}"`);
    }

    // For each group, load its reports
    console.log('\n=== Reports per Group ===');
    for (const g of groups) {
      const reports = await dbal(cookie, `fName=loadReports&str=&Gid=${g.id}`);
      if (reports && Array.isArray(reports) && reports.length > 0) {
        console.log(`\nGroup ${g.id} (${g.groupname || ''}): ${reports.length} reports`);
        for (const r of reports) {
          const name = r.engname || r.name || r.rptname || JSON.stringify(r).substring(0, 80);
          const spname = r.spname || '';
          const id = r.id || r.iid || '';
          console.log(`  Report id=${id} name="${name}" sp="${spname}"`);
          // Look for revenue/billing/payment reports
          const nameLower = name.toLowerCase();
          if (nameLower.includes('revenue') || nameLower.includes('billing') || 
              nameLower.includes('payment') || nameLower.includes('cash') ||
              nameLower.includes('invoice') || nameLower.includes('income') ||
              nameLower.includes('r399') || spname.toLowerCase().includes('r399') ||
              spname.toLowerCase().includes('revenue') || spname.toLowerCase().includes('billing')) {
            console.log(`  *** REVENUE/BILLING REPORT FOUND: id=${id} name="${name}" sp="${spname}" ***`);
          }
        }
      }
    }
  } else {
    console.log('Groups response:', typeof groups === 'string' ? groups.substring(0, 200) : JSON.stringify(groups));
  }

  // Also try GetReportGroups
  console.log('\n=== GetReportGroups ===');
  const rg = await dbal(cookie, 'fName=GetReportGroups');
  if (rg) {
    console.log('Response:', JSON.stringify(rg).substring(0, 500));
  }

  // Try to get report by ID 399 directly
  console.log('\n=== Try getreport id=399 ===');
  const r399 = await dbal(cookie, 'fName=getreport&id=399&mode=');
  if (r399) {
    console.log('r399 report:', JSON.stringify(r399).substring(0, 500));
  }

  // Try a few nearby IDs
  for (const id of [395, 396, 397, 398, 399, 400, 401, 402]) {
    const r = await dbal(cookie, `fName=getreport&id=${id}&mode=`);
    if (r && Array.isArray(r) && r.length > 0) {
      console.log(`Report ${id}:`, JSON.stringify(r[0]).substring(0, 200));
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
