import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
const origin='http://localhost:8000';
test('preview files require a library entry, single-use launch and active session',async t=>{
  const root=await mkdtemp(join(tmpdir(),'game-preview-'));await mkdir(join(root,'bolzoo'));
  await writeFile(join(root,'bolzoo/index.html'),`<title>NewProject</title><link rel="manifest" href="manifest.json"><script>window.gameZipURL='game.zip';if (navigator.serviceWorker) { if (!navigator.serviceWorker.controller) { navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'all' }); } }</script>`);
  await writeFile(join(root,'bolzoo/renpy.wasm'),Buffer.from([0,97,115,109,1,0,0,0]));
  const app=createApp({dbPath:':memory:',origin,contentRoot:root});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));await new Promise(r=>app.gameServer.listen(0,'127.0.0.1',r));
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${app.server.address().port}`,game=`http://127.0.0.1:${app.gameServer.address().port}`;
  async function post(path,data,cookie){return fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie||''},body:JSON.stringify(data)});}
  assert.equal((await post('/api/games/bolzoo/launch',{})).status,401);
  let r=await post('/api/auth/register',{name:'Preview',email:'preview@example.com',password:'Preview-pass-123'});const cookie=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/games/bolzoo/launch',{},cookie)).status,403);
  await post('/api/demo-orders',{gameId:'bolzoo'},cookie);
  r=await post('/api/games/bolzoo/launch',{},cookie);assert.equal(r.status,200);const url=new URL((await r.json()).url),launch=game+url.pathname+url.search;
  assert.equal((await fetch(game+'/games/bolzoo/renpy.wasm')).status,403);
  r=await fetch(launch,{redirect:'manual'});assert.equal(r.status,303);const grant=r.headers.get('set-cookie').split(';')[0];
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal((await fetch(launch,{redirect:'manual'})).status,403);
  r=await fetch(game+'/games/bolzoo/',{headers:{Cookie:grant}});const html=await r.text();assert.match(html,/<title>Болзоо/);assert.ok(!html.includes('serviceWorker.register'));assert.ok(!html.includes('rel="manifest"'));
  r=await fetch(game+'/games/bolzoo/renpy.wasm',{headers:{Cookie:grant,Range:'bytes=0-3'}});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Type'),'application/wasm');assert.equal((await r.arrayBuffer()).byteLength,4);
  assert.equal((await fetch(game+'/games/bolzoo/renpy.wasm',{headers:{Cookie:grant,Range:'bytes=99-100'}})).status,416);
  assert.equal((await fetch(game+'/games/bolzoo/%2E%2E%2Fpackage.json',{headers:{Cookie:grant}})).status,404);
  assert.equal((await fetch(game+'/games/bolzoo/service-worker.js',{headers:{Cookie:grant}})).status,404);
  await writeFile(join(root,'secret.txt'),'secret');
  try {
    await symlink(join(root,'secret.txt'),join(root,'bolzoo/link.txt'));
    assert.equal((await fetch(game+'/games/bolzoo/link.txt',{headers:{Cookie:grant}})).status,404);
  } catch(e) { if(e.code!=='EPERM')throw e;t.diagnostic('Symlink assertion skipped: Windows does not allow symlink creation.'); }
  await post('/api/auth/logout',{},cookie);
  assert.equal((await fetch(game+'/games/bolzoo/renpy.wasm',{headers:{Cookie:grant}})).status,403);
});
test('missing game and production have no launch capability',async t=>{
  const app=createApp({dbPath:':memory:',origin,contentRoot:'/missing-content'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  const base=`http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await (await fetch(base+'/api/games')).json()).games.find(g=>g.id==='bolzoo').playable,false);
});
