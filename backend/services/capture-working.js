const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run(code, timeout = 35000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=' + timeout;
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Each test is a separate capture with login
const tests = [
  // ClassStream dashboard (login + screenshot)
  {
    name: 'ClassStream Dashboard',
    code: `export default async function({ page }) {
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
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      return JSON.stringify([{ n: 'classstream', d: Array.from(ss) }]);
    };`, timeout: 30000
  },
  // Recalibrate Forum
  {
    name: 'Recalibrate Forum',
    code: `export default async function({ page }) {
      await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));
      await page.evaluate(() => {
        const e = document.querySelector('input[name="email"]');
        const p = document.querySelector('input[type="password"]');
        if (e) { e.value = 'mpratyush54@gmail.com'; e.dispatchEvent(new Event('input', { bubbles: true })); }
        if (p) { p.value = 'Pratyush@151'; p.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await new Promise(r => setTimeout(r, 500));
      await page.evaluate(() => {
        const b = document.querySelector('button[type="submit"]');
        if (b) b.click();
      });
      await new Promise(r => setTimeout(r, 4000));
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      return JSON.stringify([{ n: 'recalibrate-forum', d: Array.from(ss) }]);
    };`, timeout: 30000
  }
];

async function main() {
  for (const t of tests) {
    console.log('=== ' + t.name + ' ===');
    try {
      const results = await run(t.code, t.timeout);
      for (const r of results) {
        const f = path.join(OUT_DIR, r.n + '.jpg');
        fs.writeFileSync(f, Buffer.from(r.d));
        console.log('  \u2713 ' + r.n + '.jpg \u2014 ' + r.d.length + ' bytes');
      }
    } catch (e) {
      console.log('  \u2717 ' + e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\nDone. Files in:', OUT_DIR);
}
main().catch(console.error);
