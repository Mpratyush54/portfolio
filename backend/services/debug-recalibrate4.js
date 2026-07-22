const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runFn(code, timeout = 25000) {
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
  console.log('Test: Login via form.submit()');
  try {
    const r = await runFn(`
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
        // Try using form submit directly
        await page.evaluate(() => {
          document.querySelector('form').submit();
        });
        await new Promise(r => setTimeout(r, 5000));
        return JSON.stringify({ url: page.url(), title: await page.title() });
      };
    `);
    console.log('Result:', r);
  } catch(e) { console.log('Failed:', e.message); }

  await new Promise(r => setTimeout(r, 3000));

  console.log('\nTest: Check for response/error after button click (wait shorter)');
  try {
    const r = await runFn(`
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
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 3000));
        const result = await page.evaluate(() => {
          return JSON.stringify({
            url: location.href,
            html: document.body.innerHTML.substring(0, 1000)
          });
        });
        return result;
      };
    `);
    console.log('After click:', typeof r === 'string' ? r.substring(0, 500) : JSON.stringify(r).substring(0, 500));
  } catch(e) { console.log('Failed:', e.message); }
}
main().catch(e => console.log('Error:', e.message));
