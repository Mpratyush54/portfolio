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
  console.log('=== Recalibrate Forum Debug ===');
  
  // Test 1: Just check what form is on the login page  
  try {
    const r = await runFn(`
      export default async function({ page }) {
        await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        const info = await page.evaluate(() => {
          const f = document.querySelector('form');
          if (!f) return JSON.stringify({ error: 'no form', url: location.href });
          const inputs = Array.from(f.querySelectorAll('input')).map(i => ({ n: i.name, t: i.type, id: i.id, ph: i.placeholder }));
          const btns = Array.from(f.querySelectorAll('button')).map(b => ({ t: b.type, text: b.innerText.trim() }));
          return JSON.stringify({ url: location.href, inputs, btns, action: f.action });
        });
        return info;
      };
    `, 20000);
    console.log('Form info:', typeof r === 'string' ? r : JSON.stringify(r));
  } catch(e) { console.log('Test 1 failed:', e.message); }

  await new Promise(r => setTimeout(r, 3000));

  // Test 2: Try login and check URL after
  try {
    const r = await runFn(`
      export default async function({ page }) {
        await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        await page.evaluate(() => {
          const e = document.querySelector('input[name="email"]');
          const p = document.querySelector('input[type="password"]');
          if (e) e.value = 'mpratyush54@gmail.com';
          if (p) p.value = 'Pratyush@151';
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 5000));
        return JSON.stringify({ url: page.url(), title: await page.title() });
      };
    `, 25000);
    console.log('After login:', r);
  } catch(e) { console.log('Test 2 failed:', e.message); }
}
main().catch(e => console.log('Error:', e.message));
