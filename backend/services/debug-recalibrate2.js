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
  console.log('=== Recalibrate Login with events ===');

  try {
    const r = await runFn(`
      export default async function({ page }) {
        await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        
        // Fill form with proper events
        await page.evaluate(() => {
          const e = document.querySelector('input[name="email"]');
          const p = document.querySelector('input[type="password"]');
          if (e) { e.value = 'mpratyush54@gmail.com'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
          if (p) { p.value = 'Pratyush@151'; p.dispatchEvent(new Event('input', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        await new Promise(r => setTimeout(r, 1000));
        
        // Click submit
        await page.evaluate(() => {
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 5000));
        
        // Check result
        const result = await page.evaluate(() => {
          const errors = document.querySelectorAll('.error, .alert, [role="alert"], .text-red, .invalid-feedback');
          const errorTexts = Array.from(errors).map(e => e.innerText).filter(Boolean);
          return JSON.stringify({
            url: location.href,
            title: document.title,
            cookies: document.cookie,
            errors: errorTexts,
            bodyText: document.body.innerText.substring(0, 500)
          });
        });
        return result;
      };
    `, 25000);
    console.log(JSON.stringify(r, null, 2));
  } catch(e) { console.log('Failed:', e.message); }
}
main().catch(e => console.log('Error:', e.message));
