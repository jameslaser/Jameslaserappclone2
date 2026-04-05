/**
 * Browse HMS web UI pages to find revenue/billing JS files and DBAL function names.
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
  const lt = await lr.text();
  console.log('[Login]', lt.trim().substring(0, 40));
  return cookie;
}

async function fetchPage(cookie, path) {
  try {
    const r = await fetch(origin + path, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    return { status: r.status, text: await r.text() };
  } catch (e) {
    return { status: 0, text: '', error: e.message };
  }
}

async function fetchJS(cookie, path) {
  try {
    const r = await fetch(origin + path, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 200) return '';
    return await r.text();
  } catch (e) {
    return '';
  }
}

function extractDBALCalls(text) {
  // Match patterns like: fName:'r399', fName="r399", fName: 'r399', 'fName','r399'
  const patterns = [
    /fName['":\s,]+([A-Za-z0-9_]+)/g,
    /["']fName["']\s*[,:]\s*["']([A-Za-z0-9_]+)["']/g,
    /DBAL\.ASPX.*?fName=([A-Za-z0-9_]+)/g,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      found.add(m[1]);
    }
  }
  return [...found];
}

async function main() {
  console.log('Logging in...');
  const cookie = await hmsLogin();

  // Get the main page to find navigation links
  console.log('\n--- Main page ---');
  const main = await fetchPage(cookie, '/');
  if (main.status === 200) {
    const links = [...main.text.matchAll(/href=['"]([^'"]+\.aspx[^'"]*)['"]/gi)].map(m => m[1]);
    const uniqueLinks = [...new Set(links)].filter(l => !l.includes('javascript') && !l.includes('#'));
    console.log('ASPX links found:', uniqueLinks.slice(0, 30));
    
    // Find JS files
    const jsFiles = [...main.text.matchAll(/src=['"]([^'"]+\.js[^'"]*)['"]/gi)].map(m => m[1]);
    console.log('JS files:', jsFiles.slice(0, 20));
    
    // Extract DBAL calls
    const dbalCalls = extractDBALCalls(main.text);
    console.log('DBAL calls in main page:', dbalCalls);
  }

  // Try to find revenue-related pages
  const pagesToCheck = [
    '/Home.aspx',
    '/Default.aspx',
    '/Main.aspx',
    '/Dashboard.aspx',
    '/Billing/Default.aspx',
    '/Billing/Invoice.aspx',
    '/Billing/Revenue.aspx',
    '/Billing/Report.aspx',
    '/Reports/Default.aspx',
    '/Reports/Revenue.aspx',
    '/Reports/r399.aspx',
    '/Reports/Report399.aspx',
    '/Finance/Default.aspx',
    '/Finance/Revenue.aspx',
    '/Accounts/Default.aspx',
    '/Cashier/Default.aspx',
    '/Cashier/Revenue.aspx',
    '/Reception/Default.aspx',
  ];

  for (const page of pagesToCheck) {
    const res = await fetchPage(cookie, page);
    if (res.status === 200 && res.text.length > 100) {
      console.log(`\n✅ Page found: ${page} (${res.text.length} bytes)`);
      const dbalCalls = extractDBALCalls(res.text);
      if (dbalCalls.length > 0) {
        console.log('  DBAL calls:', dbalCalls);
      }
      // Find JS files
      const jsFiles = [...res.text.matchAll(/src=['"]([^'"]+\.js[^'"]*)['"]/gi)].map(m => m[1]);
      if (jsFiles.length > 0) {
        console.log('  JS files:', jsFiles.slice(0, 10));
        // Fetch and scan JS files for DBAL calls
        for (const jsFile of jsFiles.slice(0, 5)) {
          const jsPath = jsFile.startsWith('http') ? jsFile.replace(origin, '') : jsFile;
          const jsContent = await fetchJS(cookie, jsPath);
          if (jsContent.length > 0) {
            const jsDbalCalls = extractDBALCalls(jsContent);
            if (jsDbalCalls.length > 0) {
              console.log(`  JS ${jsPath}: DBAL calls:`, jsDbalCalls);
            }
          }
        }
      }
    }
  }

  // Also try to find any .js files that might contain revenue DBAL calls
  console.log('\n--- Scanning known JS paths ---');
  const jsPaths = [
    '/js/billing.js',
    '/js/revenue.js',
    '/js/reports.js',
    '/js/finance.js',
    '/js/cashier.js',
    '/Scripts/billing.js',
    '/Scripts/revenue.js',
    '/Scripts/reports.js',
    '/DBAL/billing.js',
    '/DBAL/revenue.js',
  ];
  for (const jsPath of jsPaths) {
    const content = await fetchJS(cookie, jsPath);
    if (content.length > 50) {
      console.log(`Found JS: ${jsPath} (${content.length} bytes)`);
      const calls = extractDBALCalls(content);
      if (calls.length > 0) console.log('  DBAL calls:', calls);
    }
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
