const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=60000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run(code) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
        resolve(JSON.parse(d));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Helper: login and take screenshots for a site
function makeCaptureScript(loginUrl, baseUrl, credentials, pages, prefix) {
  const { usernameField, usernameVal, passwordField, passwordVal, submitSelector } = credentials;
  const pagesJSON = JSON.stringify(pages);
  
  return `
    export default async function({ page }) {
      const results = [];
      
      await page.goto('${loginUrl}', { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));

      await page.evaluate(() => {
        const u = document.querySelector('${usernameField}');
        const p = document.querySelector('${passwordField}');
        if (u) { u.value = '${usernameVal}'; u.dispatchEvent(new Event('input', { bubbles: true })); }
        if (p) { p.value = '${passwordVal}'; p.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await new Promise(r => setTimeout(r, 500));

      await page.evaluate(() => {
        const btn = document.querySelector('${submitSelector}');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));

      const pagesArr = ${pagesJSON};
      for (const p of pagesArr) {
        try {
          await page.goto('${baseUrl}' + p, { waitUntil: 'load', timeout: 15000 });
          await new Promise(r => setTimeout(r, 3000));
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          const pathParts = p.split('/').filter(Boolean);
          const name = '${prefix}' + (pathParts.length ? '-' + pathParts.join('-') : '');
          results.push({ name, data: Array.from(ss) });
        } catch(e) {
          const pathParts = p.split('/').filter(Boolean);
          const name = '${prefix}' + (pathParts.length ? '-' + pathParts.join('-') : '');
          results.push({ name, error: e.message });
        }
      }
      return JSON.stringify(results);
    };
  `;
}

async function main() {
  console.log('=== ClassStream ===');
  const csCode = makeCaptureScript(
    'https://school.pratyushes.dev/login',
    'https://school.pratyushes.dev',
    { usernameField: 'input[name="username"]', usernameVal: 'hellothgfbv',
      passwordField: 'input[name="password"]', passwordVal: 'Pratyush@123',
      submitSelector: 'button[type="submit"]' },
    ['/', '/classes', '/students', '/messages', '/settings'],
    'classstream'
  );
  try {
    const results = await run(csCode);
    for (const r of results) {
      if (r.error) console.log('  \u2717 ' + r.name + ': ' + r.error);
      else {
        fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
        console.log('  \u2713 ' + r.name + ' \u2014 ' + r.data.length + ' bytes');
      }
    }
  } catch(e) { console.error('  Failed:', e.message); }

  console.log('\n=== Recalibrate Forum ===');
  const rfCode = makeCaptureScript(
    'https://recalibrating.capskengeri.com/login',
    'https://recalibrating.capskengeri.com',
    { usernameField: 'input[type="email"], input[name="email"]', usernameVal: 'mpratyush54@gmail.com',
      passwordField: 'input[type="password"]', passwordVal: 'Pratyush@151',
      submitSelector: 'button[type="submit"], button' },
    ['/', '/topics'],
    'recalibrate-forum'
  );
  try {
    const results = await run(rfCode);
    for (const r of results) {
      if (r.error) console.log('  \u2717 ' + r.name + ': ' + r.error);
      else {
        fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
        console.log('  \u2713 ' + r.name + ' \u2014 ' + r.data.length + ' bytes');
      }
    }
  } catch(e) { console.error('  Failed:', e.message); }

  console.log('\nDone. All files in:', OUT_DIR);
}
main().catch(console.error);
