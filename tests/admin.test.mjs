import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.mjs';
import { openDatabase } from '../server/database.mjs';
const origin='http://localhost:8000';
const required=['index.html','renpy.js','renpy-pre.js','renpy.wasm','renpy.data','game.zip'];
// Stored ZIP records use independently known CRC32 values for one-byte fixtures.
function zip(names=required,payload='x'){
  const crc=payload==='x'?0x8cdc1683:0xfbdb2615,locals=[],central=[];let offset=0;
  for(const name of names){const n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46);h.writeUInt32LE(0x04034b50);h.writeUInt32LE(crc,14);h.writeUInt32LE(1,18);h.writeUInt32LE(1,22);h.writeUInt16LE(n.length,26);const part=Buffer.concat([h,n,Buffer.from(payload)]);locals.push(part);c.writeUInt32LE(0x02014b50);c.writeUInt32LE(crc,16);c.writeUInt32LE(1,20);c.writeUInt32LE(1,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=part.length;}
  const ct=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(ct.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,ct,end]);
}
const metadata={id:'another-game',title:'Шинэ түүх',en:'NEW STORY',genre:'Романтик',desc:'Бүтэн тоглоомын тайлбар.',price:12500,version:'1.0',published:false};
async function boot(t){
  const root=await mkdtemp(join(tmpdir(),'game-admin-')),dbPath=join(root,'test.sqlite');
  const app=createApp({dbPath,origin,contentRoot:root});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));await new Promise(r=>app.gameServer.listen(0,'127.0.0.1',r));
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${app.server.address().port}`,player=`http://127.0.0.1:${app.gameServer.address().port}`;
  async function request(path,{data,raw,type,cookie,headers={}}={}){
    const post=data!==undefined||raw!==undefined;
    const r=await fetch(base+path,{method:post?'POST':'GET',headers:{...(post?{Origin:origin,'Content-Type':type||'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:raw??(data!==undefined?JSON.stringify(data):undefined)});
    const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=text;}
    return {status:r.status,body,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
  }
  const a=await request('/api/auth/register',{data:{name:'Owner',email:'owner@example.com',password:'Owner-pass-123',role:'admin'}});
  const b=await request('/api/auth/register',{data:{name:'Customer',email:'customer@example.com',password:'Customer-pass-123'}});
  return {app,root,dbPath,base,player,request,owner:a.cookie,customer:b.cookie,ownerId:a.body.user.id};
}

test('admin requires server-granted role; users and orders expose paginated non-secret data',async t=>{
  const x=await boot(t),{app,request,owner,customer}=x;
  assert.equal((await request('/api/me',{cookie:owner})).body.user.role,'user');
  for(const path of ['/api/admin/summary','/api/admin/users','/api/admin/orders','/api/admin/games','/api/admin/games/bolzoo/builds']){
    assert.equal((await request(path)).status,401);assert.equal((await request(path,{cookie:customer})).status,403);
  }
  assert.equal((await request('/api/admin/games',{cookie:customer,data:metadata})).status,403);
  assert.equal((await request('/api/admin/games/bolzoo/cover',{cookie:customer,raw:Buffer.from('x'),type:'image/png'})).status,403);
  assert.equal((await request('/api/admin/games/bolzoo/builds?version=1.0',{cookie:customer,raw:zip(),type:'application/zip'})).status,403);
  const cli=spawnSync(process.execPath,['scripts/admin-user.mjs','owner@example.com'],{cwd:new URL('..',import.meta.url),env:{...process.env,DB_PATH:x.dbPath},encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);
  assert.equal((await request('/api/me',{cookie:owner})).body.user.role,'admin');
  assert.equal((await request('/api/admin/games',{cookie:owner,data:metadata,headers:{Origin:'https://evil.example'}})).status,403);
  await request('/api/demo-orders',{cookie:customer,data:{gameId:'bolzoo'}});
  const users=await request('/api/admin/users?q=customer',{cookie:owner});assert.equal(users.status,200);assert.equal(users.body.total,1);assert.equal(users.body.users[0].orderCount,1);
  for(const key of ['password_hash','salt','token_hash'])assert.ok(!JSON.stringify(users.body).includes(key));
  const orders=await request('/api/admin/orders?gameId=bolzoo',{cookie:owner});assert.equal(orders.body.total,1);assert.equal(orders.body.orders[0].status,'simulated');
  assert.equal((await request('/api/admin/orders?q=%25',{cookie:owner})).body.total,0);
  assert.equal((await request('/api/admin/users?page=0',{cookie:owner})).status,400);
  const insert=app.db.prepare('INSERT INTO users(id,email,name,password_hash,salt,created_at) VALUES(?,?,?,?,?,?)');
  for(let i=0;i<30;i++)insert.run('extra'+i,`extra${i}@example.com`,'Extra user','unused','unused',i);
  const page2=(await request('/api/admin/users?page=2',{cookie:owner})).body;assert.equal(page2.total,32);assert.equal(page2.users.length,7);
  app.db.prepare("UPDATE users SET role='user' WHERE id=?").run(x.ownerId);
  assert.equal((await request('/api/admin/users',{cookie:owner})).status,403);
});

test('game metadata validation, draft visibility, cover upload and price changes persist',async t=>{
  const {app,request,owner,customer,root,dbPath,ownerId}=await boot(t);app.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(ownerId);
  for(const invalid of [{...metadata,id:'../oops'},{...metadata,price:-1},{...metadata,price:1.1},{...metadata,active_build:'secret'},{...metadata,published:'true'}])assert.equal((await request('/api/admin/games',{cookie:owner,data:invalid})).status,400);
  const created=await request('/api/admin/games',{cookie:owner,data:metadata});assert.equal(created.status,201);let game=created.body.game;
  assert.equal((await request('/api/admin/games',{cookie:owner,data:metadata})).status,409);
  assert.ok(!(await request('/api/games')).body.games.some(g=>g.id===game.id));
  assert.equal((await request('/api/demo-orders',{cookie:customer,data:{gameId:game.id}})).status,404);
  const {id,...update}=metadata;
  let r=await request('/api/admin/games/'+id,{cookie:owner,data:{...update,published:true,price:22000,revision:game.revision}});assert.equal(r.status,200);game=r.body.game;
  assert.equal((await request('/api/admin/games/'+id,{cookie:owner,data:{...update,revision:1}})).status,409);
  assert.equal((await request('/api/demo-orders',{cookie:customer,data:{gameId:id}})).body.order.amount,22000);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
  assert.equal((await request(`/api/admin/games/${id}/cover`,{cookie:owner,raw:Buffer.from('<svg/>'),type:'image/svg+xml'})).status,415);
  assert.equal((await request(`/api/admin/games/${id}/cover`,{cookie:owner,raw:Buffer.from('<script>bad</script>'),type:'image/png'})).status,400);
  assert.equal((await request(`/api/admin/games/${id}/cover`,{cookie:owner,raw:Buffer.alloc(5*1024*1024+1),type:'image/png'})).status,413);
  r=await request(`/api/admin/games/${id}/cover`,{cookie:owner,raw:png,type:'image/png'});assert.equal(r.status,200);game=r.body.game;
  const cover=await request(game.image);assert.equal(cover.status,200);assert.equal(cover.headers.get('content-type'),'image/png');
  assert.equal((await readdir(join(root,'.uploads'))).length,0);
  await request('/api/admin/games/'+id,{cookie:owner,data:{...update,published:false,price:33000,revision:game.revision}});
  assert.ok(!(await request('/api/games')).body.games.some(g=>g.id===id));
  assert.ok((await request('/api/games',{cookie:customer})).body.games.some(g=>g.id===id));
  assert.equal((await request('/api/orders',{cookie:customer})).body.orders[0].amount,22000);
  const db=openDatabase(dbPath);try{const saved=db.prepare('SELECT * FROM games WHERE id=?').get(id);assert.equal(saved.price,33000);assert.equal(saved.published,0);assert.ok(saved.cover_file);}finally{db.close();}
});

test('build uploads activate complete versions, preserve failed-update state and pin running games',async t=>{
  const {app,request,owner,customer,ownerId,root,player}=await boot(t);app.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(ownerId);
  await request('/api/admin/games',{cookie:owner,data:{...metadata,published:true}});
  const id=metadata.id;
  let r=await request(`/api/admin/games/${id}/builds?version=1.0`,{cookie:owner,raw:zip(),type:'application/zip'});assert.equal(r.status,201,JSON.stringify(r.body));const first=r.body.build.id;
  assert.equal((await request('/api/games')).body.games.find(g=>g.id===id).playable,true);
  assert.equal((await request(`/api/games/${id}/launch`,{cookie:customer,data:{}})).status,403);
  await request('/api/demo-orders',{cookie:customer,data:{gameId:id}});
  async function launch(){const ticket=(await request(`/api/games/${id}/launch`,{cookie:customer,data:{}})).body.url;const url=new URL(ticket);const result=await fetch(player+url.pathname+url.search,{redirect:'manual'});assert.equal(result.status,303);return result.headers.get('set-cookie').split(';')[0];}
  const oldGrant=await launch();assert.equal(await (await fetch(player+`/games/${id}/renpy.js`,{headers:{Cookie:oldGrant}})).text(),'x');
  r=await request(`/api/admin/games/${id}/builds?version=bad`,{cookie:owner,raw:Buffer.from('not a zip'),type:'application/zip'});assert.equal(r.status,422);
  r=await request(`/api/admin/games/${id}/builds?version=bad`,{cookie:owner,raw:zip([...required,'../escape']),type:'application/zip'});assert.equal(r.status,422);
  assert.equal((await request(`/api/admin/games/${id}/builds`,{cookie:owner})).body.activeBuild,first);
  r=await request(`/api/admin/games/${id}/builds?version=2.0`,{cookie:owner,raw:zip(required,'y'),type:'application/zip'});assert.equal(r.status,201,JSON.stringify(r.body));
  const history=(await request(`/api/admin/games/${id}/builds`,{cookie:owner})).body;assert.equal(history.builds.length,2);assert.notEqual(history.activeBuild,first);
  assert.equal(await (await fetch(player+`/games/${id}/renpy.js`,{headers:{Cookie:oldGrant}})).text(),'x');
  const newGrant=await launch();assert.equal(await (await fetch(player+`/games/${id}/renpy.js`,{headers:{Cookie:newGrant}})).text(),'y');
  assert.equal((await fetch(player+'/games/bolzoo/renpy.js',{headers:{Cookie:newGrant}})).status,404);
  assert.equal((await readdir(join(root,'.uploads'))).length,0);
  assert.equal((await readdir(join(root,'releases',id))).length,2);
  await request('/api/auth/logout',{cookie:customer,data:{}});
  assert.equal((await fetch(player+`/games/${id}/renpy.js`,{headers:{Cookie:newGrant}})).status,403);
});

test('v1 database migration preserves accounts, sessions, orders and game prices',async t=>{
  const root=await mkdtemp(join(tmpdir(),'admin-migration-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'old.sqlite');
  let db=new DatabaseSync(path);
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE games(id TEXT PRIMARY KEY,price INTEGER NOT NULL);
    CREATE TABLE demo_orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),game_id TEXT NOT NULL REFERENCES games(id),amount INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,game_id));
    INSERT INTO users VALUES('u','old@example.com','Old','hash','salt',1);INSERT INTO sessions VALUES('token','u',9999999999999);
    INSERT INTO games VALUES('bolzoo',7300);INSERT INTO demo_orders VALUES('o','u','bolzoo',7300,1);PRAGMA user_version=1;`);db.close();
  db=openDatabase(path);try{assert.equal(db.prepare('SELECT count(*) AS n FROM demo_orders').get().n,1);assert.equal(db.prepare('SELECT role FROM users').get().role,'user');assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,1);assert.equal(db.prepare("SELECT price FROM games WHERE id='bolzoo'").get().price,7300);assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);}finally{db.close();}
});
