const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

function test(label, url, payload) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(`${label}: HTTP ${res.statusCode} in ${Date.now()-t0}ms | ${d.slice(0, 100)}`);
        resolve();
      });
    });
    req.on('error', e => { console.log(`${label}: error ${e.message}`); resolve(); });
    req.write(payload);
    req.end();
  });
}

async function main() {
  // Simple function - return hello
  await test('simple func', `https://chrome.browserless.io/function?token=${API_KEY}&timeout=10000`,
    JSON.stringify({ code: `export default async function({page}){return "ping";};` }));

  // Simple screenshot - google
  await test('screenshot google', `https://chrome.browserless.io/screenshot?token=${API_KEY}`,
    JSON.stringify({ url: 'https://google.com', options: { type: 'jpeg', quality: 50 } }));

  // Screenshot of classstream login page
  await test('ss classstream', `https://chrome.browserless.io/screenshot?token=${API_KEY}`,
    JSON.stringify({
      url: 'https://school.pratyushes.dev/login',
      options: { type: 'jpeg', quality: 50 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }
    }));

  // Screenshot of recalibrate forum
  await test('ss recalibrate', `https://chrome.browserless.io/screenshot?token=${API_KEY}`,
    JSON.stringify({
      url: 'https://recalibrating.capskengeri.com/',
      options: { type: 'jpeg', quality: 50 },
      gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }
    }));
}
main();
