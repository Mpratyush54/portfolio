const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';
const URL = 'https://chrome.browserless.io/screenshot?token=' + API_KEY;

const payload = JSON.stringify({
  url: 'https://competency-mapping.vercel.app',
  options: {
    type: 'jpeg',
    quality: 85,
    fullPage: false
  },
  viewport: {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1
  },
  gotoOptions: {
    waitUntil: 'networkidle2',
    timeout: 15000
  }
});

const req = https.request(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log('Size:', buf.length, 'bytes');
    const ext = res.headers['content-type'] === 'image/png' ? 'png' : 'jpg';
    const filepath = path.join(__dirname, '..', 'test-shot.' + ext);
    fs.writeFileSync(filepath, buf);
    console.log('Saved to', filepath);
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
