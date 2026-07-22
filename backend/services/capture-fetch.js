const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runFunction(code, timeout = 30000) {
  const url = `https://chrome.browserless.io/function?token=${API_KEY}&timeout=${timeout}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  // 1. ClassStream Dashboard
  console.log('=== ClassStream Dashboard ===');
  let r = await runFunction(`
    export default async function({ page }) {
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
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      return JSON.stringify([{ n: 'classstream', d: Array.from(ss) }]);
    };
  `, 30000);
  for (const x of r) { fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d)); console.log('  \u2713', x.n + '.jpg', x.d.length, 'bytes'); }

  await new Promise(r => setTimeout(r, 3000));

  // 2. Recalibrate Forum
  console.log('\n=== Recalibrate Forum ===');
  r = await runFunction(`
    export default async function({ page }) {
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
      await new Promise(r => setTimeout(r, 5000));
      const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
      return JSON.stringify([{ n: 'recalibrate-forum', d: Array.from(ss) }]);
    };
  `, 30000);
  for (const x of r) { fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d)); console.log('  \u2713', x.n + '.jpg', x.d.length, 'bytes'); }

  console.log('\nDone. Files:', fs.readdirSync(OUT_DIR).join(', '));
}
main().catch(e => console.error('Error:', e.message));
