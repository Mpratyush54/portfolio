const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

async function run(label, code, timeout = 25000) {
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
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms ' + d.slice(0, 300));
        resolve();
      });
    });
    req.on('error', e => { console.log(label + ': error ' + e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  await run('fill via evaluate', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      const u = document.querySelector('input[name="username"]');
      const p = document.querySelector('input[name="password"]');
      if (u) { u.value = 'hellothgfbv'; u.dispatchEvent(new Event('input', { bubbles: true })); }
      if (p) { p.value = 'Pratyush@123'; p.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await new Promise(r => setTimeout(r, 2000));
    const val = await page.evaluate(() => {
      const u = document.querySelector('input[name="username"]');
      return u ? 'filled: ' + u.value : 'not found';
    });
    return val;
  };`);

  await new Promise(r => setTimeout(r, 3000));

  await run('click submit via evaluate', `export default async function({ page }) {
    await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      const u = document.querySelector('input[name="username"]');
      const p = document.querySelector('input[name="password"]');
      if (u) { u.value = 'hellothgfbv'; u.dispatchEvent(new Event('input', { bubbles: true })); }
      if (p) { p.value = 'Pratyush@123'; p.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    return 'after submit url: ' + page.url();
  };`);
}
main();
