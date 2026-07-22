const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=15000';

// Minimal approach - just login, wait, return url and localStorage keys
const code = `export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
  await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
  await new Promise(r => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
  const url = page.url();
  const c = (await page.cookies()).length;
  const ls = await page.evaluate(() => Object.keys(localStorage));
  const ss = await page.evaluate(() => Object.keys(sessionStorage));
  return JSON.stringify({ url, cookies: c, localStorage: ls, sessionStorage: ss });
};`;

const payload = JSON.stringify({ code });
const req = https.request(EP, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(d);
    console.log(JSON.stringify(parsed, null, 2));
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
