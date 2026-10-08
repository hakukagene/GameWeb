import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
const origin='http://localhost:8000';
async function boot(options={}) { const app=createApp({origin, ...options});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app, url:`http://127.0.0.1:${app.server.address().port}`}; }
async function request(app,path,{data,cookie,headers={}}={}){
  const r=await fetch(app.url+path,{method:data!==undefined?'POST':'GET',headers:{...(data!==undefined?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
const identity=(n)=>({name:'User '+n,email:`user${n}@example.com`,password:'Strong-password-123'});
test('registration, isolation, idempotency, logout and durable restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'storyplay-'));
  let app=await boot({dbPath:join(dir,'test.sqlite')});
  t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
  assert.equal((await request(app,'/api/library')).status,401);
  assert.equal((await request(app,'/api/auth/register',{data:{...identity('a'),password:'short'}})).status,400);
  const a=await request(app,'/api/auth/register',{data:identity('a')});assert.equal(a.status,201);assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.equal(a.body.user.password_hash,undefined);
  const stored=app.db.prepare('SELECT password_hash,salt FROM users').get();assert.notEqual(stored.password_hash,identity('a').password);assert.equal(stored.salt.length,32);
  assert.equal((await request(app,'/api/auth/register',{data:identity('a')})).status,409);
  assert.equal((await request(app,'/api/auth/login',{data:{...identity('a'),password:'Wrong-password-123'}})).status,401);
  assert.equal((await request(app,'/api/auth/register',{data:identity('x'),headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request(app,'/api/demo-orders',{data:{gameId:'last-train'}})).status,401);
  assert.equal((await request(app,'/api/demo-orders',{cookie:a.cookie,data:{gameId:'missing'}})).status,404);
  assert.equal((await request(app,'/api/demo-orders',{cookie:a.cookie,data:{gameId:'last-train',amount:1,userId:'someone'}})).status,400);
  const purchase=await request(app,'/api/demo-orders',{cookie:a.cookie,data:{gameId:'last-train'}});assert.equal(purchase.status,201);assert.equal(purchase.body.order.amount,19900);assert.equal(purchase.body.order.status,'simulated');
  const repeat=await request(app,'/api/demo-orders',{cookie:a.cookie,data:{gameId:'last-train'}});assert.equal(repeat.status,200);assert.equal(repeat.body.order.id,purchase.body.order.id);
  const b=await request(app,'/api/auth/register',{data:identity('b')});assert.equal(b.status,201);
  assert.deepEqual((await request(app,'/api/library',{cookie:b.cookie})).body,{demoGameIds:[],paidGameIds:[]});
  assert.equal((await request(app,'/api/orders',{cookie:b.cookie})).body.orders.length,0);
  assert.equal((await request(app,'/api/auth/logout',{cookie:a.cookie,data:{}})).status,200);
  assert.equal((await request(app,'/api/library',{cookie:a.cookie})).status,401);
  const again=await request(app,'/api/auth/login',{data:identity('a')});assert.equal(again.status,200);assert.notEqual(again.cookie,a.cookie);
  await app.close();app=await boot({dbPath:join(dir,'test.sqlite')});
  assert.deepEqual((await request(app,'/api/library',{cookie:again.cookie})).body,{demoGameIds:['last-train'],paidGameIds:[]});
  assert.equal((await request(app,'/api/orders',{cookie:again.cookie})).body.orders.length,1);
  app.db.prepare('UPDATE sessions SET expires_at=0').run();
  assert.equal((await request(app,'/api/library',{cookie:again.cookie})).status,401);
});
test('static server boundary, input validation, demo off and rate limits',async t=>{
  const app=await boot({dbPath:':memory:',demo:false});t.after(()=>app.close());
  assert.equal((await fetch(app.url+'/')).status,200);
  assert.equal((await fetch(app.url+'/server/app.mjs')).status,404);
  assert.equal((await fetch(app.url+'/data/storyplay.sqlite')).status,404);
  const malformed=await fetch(app.url+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{bad'});assert.equal(malformed.status,400);
  assert.equal((await fetch(app.url+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:'x'})).status,415);
  const large=await fetch(app.url+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({x:'x'.repeat(9000)})});assert.equal(large.status,413);
  const a=await request(app,'/api/auth/register',{data:identity('c')});assert.equal(a.status,201);
  assert.equal((await request(app,'/api/demo-orders',{cookie:a.cookie,data:{gameId:'neon'}})).status,403);
  let response;for(let i=0;i<21;i++)response=await request(app,'/api/auth/login',{data:{email:'bad',password:'x'}});assert.equal(response.status,429);
});
test('production rejects unsafe config and uses Secure session cookies',async t=>{
  assert.throws(()=>createApp({production:true,dbPath:':memory:'}),/HTTPS/);
  assert.throws(()=>createApp({production:true,origin:'https://example.com',demo:true,dbPath:':memory:'}),/Demo/);
  const app=await boot({production:true,origin:'https://example.com',dbPath:':memory:'});t.after(()=>app.close());
  const a=await request(app,'/api/auth/register',{data:identity('prod'),headers:{Origin:'https://example.com'}});
  assert.equal(a.status,201);assert.match(a.headers.get('set-cookie'),/^__Host-storyplay_session=.*; Secure$/);
  assert.equal((await request(app,'/api/me')).body.demoEnabled,false);
});
