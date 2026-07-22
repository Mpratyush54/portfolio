const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=20000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const code = `
export default async function({ page }) {
  await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
  await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
  await new Promise(r => setTimeout(r, 500));
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
  const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
  return [...ss];
};
`;

console.log('Login + screenshot...');
const payload = JSON.stringify({ code });
const req = https.request(EP, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode, '| Response length:', d.length, 'chars');
    if (res.statusCode === 200) {
      try {
        const arr = JSON.parse(d);
        if (Array.isArray(arr)) {
          const buf = Buffer.from(arr);
          const name = 'classstream-dashboard.jpg';
          fs.writeFileSync(path.join(OUT_DIR, name), buf);
          console.log('Saved:', name, '-', buf.length, 'bytes');
        } else {
          console.log('Not an array:', JSON.stringify(arr).slice(0, 200));
        }
      } catch(e) {
        console.log('Parse error:', e.message);
        console.log('First 100 chars:', d.slice(0, 100));
      }
    } else {
      console.log('Error response:', d.slice(0, 200));
    }
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
