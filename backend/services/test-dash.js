const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Test A: Login + screenshot of current page (dashboard)
const codeA = `export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => {
    document.querySelector('input[name="username"]').value = 'hellothgfbv';
    document.querySelector('input[name="username"]').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('input[name="password"]').value = 'Pratyush@123';
    document.querySelector('input[name="password"]').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => { document.querySelector('button[type="submit"]').click(); });
  await new Promise(r => setTimeout(r, 5000));
  const url = page.url();
  const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
  return JSON.stringify([{ n: 'classstream', u: url, d: Array.from(ss) }]);
};`;

async function run(label, code, timeout = 35000) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ code });
    const t0 = Date.now();
    const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=' + timeout, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms');
        if (res.statusCode === 200) {
          const r = JSON.parse(d);
          r.forEach(x => {
            if (x.d) {
              const f = path.join(OUT_DIR, x.n + '.jpg');
              fs.writeFileSync(f, Buffer.from(x.d));
              console.log('  Saved: ' + x.n + '.jpg (' + x.d.length + ' bytes)' + (x.u ? ' url=' + x.u : ''));
            }
          });
        } else {
          console.log('  Error: ' + d.slice(0, 200));
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await run('Test A: login + screenshot dashboard', codeA, 35000);
}
main();
