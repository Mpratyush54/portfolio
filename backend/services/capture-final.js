const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=60000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runFunction(code) {
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
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function saveResults(results) {
  for (const r of results) {
    if (r.error) {
      console.log('  \u2717 ' + r.n + ': ' + r.error);
    } else {
      fs.writeFileSync(path.join(OUT_DIR, r.n + '.jpg'), Buffer.from(r.d));
      console.log('  \u2713 ' + r.n + '.jpg \u2014 ' + r.d.length + ' bytes');
    }
  }
}

async function captureClassStream() {
  console.log('=== ClassStream Screenshots ===');
  const results = await runFunction(`
    export default async function({ page }) {
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
      await page.evaluate(() => { document.querySelector('button[type="submit"]').click(); });
      await new Promise(r => setTimeout(r, 5000));

      const pages = ['/', '/classes', '/students', '/messages', '/settings'];
      for (const p of pages) {
        try {
          if (p !== '/') {
            await page.goto('https://school.pratyushes.dev' + p, { waitUntil: 'load', timeout: 15000 });
            await new Promise(r => setTimeout(r, 3000));
          }
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          const slug = p === '/' ? 'classstream' : 'classstream-' + p.substring(1);
          results.push({ n: slug, d: Array.from(ss) });
        } catch(e) {
          const slug = p === '/' ? 'classstream' : 'classstream-' + p.substring(1);
          results.push({ n: slug, error: e.message });
        }
      }
      return JSON.stringify(results);
    };
  `);
  saveResults(results);
}

async function captureRecalibrate() {
  console.log('\n=== Recalibrate Forum Screenshots ===');
  const results = await runFunction(`
    export default async function({ page }) {
      const results = [];

      await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
      await new Promise(r => setTimeout(r, 3000));

      await page.evaluate(() => {
        const emailInput = document.querySelector('input[type="email"], input[name="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput) { emailInput.value = 'mpratyush54@gmail.com'; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }
        if (passInput) { passInput.value = 'Pratyush@151'; passInput.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await new Promise(r => setTimeout(r, 500));

      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"], button');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));

      const pages = ['/', '/topics'];
      for (const p of pages) {
        try {
          if (p !== '/') {
            await page.goto('https://recalibrating.capskengeri.com' + p, { waitUntil: 'load', timeout: 15000 });
            await new Promise(r => setTimeout(r, 3000));
          }
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          const slug = p === '/' ? 'recalibrate-forum' : 'recalibrate-forum-' + p.substring(1);
          results.push({ n: slug, d: Array.from(ss) });
        } catch(e) {
          const slug = p === '/' ? 'recalibrate-forum' : 'recalibrate-forum-' + p.substring(1);
          results.push({ n: slug, error: e.message });
        }
      }
      return JSON.stringify(results);
    };
  `);
  saveResults(results);
}

async function main() {
  try { await captureClassStream(); } catch(e) { console.error('  Failed:', e.message); }
  await new Promise(r => setTimeout(r, 3000));
  try { await captureRecalibrate(); } catch(e) { console.error('  Failed:', e.message); }
  console.log('\nDone. Files in:', OUT_DIR);
}
main().catch(console.error);
