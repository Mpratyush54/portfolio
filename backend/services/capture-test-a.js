const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=45000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run(code) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const t0 = Date.now();
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Completed in', Date.now()-t0, 'ms, HTTP', res.statusCode);
        if (res.statusCode !== 200) return reject(new Error(d.slice(0, 200)));
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Test A: Login + screenshot of just the dashboard
  console.log('Test A: Login + 1 screenshot...');
  try {
    const results = await run(`export default async function({ page }) {
      const results = [];
      await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));
      await page.evaluate(() => {
        document.querySelector('input[name="username"]').value = 'hellothgfbv';
        document.querySelector('input[name="username"]').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('input[name="password"]').value = 'Pratyush@123';
        document.querySelector('input[name="password"]').dispatchEvent(new Event('input', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => { document.querySelector('button[type=\"submit\"]').click(); });
      await new Promise(r => setTimeout(r, 4000));
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      results.push({ name: 'classstream', data: Array.from(ss) });
      return JSON.stringify(results);
    };`);
    for (const r of results) {
      fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
      console.log('  Saved:', r.name + '.jpg', r.data.length, 'bytes');
    }
  } catch(e) { console.log('  Failed:', e.message); }

  await new Promise(r => setTimeout(r, 3000));

  // Test B: Just screenshot the login page (no login)
  console.log('\nTest B: Screenshot login page...');
  try {
    const results = await run(`export default async function({ page }) {
      await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      return JSON.stringify([{ name: 'login-page', data: Array.from(ss) }]);
    };`);
    for (const r of results) {
      fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
      console.log('  Saved:', r.name + '.jpg', r.data.length, 'bytes');
    }
  } catch(e) { console.log('  Failed:', e.message); }
}
main().catch(console.error);
