const origin = 'https://newlook-hms.dataocean-cloud.com';

async function main() {
  console.log('Getting session...');
  const homeRes = await fetch(origin, { redirect: 'follow' });
  const sc = homeRes.headers.get('set-cookie') || '';
  const sm = sc.match(/ASP\.NET_SessionId=([^;]+)/);
  if (!sm) { console.error('No session cookie'); return; }
  let cookie = 'ASP.NET_SessionId=' + sm[1];
  console.log('Session:', sm[1]);

  console.log('Getting groups...');
  const gr = await fetch(origin + '/DBAL/AUTHENTICATE_DBAL.aspx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=GetPermGroups&uname=NR011',
  });
  const gt = await gr.text();
  const gm = gt.match(/\^-\^(\d+)\^-\^/);
  if (!gm) { console.error('No group:', gt.substring(0, 100)); return; }
  console.log('Group:', gm[1]);

  console.log('Logging in...');
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
  const lt = await lr.text();
  console.log('Login result:', lt.trim().substring(0, 30));

  // Fetch one day
  console.log('Fetching 2025-02-01 to 2025-02-02...');
  const t0 = Date.now();
  const dr = await fetch(origin + '/DBAL/DBAL.ASPX', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'fName=LoadAllAppointment&key=&from=2025-02-01&to=2025-02-02&by=date&status=all&opt=0',
    signal: AbortSignal.timeout(30000),
  });
  console.log('HTTP status:', dr.status, 'in', Date.now() - t0, 'ms');
  const raw = await dr.text();
  console.log('Response size:', raw.length, 'bytes');

  // Parse multi-response
  const parts = raw.split(']^[');
  let total = 0;
  for (const p of parts) {
    let s = p.trim();
    if (!s) continue;
    if (s.charAt(0) !== '[') s = '[' + s;
    if (s.charAt(s.length - 1) !== ']') s = s + ']';
    try {
      total += JSON.parse(s).length;
    } catch (e) {
      // skip
    }
  }
  console.log('Records parsed:', total);
  console.log('DONE');
}

main().catch(e => console.error('FATAL:', e.message));
