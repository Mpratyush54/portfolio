const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function ss(name, url, waitMs = 4000) {
  const code = `export default async function({ page }) {
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
    await new Promise(r => setTimeout(r, ${waitMs}));
    await page.goto('${url}', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    const s = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: '${name}', d: Array.from(s) }]);
  };`;

  console.log('  fetching', name, '...');
  const ep = `https://chrome.browserless.io/function?token=${API_KEY}&timeout=40000`;
  const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 100));
  const r = JSON.parse(text);
  for (const x of r) {
    fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d));
    console.log('    saved', x.n + '.jpg', x.d.length, 'bytes');
  }
}

async function main() {
  // Get remaining pages
  for (const p of [
    { name: 'classstream-students', url: 'https://school.pratyushes.dev/students' },
    { name: 'classstream-messages', url: 'https://school.pratyushes.dev/messages' },
    { name: 'classstream-settings', url: 'https://school.pratyushes.dev/settings' }
  ]) {
    try { await ss(p.name, p.url); }
    catch(e) { console.log('    failed:', e.message); }
    await new Promise(r => setTimeout(r, 3000));
  }
}
main().catch(e => console.log('Error:', e.message));
