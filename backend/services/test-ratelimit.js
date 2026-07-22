const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

function test(label, code) {
  return new Promise((resolve) => {
    const p = JSON.stringify({ code });
    const t0 = Date.now();
    const r = https.request('https://chrome.browserless.io/function?token=' + API_KEY + '&timeout=15000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(label + ': HTTP ' + res.statusCode + ' in ' + (Date.now()-t0) + 'ms - ' + d.slice(0, 80));
        resolve();
      });
    });
    r.on('error', e => { console.log(label + ': error - ' + e.message); resolve(); });
    r.write(p);
    r.end();
  });
}

async function main() {
  console.log('Testing Browserless /function endpoint...');
  await test('ping', `export default async function({page}){return "ping";};`);
  await new Promise(r => setTimeout(r, 2000));
  await test('navigate', `export default async function({page}){await page.goto('https://example.com',{waitUntil:'load',timeout:10000});return await page.title();};`);
}
main();
