const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=30000';
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
        console.log('HTTP', res.statusCode, 'in', Date.now()-t0, 'ms');
        console.log('Response:', d.slice(0, 300));
        resolve();
      });
    });
    req.on('error', e => { console.log('Error:', e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Test 1: Navigate + login + screenshot of login page (before submit)
  console.log('=== Test 1: Screenshot login page before submit ===');
  await run(`export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      document.querySelector('input[name="username"]').value = 'hellothgfbv';
      document.querySelector('input[name="username"]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('input[name="password"]').value = 'Pratyush@123';
      document.querySelector('input[name="password"]').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: 'filled-form', d: Array.from(ss) }]);
  };`);

  await new Promise(r => setTimeout(r, 3000));

  // Test 2: Navigate + login + WAIT + screenshot (after submit)
  console.log('=== Test 2: Screenshot after login submit ===');
  await run(`export default async function({ page }) {
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
    await new Promise(r => setTimeout(r, 4000));
    const url = page.url();
    const title = await page.title();
    const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: 'after-login', u: url, t: title, d: Array.from(ss) }]);
  };`);
}
main().catch(console.error);
