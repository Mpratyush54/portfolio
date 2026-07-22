const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runFn(code, timeout = 30000) {
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
  // ClassStream dashboard screenshot already taken.
  // Now take more pages via separate login-per-page calls

  const pages = [
    { name: 'classstream-classes', path: '/classes' },
    { name: 'classstream-students', path: '/students' },
    { name: 'classstream-messages', path: '/messages' },
    { name: 'classstream-settings', path: '/settings' }
  ];

  for (const p of pages) {
    console.log('=== ' + p.name + ' ===');
    try {
      const r = await runFn(`
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
          await new Promise(r => setTimeout(r, 4000));
          await page.goto('https://school.pratyushes.dev${p.path}', { waitUntil: 'load', timeout: 15000 });
          await new Promise(r => setTimeout(r, 3000));
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          return JSON.stringify([{ n: '${p.name}', d: Array.from(ss) }]);
        };
      `, 40000);
      for (const x of r) { fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d)); console.log('  \u2713', x.n + '.jpg', x.d.length, 'bytes'); }
    } catch(e) { console.log('  \u2717', e.message); }
    await new Promise(r => setTimeout(r, 3000));
  }

  // Recalibrate: just take public page screenshots
  console.log('\n=== recalibrate-forum (public) ===');
  try {
    const r = await runFn(`
      export default async function({ page }) {
        await page.goto('https://recalibrating.capskengeri.com/', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 4000));
        const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
        return JSON.stringify([{ n: 'recalibrate-forum', d: Array.from(ss) }]);
      };
    `);
    for (const x of r) { fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d)); console.log('  \u2713', x.n + '.jpg', x.d.length, 'bytes'); }
  } catch(e) { console.log('  \u2717', e.message); }

  console.log('\nDone. Files:', fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.jpg')).join(', '));
}
main().catch(e => console.log('Error:', e.message));
