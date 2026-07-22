const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

// EXACT code from test-func2 that worked
const code = `export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
  await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
  await new Promise(r => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
  return 'clicked, url: ' + page.url() + ', cookies: ' + (await page.cookies()).length;
};`;

const payload = JSON.stringify({ code });
const t0 = Date.now();
const req = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=25000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode, 'in', Date.now()-t0, 'ms');
    console.log('Response:', d);
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
