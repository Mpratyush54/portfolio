"""Run on the Kubernetes host: python3 configure-api-proxy.py.

Keep the API's trusted proxy chain to one hop. Never append caller-provided XFF.
Re-run if backend-service is deleted and recreated with a different ClusterIP.
"""
import ipaddress
import pathlib
import re
import subprocess

path = pathlib.Path('/etc/nginx/sites-enabled/pratyushes.dev.conf').resolve()
original = path.read_text()
address = subprocess.check_output([
    'kubectl', 'get', 'svc', 'backend-service', '-n', 'portfolio',
    '-o', 'jsonpath={.spec.clusterIP}',
], text=True).strip()
ip = ipaddress.ip_address(address)
target = f'[{ip}]' if ip.version == 6 else str(ip)
match = re.search(r'location /api/ \{[^{}]*\}', original)
if not match:
    raise SystemExit('Expected exactly one API location; no changes applied.')
block = match.group()
block, passes = re.subn(r'proxy_pass\s+[^;]+;', f'proxy_pass http://{target}:5000;', block)
block, headers = re.subn(r'proxy_set_header X-Forwarded-For\s+[^;]+;',
                         'proxy_set_header X-Forwarded-For $remote_addr;', block)
if passes != 1 or headers != 1 or len(re.findall(r'location /api/ \{', original)) != 1:
    raise SystemExit('Unexpected API proxy configuration; no changes applied.')
updated = original[:match.start()] + block + original[match.end():]
if updated == original:
    print('API proxy already configured.')
else:
    backup = path.with_name(path.name + '.before-api-address-fix')
    if not backup.exists():
        backup.write_text(original)
        backup.chmod(0o600)
    path.write_text(updated)
    try:
        subprocess.run(['nginx', '-t'], check=True, capture_output=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        path.write_text(original)
        subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True)
        raise SystemExit('Proxy validation/reload failed; previous configuration restored.')
    print('API proxy configured, validated and reloaded.')
