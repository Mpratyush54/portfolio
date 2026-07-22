const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const FUNC_URL = 'https://chrome.browserless.io/chromium/function?token=' + API_KEY;
const SS_URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
const LOGIN_URL = 'https://school.pratyushes.dev/login';
const SITE = 'school.pratyushes.dev';

// Step 1: Login and get cookies via /function
function loginAndGetCookies() {
  return new Promise((resolve, reject) => {
    const code = `
      export default async function({ page }) {
        await page.goto('${LOGIN_URL}', { waitUntil: 'networkidle0', timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.type('input[name="username"]', 'hellothgfbv', { delay: 40 });
        await page.type('input[name="password"]', 'Pratyush@123', { delay: 40 });
        await new Promise(r => setTimeout(r, 1000));
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 5000));
        const url = page.url();
        const cookies = await page.cookies();
        return JSON.stringify({ url, cookies });
      };
    `;

    const payload = JSON.stringify({ code });

    const req = https.request(FUNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Login function: HTTP ' + res.statusCode + ' - ' + d.slice(0, 200)));
          return;
        }
        try {
          const parsed = JSON.parse(d);
          if (typeof parsed === 'string') {
            try { resolve(JSON.parse(parsed)); }
            catch(e2) { reject(new Error('Unexpected response format: ' + d.slice(0, 200))); }
          } else if (parsed.cookies) {
            resolve(parsed);
          } else {
            resolve({ cookies: Array.isArray(parsed) ? parsed : [] });
          }
        } catch(e) {
          reject(new Error('Failed to parse response: ' + d.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Step 2: Take screenshot with cookies
function takeScreenshotWithCookies(id, url, cookies, label) {
  return new Promise((resolve, reject) => {
    const body = {
      url,
      cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: SITE })),
      options: { type: 'jpeg', quality: 85, fullPage: false },
      viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
    };
    const payload = JSON.stringify(body);

    const req = https.request(SS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          reject(new Error(`${id}: HTTP ${res.statusCode} - ${buf.toString().slice(0, 100)}`));
          return;
        }
        const filepath = path.join(OUT_DIR, `${id}.jpg`);
        fs.writeFileSync(filepath, buf);
        console.log(`  ✓ ${id} (${label}) — ${buf.length} bytes`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const pages = [
    { id: 'classstream', url: 'https://school.pratyushes.dev/', label: 'Dashboard' },
    { id: 'classstream-classes', url: 'https://school.pratyushes.dev/classes', label: 'Classes' },
    { id: 'classstream-students', url: 'https://school.pratyushes.dev/students', label: 'Students' },
    { id: 'classstream-stream', url: 'https://school.pratyushes.dev/stream', label: 'Stream' },
    { id: 'classstream-settings', url: 'https://school.pratyushes.dev/settings', label: 'Settings' }
  ];

  console.log('Logging in to get cookies...');
  const loginResult = await loginAndGetCookies();
  const cookies = loginResult.cookies || [];
  console.log(`  Got ${cookies.length} cookies, URL: ${loginResult.url || 'unknown'}`);

  for (const p of pages) {
    try {
      await takeScreenshotWithCookies(p.id, p.url, cookies, p.label);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  ✗ ${p.id}: ${e.message}`);
    }
  }

  console.log('\nDone. Files in:', OUT_DIR);
}

main().catch(console.error);
