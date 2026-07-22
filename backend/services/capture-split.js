const https = require('https');
const fs = require('fs');
const path = require('path');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const EP = 'https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=55000';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function runFn(code) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ code });
    const t0 = Date.now();
    const req = https.request(EP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('  done in ' + (Date.now()-t0) + 'ms, HTTP ' + res.statusCode);
        if (res.statusCode !== 200) return reject(new Error(d.slice(0, 200)));
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error('Parse: ' + d.slice(0, 100))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function save(r) {
  if (r.error) console.log('  \u2717 ' + r.n + ': ' + r.error);
  else {
    fs.writeFileSync(path.join(OUT_DIR, r.n + '.jpg'), Buffer.from(r.d));
    console.log('  \u2713 ' + r.n + '.jpg \u2014 ' + r.d.length + ' bytes');
  }
}

// Login script template
function loginScript(loginUrl, fields, submitSel) {
  const { usernameSel, usernameVal, passwordSel, passwordVal } = fields;
  return `
    await page.goto('${loginUrl}', { waitUntil: 'load', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    await page.evaluate(() => {
      document.querySelector('${usernameSel}').value = '${usernameVal}';
      document.querySelector('${usernameSel}').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('${passwordSel}').value = '${passwordVal}';
      document.querySelector('${passwordSel}').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { document.querySelector('${submitSel}').click(); });
    await new Promise(r => setTimeout(r, 5000));
  `;
}

async function main() {
  // === CLASSSTREAM ===
  const csLogin = loginScript(
    'https://school.pratyushes.dev/login',
    { usernameSel: 'input[name="username"]', usernameVal: 'hellothgfbv',
      passwordSel: 'input[name="password"]', passwordVal: 'Pratyush@123' },
    'button[type="submit"]'
  );

  // Batch 1: Dashboard + Classes
  console.log('=== ClassStream Batch 1 (dashboard, classes) ===');
  try {
    const r = await runFn(`export default async function({ page }) {
      const results = [];
      ${csLogin}
      const pages = ['/', '/classes'];
      for (const p of pages) {
        try {
          if (p !== '/') { await page.goto('https://school.pratyushes.dev' + p, { waitUntil: 'load', timeout: 15000 }); await new Promise(r => setTimeout(r, 3000)); }
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          results.push({ n: p === '/' ? 'classstream' : 'classstream-' + p.substring(1), d: Array.from(ss) });
        } catch(e) { results.push({ n: p === '/' ? 'classstream' : 'classstream-' + p.substring(1), error: e.message }); }
      }
      return JSON.stringify(results);
    };`);
    r.forEach(save);
  } catch(e) { console.log('  Failed:', e.message); }

  await new Promise(r => setTimeout(r, 2000));

  // Batch 2: Students + Messages
  console.log('\n=== ClassStream Batch 2 (students, messages) ===');
  try {
    const r = await runFn(`export default async function({ page }) {
      const results = [];
      ${csLogin}
      for (const p of ['/students', '/messages']) {
        try {
          await page.goto('https://school.pratyushes.dev' + p, { waitUntil: 'load', timeout: 15000 });
          await new Promise(r => setTimeout(r, 3000));
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          results.push({ n: 'classstream-' + p.substring(1), d: Array.from(ss) });
        } catch(e) { results.push({ n: 'classstream-' + p.substring(1), error: e.message }); }
      }
      return JSON.stringify(results);
    };`);
    r.forEach(save);
  } catch(e) { console.log('  Failed:', e.message); }

  await new Promise(r => setTimeout(r, 2000));

  // Batch 3: Settings
  console.log('\n=== ClassStream Batch 3 (settings) ===');
  try {
    const r = await runFn(`export default async function({ page }) {
      const results = [];
      ${csLogin}
      try {
        await page.goto('https://school.pratyushes.dev/settings', { waitUntil: 'load', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));
        const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
        results.push({ n: 'classstream-settings', d: Array.from(ss) });
      } catch(e) { results.push({ n: 'classstream-settings', error: e.message }); }
      return JSON.stringify(results);
    };`);
    r.forEach(save);
  } catch(e) { console.log('  Failed:', e.message); }

  await new Promise(r => setTimeout(r, 2000));

  // === RECALIBRATE FORUM ===
  const rfLogin = loginScript(
    'https://recalibrating.capskengeri.com/login',
    { usernameSel: 'input[name="email"]', usernameVal: 'mpratyush54@gmail.com',
      passwordSel: 'input[type="password"]', passwordVal: 'Pratyush@151' },
    'button[type="submit"]'
  );

  console.log('\n=== Recalibrate Forum (home, topics) ===');
  try {
    const r = await runFn(`export default async function({ page }) {
      const results = [];
      ${rfLogin}
      for (const p of ['/', '/topics']) {
        try {
          if (p !== '/') { await page.goto('https://recalibrating.capskengeri.com' + p, { waitUntil: 'load', timeout: 15000 }); await new Promise(r => setTimeout(r, 3000)); }
          const ss = await page.screenshot({ type: 'jpeg', quality: 85 });
          results.push({ n: p === '/' ? 'recalibrate-forum' : 'recalibrate-forum-' + p.substring(1), d: Array.from(ss) });
        } catch(e) { results.push({ n: p === '/' ? 'recalibrate-forum' : 'recalibrate-forum-' + p.substring(1), error: e.message }); }
      }
      return JSON.stringify(results);
    };`);
    r.forEach(save);
  } catch(e) { console.log('  Failed:', e.message); }

  console.log('\nDone. Files in:', OUT_DIR);
}
main().catch(console.error);
