import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'out');
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};
async function walk(dir) { const entries = await fs.readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat(); }
const generated = path.join(out, 'generated'); await fs.mkdir(generated, { recursive: true });
let count = 0;
for (const filename of (await walk(out)).filter(f => f.endsWith('.html'))) {
  let html = await fs.readFile(filename, 'utf8');
  // Keep bootstrapping order, but serve executable scripts from same-origin files.
  // This permits a strict script-src 'self' without nonces or unsafe-inline.
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const [, attrs, source] = match;
    if (/\bsrc\s*=/.test(attrs) || !source.trim() || /type=["']application\/(ld\+)?json["']/.test(attrs)) continue;
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 24);
    await fs.writeFile(path.join(generated, `${hash}.js`), source);
    html = html.replace(match[0], `<script${attrs} src="${base}/generated/${hash}.js"></script>`); count++;
  }
  const metaCsp = headers['Content-Security-Policy'].replace("; frame-ancestors 'none'", '');
  html = html.replace(/<meta name="snyat-vibe-csp"[^>]*>/g, '');
  html = html.replace('<head>', `<head><meta name="snyat-vibe-csp" http-equiv="Content-Security-Policy" content="${metaCsp.replaceAll('"', '&quot;')}">`);
  await fs.writeFile(filename, html);
}
await fs.writeFile(path.join(root, 'security-headers.generated.json'), JSON.stringify({ basePath: base, headers }, null, 2));
await fs.writeFile(path.join(out, '_headers'), '/*\n' + Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n');
await fs.writeFile(path.join(root, 'nginx-security.conf'), Object.entries(headers).map(([k, v]) => `add_header ${k} "${v}" always;`).join('\n') + '\n');
console.log(`Security headers generated; externalized ${count} inline scripts.`);
