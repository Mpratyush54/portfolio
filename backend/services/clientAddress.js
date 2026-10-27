const net = require('node:net');
// Cloudflare's published origin ranges, checked 2026-10-27. Never trust the
// visitor-IP header on requests whose ingress-verified source is outside them.
const cloudflare = new net.BlockList();
for (const range of ['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/13','104.24.0.0/14','172.64.0.0/13','131.0.72.0/22','2400:cb00::/32','2606:4700::/32','2803:f800::/32','2405:b500::/32','2405:8100::/32','2a06:98c0::/29','2c0f:f248::/32']) {
  const [ip, bits] = range.split('/');
  cloudflare.addSubnet(ip, Number(bits), net.isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}
function canonical(value) {
  if (typeof value !== 'string') return '';
  value = value.trim();
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(value)) value = value.slice(7);
  const version = net.isIP(value);
  if (version === 4) return value;
  if (version !== 6) return '';
  let normal;
  try { normal = new URL(`http://[${value}]/`).hostname.slice(1, -1); } catch { return ''; }
  const mapped = normal.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/i);
  if (mapped) {
    const a = parseInt(mapped[1], 16), b = parseInt(mapped[2], 16);
    return [a >> 8, a & 255, b >> 8, b & 255].join('.');
  }
  return normal;
}
function clientAddress(req) {
  const source = canonical(req.ip || req.socket?.remoteAddress);
  const version = net.isIP(source);
  if (version && cloudflare.check(source, version === 6 ? 'ipv6' : 'ipv4')) {
    return canonical(req.headers?.['cf-connecting-ip']) || source;
  }
  return source || 'unknown';
}
function rateAddress(value) {
  const ip = canonical(value);
  if (net.isIP(ip) !== 6) return ip || 'unknown';
  const [left, right = ''] = ip.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const groups = ip.includes('::') ? [...a, ...Array(8 - a.length - b.length).fill('0'), ...b] : a;
  return groups.slice(0, 4).map(part => parseInt(part, 16).toString(16)).join(':') + '::/64';
}
module.exports = { clientAddress, rateAddress };
