const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const FUNC_URL = 'https://chrome.browserless.io/chromium/function?token=' + API_KEY + '&timeout=30000';
const SS_URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

// ---- CLASSSTREAM LOGIN ----
async function loginClassStream() {
  const code = `
    export default async function({ page }) {
      await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.type('input[name="username"]', 'hellothgfbv', { delay: 30 });
      await page.type('input[name="password"]', 'Pratyush@123', { delay: 30 });
      await new Promise(r => setTimeout(r, 500));
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 4000));
      return JSON.stringify({ url: page.url(), cookies: await page.cookies() });
    };
  `;
  return callFunction(code);
}

// ---- RECALIBRATE FORUM LOGIN ----
async function loginRecalibrate() {
  const code = `
    export default async function({ page }) {
      await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      const emailInputs = await page.$$('input[type="email"], input[name="email"]');
      const passInputs = await page.$$('input[type="password"]');
      if (emailInputs.length > 0) await emailInputs[0].type('mpratyush54@gmail.com', { delay: 30 });
      if (passInputs.length > 0) await passInputs[0].type('Pratyush@151', { delay: 30 });
      await new Promise(r => setTimeout(r, 500));
      const btns = await page.$$('button[type="submit"], button');
      if (btns.length > 0) await btns[0].click();
      await new Promise(r => setTimeout(r, 4000));
      return JSON.stringify({ url: page.url(), cookies: await page.cookies() });
    };
  `;
  return callFunction(code);
}

function callFunction(code) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const req = https.request(FUNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
        resolve(JSON.parse(d));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function takeScreenshot(id, url, cookies, label) {
  return new Promise((resolve, reject) => {
    const body = {
      url,
      cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain || undefined })),
      options: { type: 'jpeg', quality: 85, fullPage: false },
      viewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 }
    };
    const payload = JSON.stringify(body);
    const req = https.request(SS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) return reject(new Error(`${id}: HTTP ${res.statusCode}`));
        const filepath = path.join(OUT_DIR, `${id}.jpg`);
        fs.writeFileSync(filepath, buf);
        console.log(`  \u2713 ${id} (${label}) \u2014 ${buf.length} bytes`);
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

  // --- ClassStream ---
  console.log('=== ClassStream ===');
  console.log('Logging in...');
  try {
    const cs = await loginClassStream();
    const cookies = cs.cookies || [];
    console.log(`  Got ${cookies.length} cookies, URL: ${cs.url}`);
    if (cookies.length > 0) {
      const pages = [
        { id: 'classstream', url: 'https://school.pratyushes.dev/', label: 'Dashboard' },
        { id: 'classstream-classes', url: 'https://school.pratyushes.dev/classes', label: 'Classes' },
        { id: 'classstream-students', url: 'https://school.pratyushes.dev/students', label: 'Students' },
        { id: 'classstream-messages', url: 'https://school.pratyushes.dev/messages', label: 'Messages' }
      ];
      for (const p of pages) {
        await takeScreenshot(p.id, p.url, cookies, p.label);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  } catch (e) {
    console.error(`  Login failed: ${e.message}`);
  }

  // --- Recalibrate Forum ---
  console.log('\n=== Recalibrate Forum ===');
  console.log('Logging in...');
  try {
    const rf = await loginRecalibrate();
    const cookies = rf.cookies || [];
    console.log(`  Got ${cookies.length} cookies, URL: ${rf.url}`);
    if (cookies.length > 0) {
      const pages = [
        { id: 'recalibrate-forum', url: 'https://recalibrating.capskengeri.com/', label: 'Forum Home' },
        { id: 'recalibrate-forum-topics', url: 'https://recalibrating.capskengeri.com/topics', label: 'Topics' }
      ];
      for (const p of pages) {
        await takeScreenshot(p.id, p.url, cookies, p.label);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  } catch (e) {
    console.error(`  Login failed: ${e.message}`);
  }

  console.log('\nDone. Files in:', OUT_DIR);
}

main().catch(console.error);
