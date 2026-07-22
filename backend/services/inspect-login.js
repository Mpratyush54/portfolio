const https = require('https');
const API_KEY = '2Uqha7ljDv4TQyLfac560ff6c68f799957f3db116c9a47e70';

// Use /content endpoint to get the page HTML
const payload = JSON.stringify({
  url: 'https://school.pratyushes.dev/login',
  options: { type: 'jpeg', quality: 50 },
  gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 }
});

const req = https.request('https://chrome.browserless.io/content?token=' + API_KEY, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    // Find form/input elements
    const matches = d.match(/(<form|<input|<button|<label)[^>]*>/gi) || [];
    console.log('\nForm/input tags found:');
    matches.forEach(m => console.log('  ' + m));
    // Find any text that looks like login/username/password
    const textMatches = d.match(/username|password|email|login|signin|submit|placeholder/gi) || [];
    console.log('\nKeywords:', [...new Set(textMatches)]);
    console.log('\n--- Page title ---');
    const title = d.match(/<title>([^<]+)<\/title>/i);
    console.log(title ? title[1] : 'none');
  });
});
req.on('error', e => console.log('Error:', e.message));
req.write(payload);
req.end();
