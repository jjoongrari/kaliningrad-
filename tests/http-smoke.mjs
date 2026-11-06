import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname, '..');
const config=JSON.parse(await fs.readFile(root+'/security-headers.generated.json','utf8'));
const server=spawn(process.execPath,[root+'/scripts/serve.mjs','--port','4826'],{cwd:root,stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',()=>reject(new Error('Server failed')));});
try {
  const base='http://127.0.0.1:4826'+config.basePath;
  const response=await fetch(base+'/'); assert.equal(response.status,200);
  for(const [key,value] of Object.entries(config.headers)) assert.equal(response.headers.get(key),value);
  const html=await response.text();
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  for(const [,attrs,body] of scripts) assert.ok(!body.trim()||attrs.includes('application/json')||attrs.includes('application/ld+json'),'Executable inline script remains');
  const paths=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(s=>s.startsWith('/'));
  assert.ok(paths.every(p=>!config.basePath||p.startsWith(config.basePath+'/')));
  for(const p of new Set(paths)) { const r=await fetch('http://127.0.0.1:4826'+p); assert.equal(r.status,200,p); }
  const data=await (await fetch(base+'/data/listings.json')).json();
  for(const x of data) for(const photo of x.images) { const r=await fetch(base+photo,{method:'HEAD'}); assert.equal(r.status,200,photo); }
  assert.equal((await fetch(base+'/not-a-route/')).status,404);
  console.log(`HTTP smoke passed: ${config.basePath||'/'}; all 5 headers; ${data.length} listings and every photo; no executable inline scripts.`);
} finally {server.kill();}
