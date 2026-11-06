// Optional local static preview. No API, database, or business logic is served.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'out');
const option = key => { const index = process.argv.indexOf(key); return index >= 0 ? process.argv[index + 1] : undefined; };
const port = Number(option('--port') || process.env.PORT || 3000);
const host = option('--host') || '0.0.0.0';
let config;
try { config = JSON.parse(await fs.readFile(path.join(root, 'security-headers.generated.json'), 'utf8')); }
catch { console.error('Run npm run build first.'); process.exit(1); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  for (const [key, value] of Object.entries(config.headers)) res.setHeader(key, value);
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  try {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const prefix = config.basePath || '';
    if (prefix && !(url === prefix || url.startsWith(prefix + '/'))) { res.writeHead(404); res.end(); return; }
    url = url.slice(prefix.length) || '/';
    const filename = path.resolve(out, '.' + url);
    if (filename !== out && !filename.startsWith(out + path.sep)) { res.writeHead(403); res.end(); return; }
    let file = filename;
    try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { file = path.join(out, '404.html'); res.statusCode = 404; }
    const content = await fs.readFile(file);
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', file.includes('/_next/static/') || file.includes('/generated/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (/javascript|text\/|application\/json/.test(type) && content.length > 1024 && req.headers['accept-encoding']?.includes('gzip')) {
      const compressed = gzipSync(content); res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); res.setHeader('Content-Length', compressed.length); res.end(req.method === 'HEAD' ? undefined : compressed);
    } else { res.setHeader('Content-Length', content.length); res.end(req.method === 'HEAD' ? undefined : content); }
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`Snyat Vibe: http://localhost:${port}${config.basePath || ''}`));
