const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function capture(name, targetPage) {
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
    await new Promise(r => setTimeout(r, 4000));
    try {
      await page.goto('${targetPage}', { waitUntil: 'load', timeout: 10000 });
    } catch(e) {
      // if navigation fails, just screenshot current page
    }
    await new Promise(r => setTimeout(r, 3000));
    const s = await page.screenshot({ type: 'jpeg', quality: 85 });
    return JSON.stringify([{ n: '${name}', u: page.url(), d: Array.from(s) }]);
  };`;

  console.log('  capturing', name, '...');
  const ep = `https://chrome.browserless.io/function?token=${API_KEY}&timeout=35000`;
  const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200));
  const r = JSON.parse(text);
  for (const x of r) {
    fs.writeFileSync(path.join(OUT_DIR, x.n + '.jpg'), Buffer.from(x.d));
    console.log('   ', x.n + '.jpg', x.d.length, 'bytes', x.u ? '(url: ' + x.u + ')' : '');
  }
}

async function main() {
  await capture('classstream-messages', 'https://school.pratyushes.dev/messages').catch(e => console.log('   error:', e.message));
  await new Promise(r => setTimeout(r, 3000));
  await capture('classstream-settings', 'https://school.pratyushes.dev/settings').catch(e => console.log('   error:', e.message));
}
main().catch(e => console.log('Error:', e.message));
