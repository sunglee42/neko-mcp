import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest();
export function createAuthProxy(password, upstreamPort = 8932) {
  if (!password || password.length < 24) throw new Error('MCP_PASSWORD must contain at least 24 characters. Run scripts/init.ps1.');
  const expected = digest(password);
  return http.createServer((req, res) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
    if (!match || !timingSafeEqual(digest(match[1]), expected)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="neko-mcp"', 'Cache-Control': 'no-store' });
      res.end('Unauthorized');
      return;
    }
    if (req.url.split('?')[0] !== '/mcp') {
      res.writeHead(404); res.end('Not found'); return;
    }
    // Forward streaming MCP responses unchanged, including session headers.
    const headers = { ...req.headers, host: `localhost:${upstreamPort}` };
    delete headers.authorization;
    delete headers['proxy-authorization'];
    const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method, headers }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(502); res.end('MCP backend unavailable'); }
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Validate credentials before starting the private backend.
  const server = createAuthProxy(process.env.MCP_PASSWORD);
  const child = spawn(process.execPath, ['/app/cli.js', '--config', '/app/config.json', '--cdp-endpoint', 'http://127.0.0.1:9222', '--port', '8932', '--host', '127.0.0.1', '--shared-browser-context'], { stdio: 'inherit' });
  child.on('error', () => process.exit(1));
  child.on('exit', code => { server.close(); process.exit(code || 1); });
  server.on('error', () => { child.kill('SIGTERM'); process.exit(1); });
  // Container listener: Compose uses NEKO_IP to choose the HOST interface.
  // A host LAN IP does not belong to this container; do not bind it here.
  server.listen(8931, '0.0.0.0', () => console.log('Authenticated MCP listening on :8931/mcp'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(); child.kill(signal);
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
