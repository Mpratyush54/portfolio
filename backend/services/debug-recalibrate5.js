const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

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
  console.log('Test: Use fetch API via page.evaluate to login');
  try {
    const r = await runFn(`
      export default async function({ page }) {
        await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const result = await page.evaluate(async () => {
          try {
            const res = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'mpratyush54@gmail.com', password: 'Pratyush@151' })
            });
            return JSON.stringify({ status: res.status, ok: res.ok, url: location.href });
          } catch(e) {
            return JSON.stringify({ error: e.message });
          }
        });
        await new Promise(r => setTimeout(r, 3000));
        const info = await page.evaluate(() => JSON.stringify({
          url: location.href,
          title: document.title,
          bodyStart: document.body.innerText.substring(0, 200)
        }));
        return JSON.stringify({ loginResult: result, afterInfo: info });
      };
    `);
    console.log(JSON.stringify(r, null, 2));
  } catch(e) { console.log('Failed:', e.message); }
}
main().catch(e => console.log('Error:', e.message));
