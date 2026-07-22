const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const FUNC_URL = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=30000';
const SS_URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'screenshots');

// Login to ClassStream and take all screenshots in one session
async function captureClassStream() {
  const code = `
    export default async function({ page }) {
      const results = [];

      // Step 1: Login
      await page.goto('https://school.pratyushes.dev/login', { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));
      await page.type('input[name="username"]', 'hellothgfbv', { delay: 20 });
      await page.type('input[name="password"]', 'Pratyush@123', { delay: 20 });
      await new Promise(r => setTimeout(r, 500));
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 4000));

      const pages = [
        '/',
        '/classes',
        '/students',
        '/messages',
        '/settings'
      ];

      for (const p of pages) {
        try {
          await page.goto('https://school.pratyushes.dev' + p, { waitUntil: 'networkidle0', timeout: 15000 });
          await new Promise(r => setTimeout(r, 2000));
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          const slug = p.split('/').filter(Boolean).join('-');
          const name = 'classstream' + (slug ? '-' + slug : '');
          results.push({ name, data: Array.from(ss) });
        } catch(e) {
          const slug = p.split('/').filter(Boolean).join('-');
          const name = 'classstream' + (slug ? '-' + slug : '');
          results.push({ name, error: e.message });
        }
      }

      return JSON.stringify(results);
    };
  `;

  return callFunction(code);
}

// Login to Recalibrate Forum and take screenshots
async function captureRecalibrate() {
  const code = `
    export default async function({ page }) {
      const results = [];

      await page.goto('https://recalibrating.capskengeri.com/login', { waitUntil: 'networkidle0', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));

      // Try filling the form
      const emailInputs = await page.$$('input[type="email"], input[name="email"]');
      const passInputs = await page.$$('input[type="password"]');
      if (emailInputs.length > 0) await emailInputs[0].type('mpratyush54@gmail.com', { delay: 20 });
      if (passInputs.length > 0) await passInputs[0].type('Pratyush@151', { delay: 20 });
      await new Promise(r => setTimeout(r, 500));

      const btns = await page.$$('button[type="submit"], button');
      if (btns.length > 0) await btns[0].click();
      await new Promise(r => setTimeout(r, 4000));

      const pages = ['/', '/topics'];
      for (const p of pages) {
        try {
          await page.goto('https://recalibrating.capskengeri.com' + p, { waitUntil: 'networkidle0', timeout: 15000 });
          await new Promise(r => setTimeout(r, 2000));
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          const slug2 = p.split('/').filter(Boolean).join('-');
          const name = 'recalibrate-forum' + (slug2 ? '-' + slug2 : '');
          results.push({ name, data: Array.from(ss) });
        } catch(e) {
          const slug2 = p.split('/').filter(Boolean).join('-');
          const name = 'recalibrate-forum' + (slug2 ? '-' + slug2 : '');
          results.push({ name, error: e.message });
        }
      }

      return JSON.stringify(results);
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
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ': ' + d.slice(0, 200)));
        }
        resolve(JSON.parse(d));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('=== ClassStream Screenshots ===');
  try {
    const results = await captureClassStream();
    for (const r of results) {
      if (r.error) {
        console.log(`  \u2717 ${r.name}: ${r.error}`);
      } else {
        fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
        console.log(`  \u2713 ${r.name} \u2014 ${r.data.length} bytes`);
      }
    }
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  console.log('\n=== Recalibrate Forum Screenshots ===');
  try {
    const results = await captureRecalibrate();
    for (const r of results) {
      if (r.error) {
        console.log(`  \u2717 ${r.name}: ${r.error}`);
      } else {
        fs.writeFileSync(path.join(OUT_DIR, r.name + '.jpg'), Buffer.from(r.data));
        console.log(`  \u2713 ${r.name} \u2014 ${r.data.length} bytes`);
      }
    }
  } catch (e) {
    console.error('  Failed:', e.message);
  }

  console.log('\nDone. All files in:', OUT_DIR);
}

main().catch(console.error);
