import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

const origin='https://story.example.com',gameOrigin='https://games.example.com';

test('production preview is opt-in, admin-only, survives persistent restart and revokes access',async t=>{
  const root=await mkdtemp(join(tmpdir(),'storyplay-production-'));
  const contentRoot=join(root,'game-content');
  await mkdir(join(contentRoot,'bolzoo'),{recursive:true});
  await writeFile(join(contentRoot,'bolzoo/index.html'),'<title>Test</title>persistent build');
  const options={production:true,origin,gameOrigin,dbPath:join(root,'data/storyplay.sqlite'),contentRoot};
  let app,base,player;
  t.after(async()=>{if(app)await app.close();await rm(root,{recursive:true,force:true});});
  async function boot(adminPreview){
    app=createApp({...options,adminPreview});
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
    await new Promise(r=>app.gameServer.listen(0,'127.0.0.1',r));
    base=`http://127.0.0.1:${app.server.address().port}`;
    player=`http://127.0.0.1:${app.gameServer.address().port}`;
  }
  async function request(path,{cookie,data}={}){
    const r=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie||''},body:data===undefined?undefined:JSON.stringify(data)});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
  }
  const signup=label=>request('/api/auth/register',{data:{name:label,email:`${label}@example.com`,password:'Strong-password-123'}});
  await boot(false);
  assert.deepEqual((await request('/api/health')).body,{ok:true});
  const owner=await signup('owner'),customer=await signup('customer');
  assert.match(owner.headers.get('set-cookie'),/^__Host-storyplay_session=.*; Secure$/);
  app.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(owner.body.user.id);
  // Old local demo orders must not turn into production entitlements.
  app.db.prepare('INSERT INTO demo_orders VALUES(?,?,?,?,?)').run('old-demo',customer.body.user.id,'bolzoo',1,Date.now());
  assert.equal((await request('/api/games/bolzoo/launch',{cookie:owner.cookie,data:{}})).status,403);
  await app.close();app=null;
  await boot(true);
  assert.equal((await request('/api/me',{cookie:owner.cookie})).body.user.role,'admin');
  assert.equal((await request('/api/admin/summary',{cookie:owner.cookie})).body.previewEnabled,true);
  assert.equal((await request('/api/demo-orders',{cookie:owner.cookie,data:{gameId:'bolzoo'}})).status,403);
  assert.equal((await request('/api/games/bolzoo/launch',{cookie:customer.cookie,data:{}})).status,403);
  assert.equal((await request('/api/games')).body.games.find(g=>g.id==='bolzoo').playable,false);
  assert.equal((await request('/api/games',{cookie:owner.cookie})).body.games.find(g=>g.id==='bolzoo').playable,true);
  assert.equal((await fetch(player+'/games/bolzoo/')).status,403);
  const launch=await request('/api/games/bolzoo/launch',{cookie:owner.cookie,data:{}});
  assert.equal(launch.status,200);
  const url=new URL(launch.body.url);
  assert.equal(url.origin,gameOrigin);
  const landed=await fetch(player+url.pathname+url.search,{redirect:'manual'});
  assert.equal(landed.status,303);
  assert.match(landed.headers.get('set-cookie'),/; Secure$/);
  const grant=landed.headers.get('set-cookie').split(';')[0];
  const play=()=>fetch(player+'/games/bolzoo/',{headers:{Cookie:grant}});
  assert.match(await (await play()).text(),/persistent build/);
  app.db.prepare("UPDATE users SET role='user' WHERE id=?").run(owner.body.user.id);
  assert.equal((await play()).status,403);
  app.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(owner.body.user.id);
  assert.equal((await play()).status,200);
  await request('/api/auth/logout',{cookie:owner.cookie,data:{}});
  assert.equal((await play()).status,403);
  assert.equal((await request('/api/games/bolzoo/launch',{cookie:owner.cookie,data:{}})).status,401);
});

test('proxy rate limits distinguish clients only with explicit loopback trust',async t=>{
  for(const trusted of [false,true]){
    await t.test(String(trusted),async()=>{
      const app=createApp({dbPath:':memory:',origin,production:true,trustProxyLoopback:trusted});
      await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
      const base=`http://127.0.0.1:${app.server.address().port}`;
      const attempt=ip=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Real-IP':ip},body:'{}'});
      try{
        for(let i=0;i<20;i++)assert.equal((await attempt('192.0.2.10')).status,400);
        assert.equal((await attempt('192.0.2.10')).status,429);
        assert.equal((await attempt('192.0.2.11')).status,trusted?400:429);
        if(trusted){
          for(let i=0;i<20;i++)assert.equal((await attempt('invalid-'+i)).status,400);
          assert.equal((await attempt('another-invalid')).status,429);
        }
      }finally{await app.close();}
    });
  }
});

test('production preview rejects insecure or same-host game origins',()=>{
  for(const gameOrigin of ['http://games.example.com','https://story.example.com:8443']){
    assert.throws(()=>createApp({dbPath:':memory:',production:true,origin,gameOrigin,adminPreview:true}),/separate HTTPS/);
  }
});
